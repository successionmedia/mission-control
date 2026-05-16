import { NextRequest, NextResponse } from 'next/server'
import { buildBrandDnaFromUrl } from '@/lib/brand-dna-builder'

/**
 * POST: take a landing-page URL, return a draft brand DNA document
 * (the user reviews & edits before saving via POST /brands).
 *
 * Body: { landing_url: string }
 * Response: { slug, name, landing_url, brand_dna_md, prompt_modifier, candidate_product_image_urls }
 */
export async function POST(req: NextRequest) {
  try {
    const { landing_url } = await req.json()
    if (typeof landing_url !== 'string' || !landing_url.trim()) {
      return NextResponse.json(
        { error: 'landing_url is required' },
        { status: 400 }
      )
    }
    const result = await buildBrandDnaFromUrl(landing_url.trim())
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
