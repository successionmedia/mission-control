import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { fireAllImageTasks, type AspectRatio, type Resolution } from '@/lib/kie-gpt-image'

interface InputPrompt {
  number: number
  name: string
  prompt: string
  reason?: string
}

interface ResultRow {
  number: number
  name: string
  status: 'queued' | 'generating' | 'success' | 'fail'
  kie_task_id?: string
  image_url?: string
  error?: string
}

const OUTPUT_TYPE_SUFFIX: Record<string, string> = {
  lifestyle:
    'Render as a clean lifestyle photograph — natural environment, real-world setting, soft natural light.',
  product_shot:
    'Render as a premium product hero shot — studio-lit, clean backdrop, the product as the absolute focal point.',
  static_ad:
    'Render as a polished static social ad — composition includes headline space and any callout pills described.',
}

function buildFinalPrompt(modifier: string, outputType: string, base: string): string {
  const mod = (modifier || '').trim()
  const suffix = OUTPUT_TYPE_SUFFIX[outputType] || ''
  return [mod, suffix, base].filter(Boolean).join(' ')
}

// POST: retry failed (or specified) prompts for a job
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const onlyNumbers: number[] | null = Array.isArray(body?.numbers) ? body.numbers : null

    const db = getSupabaseServer()
    const { data: job, error } = await db
      .from('ad_factory_jobs')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const prompts: InputPrompt[] = (job.prompts || []) as InputPrompt[]
    const results: ResultRow[] = (job.results || []) as ResultRow[]

    // Decide which to retry — explicit list or all currently 'fail'
    const retryNumbers = new Set<number>(
      onlyNumbers ??
        results.filter((r) => r.status === 'fail').map((r) => r.number)
    )
    if (retryNumbers.size === 0) {
      return NextResponse.json({ error: 'Nothing to retry' }, { status: 400 })
    }

    // Combine refs same way as initial POST
    const combinedRefs = [
      ...((job.product_image_urls || []) as string[]),
      ...((job.style_image_urls || []) as string[]),
    ]
      .filter((u) => typeof u === 'string' && u.startsWith('http'))
      .slice(0, 16)

    const finalPrompts = prompts
      .filter((p) => retryNumbers.has(p.number))
      .map((p) => ({
        number: p.number,
        prompt: buildFinalPrompt(
          job.brand_dna_snapshot
            ? extractModifier(job.brand_dna_snapshot)
            : '',
          job.output_type || 'static_ad',
          p.prompt
        ),
        inputUrls: combinedRefs.length ? combinedRefs : undefined,
      }))

    const fired = await fireAllImageTasks(finalPrompts, {
      aspectRatio: (job.aspect_ratio || '1:1') as AspectRatio,
      resolution: (job.resolution || '2K') as Resolution,
    })

    // Merge fresh task IDs into results
    const next: ResultRow[] = results.map((r) => {
      if (!retryNumbers.has(r.number)) return r
      const fire = fired.find((f) => f.number === r.number)
      if (fire?.taskId) {
        return {
          number: r.number,
          name: r.name,
          status: 'generating',
          kie_task_id: fire.taskId,
        }
      }
      return {
        number: r.number,
        name: r.name,
        status: 'fail',
        error: fire?.error || 'Retry submit failed',
      }
    })

    const { data: updated } = await db
      .from('ad_factory_jobs')
      .update({
        results: next,
        status: 'generating',
        updated_at: new Date().toISOString(),
        completed_at: null,
      })
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/** Extract the IMAGE GENERATION PROMPT MODIFIER paragraph from a brand-dna.md snapshot. */
function extractModifier(md: string): string {
  const m = md.match(/IMAGE GENERATION PROMPT MODIFIER\s*\n+([\s\S]+?)(\n\n[A-Z][A-Z ]{4,}\n|$)/)
  if (m) return m[1].trim()
  return ''
}
