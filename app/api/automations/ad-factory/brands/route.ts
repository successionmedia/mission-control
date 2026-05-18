import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { extractPromptModifier } from '@/lib/brand-dna-builder'

// GET: list all brands
export async function GET() {
  const db = getSupabaseServer()
  const { data, error } = await db
    .from('ad_factory_brands')
    .select('*')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ brands: data ?? [] })
}

// POST: create/upsert a brand from explicit fields (used after the user edits an auto-built draft)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      slug,
      name,
      landing_url,
      brand_dna_md,
      prompt_modifier,
      product_image_urls = [],
    } = body as {
      slug: string
      name: string
      landing_url?: string
      brand_dna_md: string
      prompt_modifier?: string
      product_image_urls?: string[]
    }

    if (!slug?.trim() || !name?.trim() || !brand_dna_md?.trim()) {
      return NextResponse.json(
        { error: 'slug, name, and brand_dna_md are required' },
        { status: 400 }
      )
    }

    const finalModifier = (prompt_modifier || extractPromptModifier(brand_dna_md) || '').trim()
    if (!finalModifier) {
      return NextResponse.json(
        {
          error:
            'Could not extract a prompt_modifier from brand_dna_md. Ensure the document contains an IMAGE GENERATION PROMPT MODIFIER section.',
        },
        { status: 400 }
      )
    }

    const db = getSupabaseServer()
    const { data, error } = await db
      .from('ad_factory_brands')
      .upsert(
        {
          slug: slug.trim(),
          name: name.trim(),
          landing_url: landing_url || null,
          brand_dna_md,
          prompt_modifier: finalModifier,
          product_image_urls,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
