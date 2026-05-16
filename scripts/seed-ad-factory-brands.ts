/**
 * One-shot seed script: walks ~/Desktop/CLAUDE CODE/01-brands/<slug>/ad-factory/
 * and inserts a row into ad_factory_brands per brand that has a brand-dna.md.
 *
 * For each brand:
 *  - reads brand-dna.md
 *  - extracts the IMAGE GENERATION PROMPT MODIFIER
 *  - uploads any local PNG product references in the ad-factory folder to Supabase
 *  - upserts the brand row
 *
 * Usage:
 *  cd mission-control
 *  npx tsx scripts/seed-ad-factory-brands.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join } from 'node:path'

// Tiny .env.local loader — no external dep
function loadEnv(): void {
  try {
    const text = readFileSync('.env.local', 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      const key = m[1]
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env.local missing — fall through to env vars
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'ad-factory'
const BRANDS_ROOT = join(homedir(), 'Desktop', 'CLAUDE CODE', '01-brands')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function extractPromptModifier(md: string): string {
  const m = md.match(/IMAGE GENERATION PROMPT MODIFIER\s*\n+([\s\S]+?)(\n\n[A-Z][A-Z ]{4,}\n|$)/)
  if (m) return m[1].trim()
  // Fallback: last paragraph
  const paras = md.trim().split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  return paras[paras.length - 1] || ''
}

async function ensureBucket() {
  const { data: buckets } = await db.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    console.log(`Creating bucket: ${BUCKET}`)
    await db.storage.createBucket(BUCKET, { public: true })
  }
}

async function uploadLocalImage(localPath: string, destPath: string): Promise<string> {
  const buf = readFileSync(localPath)
  const ext = extname(localPath).slice(1).toLowerCase()
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : 'image/png'
  const { error } = await db.storage.from(BUCKET).upload(destPath, buf, {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new Error(`Upload ${localPath}: ${error.message}`)
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${destPath}`
}

interface BrandSeed {
  slug: string
  name: string
  brand_dna_md: string
  prompt_modifier: string
  product_image_urls: string[]
}

async function seedBrand(slug: string): Promise<void> {
  const folder = join(BRANDS_ROOT, slug, 'ad-factory')
  let stats: ReturnType<typeof statSync>
  try {
    stats = statSync(folder)
  } catch {
    console.log(`  · skip ${slug} (no ad-factory folder)`)
    return
  }
  if (!stats.isDirectory()) return

  const dnaPath = join(folder, 'brand-dna.md')
  let dna: string
  try {
    dna = readFileSync(dnaPath, 'utf8')
  } catch {
    console.log(`  · skip ${slug} (no brand-dna.md)`)
    return
  }

  const modifier = extractPromptModifier(dna)
  if (!modifier) {
    console.log(`  ! ${slug}: could not extract prompt modifier — skipping`)
    return
  }

  // Pretty name from slug
  const name = slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')

  // Find product images at the top level of ad-factory/ (skip subfolders that are campaigns)
  const productImages: string[] = []
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!/\.(png|jpe?g|webp)$/i.test(entry.name)) continue
    // Heuristic: skip output filenames that look like generated outputs (NN-name.png)
    if (/^\d{2}-/.test(entry.name)) continue
    const local = join(folder, entry.name)
    const dest = `brands/${slug}/${entry.name}`
    try {
      const url = await uploadLocalImage(local, dest)
      productImages.push(url)
      console.log(`    + ${entry.name}`)
    } catch (e) {
      console.log(`    ! upload failed for ${entry.name}: ${e instanceof Error ? e.message : e}`)
    }
  }

  const brand: BrandSeed = {
    slug,
    name,
    brand_dna_md: dna,
    prompt_modifier: modifier,
    product_image_urls: productImages,
  }

  const { error } = await db.from('ad_factory_brands').upsert(
    {
      ...brand,
      landing_url: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug' }
  )
  if (error) {
    console.log(`  ! ${slug} upsert failed: ${error.message}`)
  } else {
    console.log(`  ✓ ${slug} (${productImages.length} product images)`)
  }
}

async function main() {
  console.log(`Seeding ad-factory brands from ${BRANDS_ROOT}`)
  await ensureBucket()

  let slugs: string[]
  try {
    slugs = readdirSync(BRANDS_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch (e) {
    console.error(`Cannot read ${BRANDS_ROOT}:`, e)
    process.exit(1)
  }

  for (const slug of slugs.sort()) {
    await seedBrand(slug)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
