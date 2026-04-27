import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { submitInfiniteTalk } from '@/lib/wavespeed'

// POST: create a new lipsync job and submit it to WaveSpeed
export async function POST(req: NextRequest) {
  try {
    const { audio_url, image_url, title, resolution } = await req.json()

    if (!audio_url || !image_url) {
      return NextResponse.json(
        { error: 'Missing audio_url or image_url' },
        { status: 400 }
      )
    }

    const res = (resolution === '720p' ? '720p' : '480p') as '480p' | '720p'

    const db = getSupabaseServer()

    // Insert pending row first so we always have a record even if submit fails
    const { data: inserted, error: insertErr } = await db
      .from('lipsync_jobs')
      .insert({
        title: title || null,
        audio_url,
        image_url,
        resolution: res,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: insertErr?.message || 'Failed to create job' },
        { status: 500 }
      )
    }

    try {
      const submit = await submitInfiniteTalk({
        image: image_url,
        audio: audio_url,
        resolution: res,
      })

      const { data: updated } = await db
        .from('lipsync_jobs')
        .update({
          wavespeed_task_id: submit.id,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', inserted.id)
        .select()
        .single()

      return NextResponse.json(updated ?? inserted)
    } catch (submitErr) {
      const msg = submitErr instanceof Error ? submitErr.message : String(submitErr)
      await db
        .from('lipsync_jobs')
        .update({
          status: 'failed',
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inserted.id)
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET: list recent jobs (most recent first)
export async function GET() {
  const db = getSupabaseServer()
  const { data, error } = await db
    .from('lipsync_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: data ?? [] })
}
