import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

const APIFY_TOKEN = process.env.APIFY_TOKEN!
const ACTOR_ID = 'JJghSZmShuco4j9gJ'

export async function POST(req: NextRequest) {
  try {
    const { brand_id } = await req.json()

    // Get brand
    const { data: brand, error: brandError } = await getSupabaseServer()
      .from('spy_brands')
      .select('*')
      .eq('id', brand_id)
      .single()

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    // Start Apify actor run
    const response = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: brand.ad_library_url }],
          resultsLimit: 20,
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: `Apify error: ${text}` }, { status: 500 })
    }

    const run = await response.json()

    return NextResponse.json({
      run_id: run.data.id,
      status: run.data.status,
      brand_id: brand.id,
    })
  } catch (err) {
    console.error('Scrape error:', err)
    return NextResponse.json({ error: 'Failed to start scrape' }, { status: 500 })
  }
}
