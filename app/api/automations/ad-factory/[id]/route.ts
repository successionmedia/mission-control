import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { pollAllImageTasks } from '@/lib/kie-gpt-image'
import { rehostUrl, slugify } from '@/lib/ad-factory-storage'

interface ResultRow {
  number: number
  name: string
  status: 'queued' | 'generating' | 'success' | 'fail'
  kie_task_id?: string
  image_url?: string
  error?: string
}

// GET: poll all in-progress tasks for a job, re-host completed images, update DB
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getSupabaseServer()

    const { data: job, error } = await db
      .from('ad_factory_jobs')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !job) {
      return NextResponse.json({ error: error?.message || 'Job not found' }, { status: 404 })
    }

    // Terminal states: short-circuit
    if (
      job.status === 'completed' ||
      job.status === 'failed' ||
      job.status === 'partial'
    ) {
      return NextResponse.json(job)
    }

    const results: ResultRow[] = (job.results || []) as ResultRow[]
    const toPoll = results
      .filter((r) => r.status === 'generating' && r.kie_task_id)
      .map((r) => ({ number: r.number, taskId: r.kie_task_id! }))

    if (toPoll.length === 0) {
      // Nothing to poll — derive final status
      const succ = results.filter((r) => r.status === 'success').length
      const failed = results.filter((r) => r.status === 'fail').length
      const finalStatus =
        succ === results.length ? 'completed' : succ === 0 ? 'failed' : 'partial'
      const { data: updated } = await db
        .from('ad_factory_jobs')
        .update({
          status: finalStatus,
          completed_prompts: succ,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      return NextResponse.json(updated ?? job)
    }

    // Poll all in flight
    const polled = await pollAllImageTasks(toPoll)

    // Rehost successful images, capture errors
    const next = await Promise.all(
      results.map(async (r): Promise<ResultRow> => {
        if (r.status === 'success' || r.status === 'fail') return r
        const p = polled.find((x) => x.number === r.number)
        if (!p) return r
        if (p.state === 'success' && p.imageUrl) {
          try {
            const filename = `${id}/${String(r.number).padStart(2, '0')}-${slugify(r.name)}.png`
            const hostedUrl = await rehostUrl(p.imageUrl, filename)
            return { ...r, status: 'success', image_url: hostedUrl }
          } catch (e) {
            // Rehost failed — keep the Kie CDN URL as fallback (still good for 14 days)
            return {
              ...r,
              status: 'success',
              image_url: p.imageUrl,
              error: `rehost: ${e instanceof Error ? e.message : 'unknown'}`,
            }
          }
        }
        if (p.state === 'fail') {
          return { ...r, status: 'fail', error: p.error || 'Generation failed' }
        }
        // still in flight (waiting/queuing/generating/unknown)
        return r
      })
    )

    const succ = next.filter((r) => r.status === 'success').length
    const failed = next.filter((r) => r.status === 'fail').length
    const pending = next.filter((r) => r.status === 'queued' || r.status === 'generating').length

    let nextStatus: 'generating' | 'completed' | 'failed' | 'partial' = 'generating'
    if (pending === 0) {
      nextStatus = succ === results.length ? 'completed' : succ === 0 ? 'failed' : 'partial'
    }

    const { data: updated } = await db
      .from('ad_factory_jobs')
      .update({
        results: next,
        completed_prompts: succ,
        status: nextStatus,
        updated_at: new Date().toISOString(),
        completed_at:
          nextStatus !== 'generating' ? new Date().toISOString() : job.completed_at,
        error_message:
          nextStatus === 'partial'
            ? `${succ}/${results.length} succeeded · ${failed} failed`
            : nextStatus === 'failed'
              ? 'All prompts failed'
              : job.error_message,
      })
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json(updated ?? { ...job, results: next })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
