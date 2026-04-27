// WaveSpeed AI InfiniteTalk client.
// Docs: https://wavespeed.ai/models/wavespeed-ai/infinitetalk

const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3'
const INFINITETALK_PATH = '/wavespeed-ai/infinitetalk'

function key(): string {
  const k = process.env.WAVESPEED_API_KEY
  if (!k) throw new Error('Missing WAVESPEED_API_KEY env var')
  return k
}

export type InfiniteTalkInput = {
  image: string
  audio: string
  prompt?: string
  resolution?: '480p' | '720p'
  seed?: number
}

export type InfiniteTalkSubmit = {
  id: string
  status: string
  urls?: { get?: string }
}

export type InfiniteTalkResult = {
  id: string
  status: 'created' | 'processing' | 'completed' | 'failed' | string
  outputs?: string[]
  error?: string
  created_at?: string
  has_nsfw_contents?: boolean[]
}

export async function submitInfiniteTalk(input: InfiniteTalkInput): Promise<InfiniteTalkSubmit> {
  const body: Record<string, unknown> = {
    image: input.image,
    audio: input.audio,
    resolution: input.resolution ?? '480p',
  }
  if (input.prompt) body.prompt = input.prompt
  if (typeof input.seed === 'number') body.seed = input.seed

  const r = await fetch(`${WAVESPEED_BASE}${INFINITETALK_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const text = await r.text()
    throw new Error(`WaveSpeed submit failed (${r.status}): ${text}`)
  }

  const j = await r.json()
  // WaveSpeed wraps the payload in `data`
  const data = j.data ?? j
  return {
    id: data.id,
    status: data.status,
    urls: data.urls,
  }
}

export async function fetchInfiniteTalkResult(taskId: string): Promise<InfiniteTalkResult> {
  const r = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}/result`, {
    headers: { Authorization: `Bearer ${key()}` },
  })

  if (!r.ok) {
    const text = await r.text()
    throw new Error(`WaveSpeed result fetch failed (${r.status}): ${text}`)
  }

  const j = await r.json()
  const data = j.data ?? j
  return {
    id: data.id,
    status: data.status,
    outputs: data.outputs,
    error: data.error,
    created_at: data.created_at,
    has_nsfw_contents: data.has_nsfw_contents,
  }
}
