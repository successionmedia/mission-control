/**
 * Kie AI client — GPT Image 2 image generation.
 * Used by the Ad Factory automation to batch-generate static ads.
 *
 * Docs:
 *   POST https://api.kie.ai/api/v1/jobs/createTask
 *     body: { model, input: { prompt, input_urls?, aspect_ratio?, resolution? }, callBackUrl? }
 *     models: "gpt-image-2-text-to-image" | "gpt-image-2-image-to-image"
 *   GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>
 *     response: data.state in waiting|queuing|generating|success|fail,
 *               data.resultJson (JSON string) -> { resultUrls: string[] }
 *
 * Limits:
 *   - aspect_ratio: auto|1:1|9:16|16:9|4:3|3:4 (1:1 and auto capped at 1K)
 *   - resolution: 1K|2K|4K
 *   - input_urls: HTTPS only, max 16, max 30MB each
 *   - rate limit: 20 requests / 10 sec, 100+ concurrent
 *   - generated URLs valid 14 days on Kie CDN (we re-host to Supabase)
 */

const KIE_BASE = 'https://api.kie.ai'

function getApiKey(): string {
  const key = process.env.KIE_AI_API_KEY
  if (!key) throw new Error('KIE_AI_API_KEY not set in .env.local')
  return key
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

export type AspectRatio = 'auto' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
export type Resolution = '1K' | '2K' | '4K'

export interface CreateImageTaskOpts {
  prompt: string
  inputUrls?: string[]
  aspectRatio?: AspectRatio
  resolution?: Resolution
}

/** Custom error for insufficient credits — UI can check for this specifically */
export class KieCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KieCreditsError'
  }
}

/** Create a GPT Image 2 task. Auto-selects text-to-image vs image-to-image based on inputUrls. */
export async function createImageTask(opts: CreateImageTaskOpts): Promise<string> {
  const hasRefs = !!opts.inputUrls && opts.inputUrls.length > 0
  const model = hasRefs ? 'gpt-image-2-image-to-image' : 'gpt-image-2-text-to-image'

  // Defensive: clamp 1:1 + auto to 1K since the API rejects higher
  const aspect = opts.aspectRatio || '1:1'
  let resolution = opts.resolution || '2K'
  if ((aspect === '1:1' || aspect === 'auto') && resolution !== '1K') {
    resolution = '1K'
  }

  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    aspect_ratio: aspect,
    resolution,
  }
  if (hasRefs) {
    input.input_urls = (opts.inputUrls || []).slice(0, 16)
  }

  const body = { model, input }

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createImageTask HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  if (data.code === 402) {
    throw new KieCreditsError(data.msg || 'Credits insufficient')
  }
  if (data.code !== 200) {
    throw new Error(`createImageTask failed: ${data.msg || JSON.stringify(data)}`)
  }
  if (!data.data?.taskId) {
    throw new Error(`createImageTask: no taskId in response`)
  }
  return data.data.taskId as string
}

export interface PollImageTaskResult {
  state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail' | 'unknown'
  imageUrl?: string
  resultUrls?: string[]
  error?: string
}

/** Poll a single image task. Returns state + URLs (when success). */
export async function pollImageTask(taskId: string): Promise<PollImageTaskResult> {
  const res = await fetch(
    `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: headers() }
  )
  if (!res.ok) {
    throw new Error(`pollImageTask HTTP ${res.status}`)
  }
  const json = await res.json()
  const data = json.data || {}

  if (data.state === 'success') {
    let resultUrls: string[] = []
    const raw = data.resultJson
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw || {}
      resultUrls = Array.isArray(parsed.resultUrls) ? parsed.resultUrls : []
    } catch {
      resultUrls = []
    }
    return {
      state: 'success',
      imageUrl: resultUrls[0],
      resultUrls,
    }
  }
  if (data.state === 'fail') {
    return {
      state: 'fail',
      error: `${data.failCode || 'FAIL'}: ${data.failMsg || 'Unknown failure'}`,
    }
  }
  const state = (data.state as PollImageTaskResult['state']) || 'unknown'
  return { state }
}

/** Helper: short delay between batches */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface BatchPrompt {
  number: number
  prompt: string
  inputUrls?: string[]
}

export interface BatchTaskResult {
  number: number
  taskId: string
  error?: string
  creditsInsufficient?: boolean
}

/**
 * Fire many image tasks in batches respecting Kie's 20/10s rate limit.
 * Batches of 16 with 2s between batches — comfortable headroom.
 */
export async function fireAllImageTasks(
  prompts: BatchPrompt[],
  opts: { aspectRatio?: AspectRatio; resolution?: Resolution } = {}
): Promise<BatchTaskResult[]> {
  const BATCH_SIZE = 16
  const BATCH_DELAY_MS = 2000
  const allResults: PromiseSettledResult<BatchTaskResult>[] = []

  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch = prompts.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async (p): Promise<BatchTaskResult> => {
        const taskId = await createImageTask({
          prompt: p.prompt,
          inputUrls: p.inputUrls,
          aspectRatio: opts.aspectRatio,
          resolution: opts.resolution,
        })
        return { number: p.number, taskId }
      })
    )
    allResults.push(...settled)
    if (i + BATCH_SIZE < prompts.length) await delay(BATCH_DELAY_MS)
  }

  return allResults.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const isCredits = r.reason instanceof KieCreditsError
    return {
      number: prompts[i].number,
      taskId: '',
      error: r.reason?.message || 'Unknown error',
      creditsInsufficient: isCredits,
    }
  })
}

/** Poll an array of task IDs in parallel. Skips entries with empty taskId. */
export async function pollAllImageTasks(
  taskIds: Array<{ number: number; taskId: string }>
): Promise<
  Array<{
    number: number
    taskId: string
    state: PollImageTaskResult['state']
    imageUrl?: string
    error?: string
  }>
> {
  const settled = await Promise.allSettled(
    taskIds.map(async (t) => {
      if (!t.taskId) return { ...t, state: 'fail' as const, error: 'No task ID' }
      const poll = await pollImageTask(t.taskId)
      return {
        ...t,
        state: poll.state,
        imageUrl: poll.imageUrl,
        error: poll.error,
      }
    })
  )
  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      ...taskIds[i],
      state: 'fail' as const,
      error: r.reason?.message || 'Poll failed',
    }
  })
}
