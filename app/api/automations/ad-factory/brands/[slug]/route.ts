import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { extractPromptModifier } from '@/lib/brand-dna-builder'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const db = getSupabaseServer()
  const { data, error } = await db
    .from('ad_factory_brands')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const updates = await req.json()
  // Re-derive prompt_modifier if brand_dna_md changed but no explicit modifier provided
  if (updates.brand_dna_md && !updates.prompt_modifier) {
    const m = extractPromptModifier(updates.brand_dna_md)
    if (m) updates.prompt_modifier = m
  }
  updates.updated_at = new Date().toISOString()

  const db = getSupabaseServer()
  const { data, error } = await db
    .from('ad_factory_brands')
    .update(updates)
    .eq('slug', slug)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const db = getSupabaseServer()
  const { error } = await db.from('ad_factory_brands').delete().eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
