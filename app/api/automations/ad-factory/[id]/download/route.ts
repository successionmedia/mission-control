import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import JSZip from 'jszip'
import { slugify } from '@/lib/ad-factory-storage'

interface ResultRow {
  number: number
  name: string
  status: string
  image_url?: string
}

// GET: bundle all successful images into a zip
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getSupabaseServer()

    const { data: job, error } = await db
      .from('ad_factory_jobs')
      .select('campaign_name, results')
      .eq('id', id)
      .single()
    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const results = (job.results || []) as ResultRow[]
    const winners = results.filter((r) => r.status === 'success' && r.image_url)
    if (winners.length === 0) {
      return NextResponse.json(
        { error: 'No completed images to download yet' },
        { status: 400 }
      )
    }

    const zip = new JSZip()
    await Promise.all(
      winners.map(async (w) => {
        try {
          const res = await fetch(w.image_url!)
          if (!res.ok) return
          const buf = await res.arrayBuffer()
          const filename = `${String(w.number).padStart(2, '0')}-${slugify(w.name)}.png`
          zip.file(filename, buf)
        } catch {
          // Skip failed downloads silently
        }
      })
    )

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    const slug = slugify(job.campaign_name || 'ad-factory')

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${slug}-images.zip"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
