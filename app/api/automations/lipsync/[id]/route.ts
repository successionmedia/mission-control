import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { fetchInfiniteTalkResult } from '@/lib/wavespeed'

async function cacheVideoToStorage(jobId: string, sourceUrl: string): Promise<string | null> {
  try {
    const r = await fetch(sourceUrl)
    if (!r.ok) return null
    const blob = await r.blob()
    const buf = new Uint8Array(await blob.arrayBuffer())

    const db = getSupabaseServer()
    const path = `${jobId}.mp4`
    const { error } = await db.storage
      .from('lipsync-videos')
      .upload(path, buf, { contentType: 'video/mp4', upsert: true })

    if (error) return null

    const { data } = db.storage.from('lipsync-videos').getPublicUrl(path)
    return data.publicUrl ?? null
  } catch {
    return null
  }
}

// GET: poll status — refreshes from WaveSpeed if still processing
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const db = getSupabaseServer()

  const { data: job, error } = await db
    .from('lipsync_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Already finished — just return the row
  if (job.status === 'completed' || job.status === 'failed') {
    return NextResponse.json(job)
  }

  // Nothing to poll yet
  if (!job.wavespeed_task_id) {
    return NextResponse.json(job)
  }

  try {
    const result = await fetchInfiniteTalkResult(job.wavespeed_task_id)

    if (result.status === 'completed') {
      const sourceUrl = result.outputs?.[0]
      let finalUrl = sourceUrl ?? null

      if (sourceUrl) {
        const cached = await cacheVideoToStorage(job.id, sourceUrl)
        if (cached) finalUrl = cached
      }

      const { data: updated } = await db
        .from('lipsync_jobs')
        .update({
          status: 'completed',
          result_video_url: finalUrl,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select()
        .single()

      return NextResponse.json(updated ?? job)
    }

    if (result.status === 'failed') {
      const { data: updated } = await db
        .from('lipsync_jobs')
        .update({
          status: 'failed',
          error_message: result.error || 'WaveSpeed reported failure',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select()
        .single()

      return NextResponse.json(updated ?? job)
    }

    // Still running — return the job row with a hint of the upstream state
    return NextResponse.json({ ...job, upstream_status: result.status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ...job, error_message: msg }, { status: 200 })
  }
}

// DELETE: remove a job (does not cancel WaveSpeed-side)
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const db = getSupabaseServer()
  const { error } = await db.from('lipsync_jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
