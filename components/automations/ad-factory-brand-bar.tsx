'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface BrandRow {
  slug: string
  name: string
  landing_url: string | null
  brand_dna_md: string
  prompt_modifier: string
  product_image_urls: string[]
}

interface AdFactoryBrandBarProps {
  selectedSlug: string | null
  onSelect: (brand: BrandRow | null) => void
}

export function AdFactoryBrandBar({ selectedSlug, onSelect }: AdFactoryBrandBarProps) {
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'existing' | 'new'>('existing')

  // New-brand flow state
  const [landingUrl, setLandingUrl] = useState('')
  const [building, setBuilding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftSlug, setDraftSlug] = useState('')
  const [draftMd, setDraftMd] = useState('')
  const [draftCandidates, setDraftCandidates] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBrands = async () => {
    try {
      const r = await fetch('/api/automations/ad-factory/brands')
      const data = await r.json()
      setBrands(data.brands ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBrands()
  }, [])

  const buildDraft = async () => {
    if (!landingUrl.trim()) return
    setBuilding(true)
    setError(null)
    setDraftMd('')
    try {
      const r = await fetch('/api/automations/ad-factory/brands/build-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landing_url: landingUrl.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Build failed')
      setDraftName(data.name)
      setDraftSlug(data.slug)
      setDraftMd(data.brand_dna_md)
      setDraftCandidates(data.candidate_product_image_urls || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build failed')
    } finally {
      setBuilding(false)
    }
  }

  const saveBrand = async () => {
    if (!draftSlug || !draftName || !draftMd.trim()) return
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/automations/ad-factory/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: draftSlug,
          name: draftName,
          landing_url: landingUrl,
          brand_dna_md: draftMd,
          product_image_urls: draftCandidates,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Save failed')
      await loadBrands()
      onSelect(data)
      setTab('existing')
      // Reset draft state
      setLandingUrl('')
      setDraftMd('')
      setDraftName('')
      setDraftSlug('')
      setDraftCandidates([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'existing' | 'new')}>
        <TabsList>
          <TabsTrigger value="existing">
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Use existing brand
          </TabsTrigger>
          <TabsTrigger value="new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Build new brand
          </TabsTrigger>
        </TabsList>

        <TabsContent value="existing" className="space-y-3 mt-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading brands…</div>
          ) : brands.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No brands yet. Switch to <strong>Build new brand</strong> to create one.
            </div>
          ) : (
            <div>
              <Label htmlFor="brand-select" className="text-sm font-medium">
                Brand
              </Label>
              <Select
                value={selectedSlug ?? undefined}
                onValueChange={(slug) => {
                  const b = brands.find((x) => x.slug === slug) || null
                  onSelect(b)
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a brand…" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSlug && (() => {
                const b = brands.find((x) => x.slug === selectedSlug)
                if (!b) return null
                return (
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <div>
                      <strong>Modifier preview:</strong> {b.prompt_modifier.slice(0, 200)}
                      {b.prompt_modifier.length > 200 ? '…' : ''}
                    </div>
                    {b.product_image_urls?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {b.product_image_urls.slice(0, 5).map((u) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={u} src={u} alt="product" className="h-12 w-12 object-cover rounded border" />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-4 mt-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="landing-url" className="text-sm font-medium">
                Landing page URL
              </Label>
              <Input
                id="landing-url"
                placeholder="https://yourbrand.com/products/hero-sku"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button onClick={buildDraft} disabled={!landingUrl.trim() || building}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {building ? 'Building…' : 'Build Brand DNA'}
            </Button>
          </div>

          {draftMd && (
            <div className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="draft-name">Name</Label>
                  <Input
                    id="draft-name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="draft-slug">Slug</Label>
                  <Input
                    id="draft-slug"
                    value={draftSlug}
                    onChange={(e) => setDraftSlug(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="draft-md">Brand DNA (editable)</Label>
                <Textarea
                  id="draft-md"
                  value={draftMd}
                  onChange={(e) => setDraftMd(e.target.value)}
                  rows={16}
                  className="mt-1.5 font-mono text-xs"
                />
              </div>

              {draftCandidates.length > 0 && (
                <div>
                  <Label className="text-sm">Auto-extracted product images</Label>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {draftCandidates.map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={u} src={u} alt="product candidate" className="h-16 w-16 object-cover rounded border" />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    These will be saved as the brand&apos;s default product references.
                  </p>
                </div>
              )}

              <Button onClick={saveBrand} disabled={saving}>
                {saving ? 'Saving…' : 'Save brand'}
              </Button>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive border border-destructive/30 rounded p-2 bg-destructive/5">
              {error}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  )
}
