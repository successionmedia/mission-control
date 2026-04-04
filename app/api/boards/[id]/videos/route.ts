import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('board_videos')
    .select('*')
    .eq('board_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string
  const notes = formData.get('notes') as string | null

  if (!file || !title?.trim()) {
    return NextResponse.json({ error: 'File and title are required' }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const ext = file.name.split('.').pop()
  const fileName = `boards/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(fileName, file)

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName)

  const { data, error: insertError } = await supabase
    .from('board_videos')
    .insert({
      board_id: id,
      title: title.trim(),
      file_url: publicUrl,
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
