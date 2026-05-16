import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { fireAllImageTasks, type AspectRatio, type Resolution } from '@/lib/kie-gpt-image'
import { ensureBucket } from '@/lib/ad-factory-storage'

interface InputPrompt {
  number: number
  name: string
  prompt: string
  reason?: string
}

interface ResultRow {
  number: number
  name: string
  status: 'queued' | 'generating' | 'success' | 'fail'
  kie_task_id?: string
  image_url?: string
  error?: string
}

const OUTPUT_TYPE_SUFFIX: Record<string, string> = {
  lifestyle:
    'Render as a clean lifestyle photograph — natural environment, real-world setting, soft natural light.',
  product_shot:
    'Render as a premium product hero shot — studio-lit, clean backdrop, the product as the absolute focal point.',
  static_ad:
    'Render as a polished static social ad — composition includes headline space and any callout pills described.',
}

function buildFinalPrompt(modifier: string, outputType: string, base: string): string {
  const mod = (modifier || '').trim()
  const suffix = OUTPUT_TYPE_SUFFIX[outputType] || ''
  return [mod, suffix, base].filter(Boolean).join(' ')
}

// POST: create a new ad-factory job — fire ALL prompts at once via Kie GPT Image 2
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      campaign_name,
      brand_slug,
      output_type = 'static_ad',
      aspect_ratio = '1:1',
      resolution = '2K',
      product_image_urls = [],
      style_image_urls = [],
      prompts,
    } = body as {
      campaign_name: string
      brand_slug: string
      output_type?: string
      aspect_ratio?: AspectRatio
      resolution?: Resolution
      product_image_urls?: string[]
      style_image_urls?: string[]
      prompts: InputPrompt[]
    }

    if (!campaign_name?.trim() || !brand_slug?.trim()) {
      return NextResponse.json(
        { error: 'campaign_name and brand_slug are required' },
        { status: 400 }
      )
    }
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: 'prompts must be a non-empty array' },
        { status: 400 }
      )
    }

    const db = getSupabaseServer()
    await ensureBucket()

    // 1. Load brand for the prompt modifier
    const { data: brand, error: brandErr } = await db
      .from('ad_factory_brands')
      .select('*')
      .eq('slug', brand_slug)
      .single()
    if (brandErr || !brand) {
      return NextResponse.json(
        { error: `Brand not found: ${brand_slug}` },
        { status: 404 }
      )
    }

    // 2. Combine product + style refs for input_urls
    const combinedRefs = [...(product_image_urls || []), ...(style_image_urls || [])]
      .filter((u) => typeof u === 'string' && u.startsWith('http'))
      .slice(0, 16)

    // 3. Build final prompts (modifier + output-type suffix + base)
    const finalPrompts = prompts.map((p) => ({
      number: p.number,
      prompt: buildFinalPrompt(brand.prompt_modifier, output_type, p.prompt),
      inputUrls: combinedRefs.length ? combinedRefs : undefined,
    }))

    // 4. Insert pending job
    const seedResults: ResultRow[] = prompts.map((p) => ({
      number: p.number,
      name: p.name,
      status: 'queued',
    }))
    const { data: job, error: insertErr } = await db
      .from('ad_factory_jobs')
      .insert({
        campaign_name: campaign_name.trim(),
        brand_slug,
        brand_dna_snapshot: brand.brand_dna_md,
        output_type,
        aspect_ratio,
        resolution,
        product_image_urls,
        style_image_urls,
        prompts,
        total_prompts: prompts.length,
        completed_prompts: 0,
        results: seedResults,
        status: 'generating',
      })
      .select()
      .single()
    if (insertErr || !job) {
      return NextResponse.json(
        { error: insertErr?.message || 'Failed to create job' },
        { status: 500 }
      )
    }

    // 5. Fire all Kie tasks in parallel (batched at 16)
    const fired = await fireAllImageTasks(finalPrompts, {
      aspectRatio: aspect_ratio,
      resolution,
    })

    // 6. Merge taskIds into results
    const creditsFailed = fired.filter((r) => r.creditsInsufficient)
    const successfulFires = fired.filter((r) => r.taskId && !r.error)

    const resultsAfterFire: ResultRow[] = prompts.map((p) => {
      const fire = fired.find((f) => f.number === p.number)
      if (fire?.taskId) {
        return {
          number: p.number,
          name: p.name,
          status: 'generating',
          kie_task_id: fire.taskId,
        }
      }
      return {
        number: p.number,
        name: p.name,
        status: 'fail',
        error: fire?.error || 'Failed to submit',
      }
    })

    let status: 'generating' | 'failed' | 'partial' = 'generating'
    let errorMessage: string | null = null
    if (successfulFires.length === 0) {
      status = 'failed'
      errorMessage = creditsFailed.length
        ? 'Kie AI credits insufficient — no tasks could be submitted. Top up at https://kie.ai.'
        : `All ${prompts.length} prompts failed to submit.`
    } else if (creditsFailed.length > 0) {
      errorMessage = `Kie credits ran out after ${successfulFires.length}/${prompts.length} prompts submitted. Top up at https://kie.ai and retry the rest.`
    }

    const { data: updated } = await db
      .from('ad_factory_jobs')
      .update({
        results: resultsAfterFire,
        status,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select()
      .single()

    return NextResponse.json(updated ?? job)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET: list recent ad-factory jobs
export async function GET() {
  const db = getSupabaseServer()
  const { data, error } = await db
    .from('ad_factory_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}
