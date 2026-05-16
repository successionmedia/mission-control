'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, ImageDown, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdFactoryBrandBar, type BrandRow } from '@/components/automations/ad-factory-brand-bar'
import { AdFactoryUploadZone } from '@/components/automations/ad-factory-upload-zone'
import { AdFactoryJobCard, type AdFactoryJob } from '@/components/automations/ad-factory-job-card'

const OUTPUT_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'static_ad', label: 'Static Ad', hint: 'Headline space + callout pills + product hero' },
  { value: 'lifestyle', label: 'Lifestyle', hint: 'Real-world setting, soft natural light, ambient props' },
  { value: 'product_shot', label: 'Product Shot', hint: 'Studio-lit, clean backdrop, product is the absolute focal point' },
]

const ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', 'auto'] as const
const RESOLUTIONS = ['1K', '2K', '4K'] as const

type AspectRatio = (typeof ASPECT_RATIOS)[number]
type Resolution = (typeof RESOLUTIONS)[number]

interface InputPrompt {
  number: number
  name: string
  prompt: string
  reason?: string
}

export default function AdFactoryPage() {
  // Form state
  const [campaignName, setCampaignName] = useState('')
  const [brand, setBrand] = useState<BrandRow | null>(null)
  const [outputType, setOutputType] = useState('static_ad')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [resolution, setResolution] = useState<Resolution>('2K')
  const [productImages, setProductImages] = useState<string[]>([])
  const [styleImages, setStyleImages] = useState<string[]>([])
  const [promptsText, setPromptsText] = useState('')
  const [parsedPrompts, setParsedPrompts] = useState<InputPrompt[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Jobs state
  const [jobs, setJobs] = useState<AdFactoryJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set())

  // When brand changes, pre-fill product images from brand defaults
  useEffect(() => {
    if (brand?.product_image_urls?.length && productImages.length === 0) {
      setProductImages(brand.product_image_urls)
    }
    // intentionally don't depend on productImages — only seed once on brand change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.slug])

  // Auto-clamp 1:1/auto resolution
  useEffect(() => {
    if ((aspectRatio === '1:1' || aspectRatio === 'auto') && resolution !== '1K') {
      setResolution('1K')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatio])

  // Load jobs
  const loadJobs = useCallback(async () => {
    try {
      const r = await fetch('/api/automations/ad-factory')
      const data = await r.json()
      const jobs: AdFactoryJob[] = data.jobs ?? []
      setJobs(jobs)
      // Start polling any in-flight job
      const active = jobs.filter((j) => j.status === 'generating' || j.status === 'pending')
      if (active.length > 0) {
        setPollingIds(new Set(active.map((j) => j.id)))
      }
    } finally {
      setLoadingJobs(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Poll one job
  const pollJob = useCallback(async (jobId: string) => {
    try {
      const r = await fetch(`/api/automations/ad-factory/${jobId}`)
      const data = await r.json()
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...data } : j)))
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'partial') {
        setPollingIds((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (pollingIds.size === 0) return
    const interval = setInterval(() => {
      pollingIds.forEach((id) => pollJob(id))
    }, 8000)
    return () => clearInterval(interval)
  }, [pollingIds, pollJob])

  // Parse prompts whenever the textarea changes
  useEffect(() => {
    if (!promptsText.trim()) {
      setParsedPrompts(null)
      setParseError(null)
      return
    }
    try {
      const parsed = JSON.parse(promptsText) as unknown
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
      const normalized: InputPrompt[] = parsed.map((p, i) => {
        if (typeof p !== 'object' || !p) throw new Error(`Item ${i + 1} is not an object`)
        const rec = p as Record<string, unknown>
        if (typeof rec.prompt !== 'string' || !rec.prompt.trim()) {
          throw new Error(`Item ${i + 1} is missing 'prompt'`)
        }
        return {
          number: typeof rec.number === 'number' ? rec.number : i + 1,
          name: typeof rec.name === 'string' && rec.name.trim() ? rec.name : `prompt-${i + 1}`,
          prompt: rec.prompt,
          reason: typeof rec.reason === 'string' ? rec.reason : undefined,
        }
      })
      setParsedPrompts(normalized)
      setParseError(null)
    } catch (e) {
      setParsedPrompts(null)
      setParseError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }, [promptsText])

  const handlePromptFile = async (file: File) => {
    const text = await file.text()
    setPromptsText(text)
  }

  const canSubmit = !!(
    campaignName.trim() &&
    brand?.slug &&
    parsedPrompts &&
    parsedPrompts.length > 0 &&
    !submitting
  )

  const handleSubmit = async () => {
    if (!canSubmit || !brand || !parsedPrompts) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const r = await fetch('/api/automations/ad-factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: campaignName,
          brand_slug: brand.slug,
          output_type: outputType,
          aspect_ratio: aspectRatio,
          resolution,
          product_image_urls: productImages,
          style_image_urls: styleImages,
          prompts: parsedPrompts,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Submit failed')
      // Prepend the new job and start polling
      setJobs((prev) => [data as AdFactoryJob, ...prev])
      if (data.status === 'generating' || data.status === 'pending') {
        setPollingIds((prev) => new Set(prev).add(data.id))
      }
      // Clear form (keep brand selected)
      setCampaignName('')
      setPromptsText('')
      setStyleImages([])
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = async (jobId: string) => {
    try {
      const r = await fetch(`/api/automations/ad-factory/${jobId}/retry`, { method: 'POST' })
      const data = await r.json()
      if (r.ok) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...data } : j)))
        setPollingIds((prev) => new Set(prev).add(jobId))
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Wand2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Ad Factory</h1>
          <p className="text-sm text-muted-foreground">
            Brand DNA-locked static ads via GPT Image 2 (Kie). Paste prompts.json, hit Generate.
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-5 space-y-5">
        {/* Campaign name */}
        <div>
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input
            id="campaign-name"
            placeholder="e.g. TryHerSkin 10 Reasons"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="mt-1.5"
          />
        </div>

        {/* Brand bar */}
        <AdFactoryBrandBar
          selectedSlug={brand?.slug || null}
          onSelect={(b) => {
            setBrand(b)
            if (b?.product_image_urls?.length) {
              setProductImages(b.product_image_urls)
            } else {
              setProductImages([])
            }
          }}
        />

        {/* Output type */}
        <div>
          <Label>Output type</Label>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {OUTPUT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setOutputType(t.value)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  outputType === t.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="font-medium text-sm">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Reference images */}
        <div className="grid sm:grid-cols-2 gap-4">
          <AdFactoryUploadZone
            label="Product reference images"
            hint="The actual product. 1-3 photos."
            max={3}
            value={productImages}
            onChange={setProductImages}
          />
          <AdFactoryUploadZone
            label="Style examples"
            hint="What you want the output to look like (lifestyle / static / hero, etc). 1-5 examples."
            max={5}
            value={styleImages}
            onChange={setStyleImages}
          />
        </div>

        {/* Prompts */}
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="prompts">
              Prompts (JSON array of {`{number, name, prompt}`})
            </Label>
            <label className="text-xs text-primary underline cursor-pointer">
              Upload .json
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handlePromptFile(f)
                }}
              />
            </label>
          </div>
          <Textarea
            id="prompts"
            value={promptsText}
            onChange={(e) => setPromptsText(e.target.value)}
            rows={8}
            placeholder='[{"number":1,"name":"hero-1","prompt":"..."}, ...]'
            className="mt-1.5 font-mono text-xs"
          />
          {parsedPrompts && (
            <div className="mt-2 text-xs text-muted-foreground">
              ✓ {parsedPrompts.length} prompts parsed · first: <em>{parsedPrompts[0].name}</em>
            </div>
          )}
          {parseError && (
            <div className="mt-2 text-xs text-destructive">{parseError}</div>
          )}
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Aspect ratio</Label>
            <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Resolution</Label>
            <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(aspectRatio === '1:1' || aspectRatio === 'auto') && (
              <p className="text-xs text-muted-foreground mt-1">
                1:1 and auto are capped at 1K by Kie.
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        {submitError && (
          <div className="text-sm text-destructive border border-destructive/30 rounded p-2 bg-destructive/5">
            {submitError}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            {submitting
              ? 'Submitting…'
              : parsedPrompts
                ? `Generate ${parsedPrompts.length} image${parsedPrompts.length === 1 ? '' : 's'}`
                : 'Generate'}
          </Button>
        </div>
      </Card>

      {/* Jobs list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageDown className="h-5 w-5" />
          <h2 className="font-semibold">Recent jobs</h2>
        </div>
        {loadingJobs ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No jobs yet. Pick a brand, paste prompts, and hit Generate.
          </p>
        ) : (
          jobs.map((job) => (
            <AdFactoryJobCard key={job.id} job={job} onRetry={() => handleRetry(job.id)} />
          ))
        )}
      </div>
    </div>
  )
}
