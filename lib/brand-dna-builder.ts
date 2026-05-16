/**
 * Brand DNA Builder — fetches a landing-page URL, optionally pulls Shopify product
 * metadata + images, sends the digest to Gemini for structured Brand DNA synthesis,
 * and returns a draft brand-dna.md the user can edit before saving.
 *
 * Uses GEMINI_API_KEY (already present in mission-control/.env.local).
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'

function gKey(): string {
  const k = process.env.GEMINI_API_KEY
  if (!k) throw new Error('GEMINI_API_KEY not set in .env.local')
  return k
}

function stripHtml(html: string): string {
  // remove <script> and <style> blocks
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // remove all other tags
  s = s.replace(/<[^>]+>/g, ' ')
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function deriveSlug(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host
      .replace(/\.(com|co|net|org|io|us|shop|store)$/i, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase() || 'brand'
  } catch {
    return 'brand'
  }
}

function deriveName(url: string): string {
  const slug = deriveSlug(url)
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

/** Try to fetch Shopify product.json for the URL's product handle. */
async function tryShopifyProductImages(url: string): Promise<string[]> {
  try {
    const u = new URL(url)
    const match = u.pathname.match(/\/products\/([^/?#]+)/)
    if (!match) return []
    const productUrl = `${u.origin}/products/${match[1]}.json`
    const res = await fetch(productUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MissionControl/1.0)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const imgs: string[] = []
    for (const img of data?.product?.images || []) {
      if (img?.src && typeof img.src === 'string') imgs.push(img.src)
    }
    return imgs.slice(0, 5)
  } catch {
    return []
  }
}

/** Pull <title>, hero copy, and inline OG meta from the landing page. */
async function fetchPageDigest(url: string): Promise<{ title: string; text: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`fetchPageDigest: HTTP ${res.status}`)
  const html = await res.text()
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''
  // Trim to first 20k chars of visible text — Gemini handles a lot, no need to drown it
  const text = stripHtml(html).slice(0, 20000)
  return { title, text }
}

const SYSTEM_PROMPT = `You are a Senior Brand Strategist. Given the raw text scraped from a brand's landing page, produce a complete BRAND DNA DOCUMENT in markdown using EXACTLY the canonical section structure below. Every section is required.

Be specific and visual — these fields feed AI image generation, so vagueness ruins the output. Where the source page doesn't clearly state something (e.g. "Design Agency"), use "Unknown / in-house". For colors, infer from product/landing imagery if possible; otherwise use sensible warm-wellness defaults. The IMAGE GENERATION PROMPT MODIFIER at the bottom is the most important part — it is a single 50-75 word paragraph that gets prepended to every image prompt; it must encode the brand's exact colors (with hex), typography, photography direction, mood, and product physical description.

OUTPUT FORMAT (verbatim — match section headers exactly):

BRAND DNA DOCUMENT
==================

BRAND OVERVIEW
- Name:
- Tagline:
- Design Agency:
- Voice Adjectives [5]:
- Positioning:
- Competitive Differentiation:

VISUAL SYSTEM
- Primary Font:
- Secondary Font:
- Primary Color [hex]:
- Secondary Color [hex]:
- Accent Color [hex]:
- Background Colors:
- CTA Color and Style:

PHOTOGRAPHY DIRECTION
- Lighting:
- Color Grading:
- Composition:
- Subject Matter:
- Props and Surfaces:
- Mood:

PRODUCT DETAILS
- Physical Description:
- Label-Logo Placement:
- Distinctive Features:
- Packaging System:

AD CREATIVE STYLE
- Typical formats:
- Text overlay style:
- Photo vs illustration:
- UGC usage:
- Offer presentation:

IMAGE GENERATION PROMPT MODIFIER
[single 50-75 word paragraph here]
`

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}

async function callGemini(prompt: string): Promise<string> {
  const url = `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${gKey()}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as GeminiResponse
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!text.trim()) throw new Error('Gemini returned empty content')
  return text.trim()
}

/** Extract the IMAGE GENERATION PROMPT MODIFIER paragraph from a brand-dna.md string. */
export function extractPromptModifier(md: string): string {
  // Look for the section header and grab everything after it until blank line at top-level
  const m = md.match(/IMAGE GENERATION PROMPT MODIFIER\s*\n+([\s\S]+?)(\n\n[A-Z][A-Z ]{4,}\n|\Z|$)/)
  if (m) return m[1].trim()
  // Fallback: last paragraph
  const paras = md
    .trim()
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return paras[paras.length - 1] || ''
}

export interface BuildBrandDnaResult {
  slug: string
  name: string
  landing_url: string
  brand_dna_md: string
  prompt_modifier: string
  candidate_product_image_urls: string[]
}

/**
 * Build a draft brand DNA from a landing-page URL.
 * - Fetches the page text
 * - Tries Shopify product.json for product images
 * - Sends digest to Gemini for structured DNA synthesis
 * - Returns draft markdown + extracted modifier + candidate images
 */
export async function buildBrandDnaFromUrl(landing_url: string): Promise<BuildBrandDnaResult> {
  if (!/^https?:\/\//.test(landing_url)) {
    throw new Error('landing_url must start with http(s)://')
  }
  const [{ title, text }, productImages] = await Promise.all([
    fetchPageDigest(landing_url),
    tryShopifyProductImages(landing_url),
  ])

  const slug = deriveSlug(landing_url)
  const name = title.split('|')[0]?.split('–')[0]?.trim() || deriveName(landing_url)

  const userPrompt = `${SYSTEM_PROMPT}

---

LANDING PAGE URL: ${landing_url}
PAGE TITLE: ${title}

PAGE TEXT (excerpt, may be truncated):
${text}

---

Now produce the BRAND DNA DOCUMENT in markdown. Do not include any commentary before or after — only the document itself.`

  const md = await callGemini(userPrompt)
  const prompt_modifier = extractPromptModifier(md)

  return {
    slug,
    name,
    landing_url,
    brand_dna_md: md,
    prompt_modifier,
    candidate_product_image_urls: productImages,
  }
}
