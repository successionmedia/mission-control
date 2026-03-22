import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getWeekStart, getMediaFingerprint } from '@/lib/spy-utils'

const APIFY_TOKEN = process.env.APIFY_TOKEN!

interface ApifyAdResult {
  adArchiveID?: string
  adArchiveId?: string
  adid?: string
  snapshot?: {
    title?: string
    body?: { text?: string } | { markup?: { __html?: string } }
    cards?: Array<{
      title?: string
      body?: string
      link_url?: string
    }>
    cta_text?: string
    ctaText?: string
    cta_type?: string
    ctaType?: string
    displayFormat?: string
    videos?: Array<{
      videoHdUrl?: string
      videoSdUrl?: string
      videoPreviewImageUrl?: string
      // legacy snake_case fallbacks
      video_hd_url?: string
      video_sd_url?: string
      video_preview_image_url?: string
    }>
    images?: Array<{
      originalImageUrl?: string
      resizedImageUrl?: string
      // legacy snake_case fallbacks
      original_image_url?: string
      resized_image_url?: string
    }>
    link_url?: string
    linkUrl?: string
  }
  startDate?: string
  isActive?: boolean
  publisherPlatform?: string[]
  collationCount?: number
  currency?: string
  pageName?: string
}

function extractAdData(item: ApifyAdResult, rank: number, brandId: string) {
  const adId = item.adArchiveID || item.adArchiveId || item.adid || `unknown-${Date.now()}`
  const snapshot = item.snapshot || {}
  const firstCard = snapshot.cards?.[0]
  const videos = snapshot.videos || []
  const images = snapshot.images || []

  // Get body text
  let adCopy = ''
  if (snapshot.body) {
    const body = snapshot.body as Record<string, unknown>
    adCopy = (body.text as string) || ''
    if (!adCopy && body.markup) {
      const markup = body.markup as Record<string, string>
      adCopy = (markup.__html || '').replace(/<[^>]*>/g, '')
    }
  }

  const headline = firstCard?.title || snapshot.title || ''
  const videoUrl = videos[0]?.videoHdUrl || videos[0]?.videoSdUrl || videos[0]?.video_hd_url || videos[0]?.video_sd_url || null
  const imageUrl = images[0]?.originalImageUrl || images[0]?.resizedImageUrl || images[0]?.original_image_url || images[0]?.resized_image_url || null
  const thumbnailUrl = videos[0]?.videoPreviewImageUrl || videos[0]?.video_preview_image_url || imageUrl || null
  const creativeType = (videoUrl || snapshot.displayFormat === 'VIDEO') ? 'video' : 'image'
  const ctaType = snapshot.ctaText || snapshot.cta_text || snapshot.ctaType || snapshot.cta_type || null
  const adLibraryLink = `https://www.facebook.com/ads/library/?id=${adId}`

  return {
    ad_id: adId,
    brand_id: brandId,
    rank,
    creative_type: creativeType,
    creative_url: thumbnailUrl,
    video_url: videoUrl,
    ad_copy: adCopy || null,
    headline: headline || null,
    cta_type: ctaType,
    start_date: item.startDate || null,
    ad_library_link: adLibraryLink,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    weeks_in_top10: 1,
    bookmarked: false,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('run_id')
    const brandId = searchParams.get('brand_id')

    if (!runId || !brandId) {
      return NextResponse.json({ error: 'Missing run_id or brand_id' }, { status: 400 })
    }

    // Check run status
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    )
    const statusData = await statusRes.json()
    const status = statusData.data?.status

    if (status === 'RUNNING' || status === 'READY') {
      return NextResponse.json({ status: 'running' })
    }

    if (status !== 'SUCCEEDED') {
      return NextResponse.json({ status: 'failed', error: `Run status: ${status}` })
    }

    // Fetch results
    const datasetId = statusData.data?.defaultDatasetId
    const resultsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
    )
    const apifyResults: ApifyAdResult[] = await resultsRes.json()

    if (!apifyResults || apifyResults.length === 0) {
      return NextResponse.json({ status: 'completed', ads_processed: 0 })
    }

    // === 3-PASS DEDUP ===

    // Pass 1: Dedup by adArchiveID
    const seenIds = new Set<string>()
    const uniqueById = apifyResults.filter((item) => {
      const adId = item.adArchiveID || item.adArchiveId || item.adid
      if (!adId) return true
      if (seenIds.has(adId)) return false
      seenIds.add(adId)
      return true
    })

    // Pass 2: Dedup by media fingerprint (keep oldest)
    const mediaGrouped = new Map<string, { item: ApifyAdResult; startTimestamp: number }>()
    const noMediaItems: ApifyAdResult[] = []
    for (const item of uniqueById) {
      const snapshot = item.snapshot || {}
      const videos = snapshot.videos || []
      const images = snapshot.images || []
      const mediaUrl = videos[0]?.video_hd_url || videos[0]?.video_sd_url || images[0]?.original_image_url || null
      const fingerprint = getMediaFingerprint(mediaUrl)
      const startTimestamp = item.startDate ? new Date(item.startDate).getTime() : Date.now()

      if (fingerprint) {
        const key = `media:${fingerprint}`
        const existing = mediaGrouped.get(key)
        if (!existing || startTimestamp < existing.startTimestamp) {
          mediaGrouped.set(key, { item, startTimestamp })
        }
      } else {
        noMediaItems.push(item)
      }
    }
    const afterMediaDedup = [...Array.from(mediaGrouped.values()).map((v) => v.item), ...noMediaItems]

    // Pass 3: Dedup by headline (keep oldest)
    const headlineGrouped = new Map<string, { item: ApifyAdResult; startTimestamp: number }>()
    const noHeadlineItems: ApifyAdResult[] = []
    for (const item of afterMediaDedup) {
      const snapshot = item.snapshot || {}
      const firstCard = snapshot.cards?.[0]
      const headline = (firstCard?.title || snapshot.title || '').trim().toLowerCase()
      const startTimestamp = item.startDate ? new Date(item.startDate).getTime() : Date.now()

      if (headline) {
        const key = `headline:${headline}`
        const existing = headlineGrouped.get(key)
        if (!existing || startTimestamp < existing.startTimestamp) {
          headlineGrouped.set(key, { item, startTimestamp })
        }
      } else {
        noHeadlineItems.push(item)
      }
    }
    const finalAds = [...Array.from(headlineGrouped.values()).map((v) => v.item), ...noHeadlineItems]

    // === PROCESS & STORE ===
    const db = getSupabaseServer()
    const weekStart = getWeekStart()
    let adsProcessed = 0

    for (let i = 0; i < finalAds.length; i++) {
      const adData = extractAdData(finalAds[i], i + 1, brandId)

      // Check if ad already exists
      const { data: existing } = await db
        .from('spy_ads')
        .select('id, last_seen, weeks_in_top10')
        .eq('ad_id', adData.ad_id)
        .single()

      if (existing) {
        // Update existing ad
        const lastSeenWeek = getWeekStart(new Date(existing.last_seen))
        const weeksIncrement = lastSeenWeek !== weekStart ? 1 : 0

        await db
          .from('spy_ads')
          .update({
            rank: adData.rank,
            last_seen: adData.last_seen,
            weeks_in_top10: existing.weeks_in_top10 + weeksIncrement,
            creative_url: adData.creative_url,
            video_url: adData.video_url,
            ad_copy: adData.ad_copy,
            headline: adData.headline,
            cta_type: adData.cta_type,
          })
          .eq('id', existing.id)
      } else {
        // Insert new ad
        await db.from('spy_ads').insert(adData)
      }

      // Record weekly snapshot
      await db
        .from('spy_weekly_snapshots')
        .upsert(
          {
            brand_id: brandId,
            ad_id: adData.ad_id,
            week_start: weekStart,
            rank: adData.rank,
          },
          { onConflict: 'brand_id,ad_id,week_start' }
        )

      adsProcessed++
    }

    // Update brand last_scraped
    await db
      .from('spy_brands')
      .update({ last_scraped: new Date().toISOString() })
      .eq('id', brandId)

    return NextResponse.json({
      status: 'completed',
      ads_processed: adsProcessed,
      total_raw: apifyResults.length,
      after_dedup: finalAds.length,
    })
  } catch (err) {
    console.error('Scrape status error:', err)
    return NextResponse.json({ error: 'Failed to check scrape status' }, { status: 500 })
  }
}
