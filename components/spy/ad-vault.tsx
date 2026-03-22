'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SpyAd, SpyBrand } from '@/lib/spy-types'
import { SpyAdCard } from './spy-ad-card'
import { SpyFilterBar, type SpyFilters } from './spy-filter-bar'
import { AdDetailDialog } from './ad-detail-dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'

const defaultFilters: SpyFilters = {
  search: '',
  brand_id: '',
  creative_type: '',
  asset_type: '',
  visual_format: '',
  messaging_angle: '',
  hook_tactic: '',
  offer_type: '',
  sort: '',
}

export function AdVault() {
  const [ads, setAds] = useState<SpyAd[]>([])
  const [brands, setBrands] = useState<SpyBrand[]>([])
  const [filters, setFilters] = useState<SpyFilters>(defaultFilters)
  const [selectedAd, setSelectedAd] = useState<SpyAd | null>(null)
  const [loading, setLoading] = useState(true)
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [adsRes, brandsRes] = await Promise.all([
      supabase.from('spy_ads').select('*, spy_brands(brand_name)').order('created_at', { ascending: false }),
      supabase.from('spy_brands').select('*').order('brand_name'),
    ])

    const adsWithBrand = (adsRes.data || []).map((ad) => ({
      ...ad,
      brand_name: (ad.spy_brands as { brand_name: string } | null)?.brand_name || undefined,
    }))

    setAds(adsWithBrand)
    setBrands(brandsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleBatchAnalyze = async () => {
    setBatchAnalyzing(true)
    try {
      await fetch('/api/spy/analyze-batch', { method: 'POST' })
      fetchData()
    } catch (err) {
      console.error('Batch analyze failed:', err)
    }
    setBatchAnalyzing(false)
  }

  // Apply filters
  let filtered = [...ads]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (a) =>
        a.headline?.toLowerCase().includes(q) ||
        a.ad_copy?.toLowerCase().includes(q) ||
        a.brand_name?.toLowerCase().includes(q)
    )
  }
  if (filters.brand_id) {
    filtered = filtered.filter((a) => a.brand_id === filters.brand_id)
  }
  if (filters.creative_type) {
    filtered = filtered.filter((a) => a.creative_type === filters.creative_type)
  }
  if (filters.asset_type) {
    filtered = filtered.filter((a) => a.asset_type === filters.asset_type)
  }
  if (filters.visual_format) {
    filtered = filtered.filter((a) => a.visual_format === filters.visual_format)
  }
  if (filters.messaging_angle) {
    filtered = filtered.filter((a) => a.messaging_angle === filters.messaging_angle)
  }
  if (filters.hook_tactic) {
    filtered = filtered.filter((a) => a.hook_tactic === filters.hook_tactic)
  }
  if (filters.offer_type) {
    filtered = filtered.filter((a) => a.offer_type === filters.offer_type)
  }

  // Sort
  switch (filters.sort) {
    case 'Oldest':
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      break
    case 'Most Weeks':
      filtered.sort((a, b) => b.weeks_in_top10 - a.weeks_in_top10)
      break
    case 'Rank':
      filtered.sort((a, b) => (a.rank || 99) - (b.rank || 99))
      break
    // Default: newest first (already sorted by query)
  }

  const unanalyzedCount = ads.filter((a) => !a.asset_type).length

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} ads</p>
        {unanalyzedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchAnalyze}
            disabled={batchAnalyzing}
          >
            {batchAnalyzing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            Analyze All ({unanalyzedCount})
          </Button>
        )}
      </div>

      <SpyFilterBar filters={filters} onChange={setFilters} brands={brands} />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-video rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {ads.length === 0 ? 'No ads yet. Scrape a brand to populate the vault.' : 'No ads match your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((ad) => (
            <SpyAdCard
              key={ad.id}
              ad={ad}
              onClick={() => setSelectedAd(ad)}
              onBookmarkToggle={fetchData}
            />
          ))}
        </div>
      )}

      <AdDetailDialog
        ad={selectedAd}
        open={!!selectedAd}
        onOpenChange={(open) => !open && setSelectedAd(null)}
        onAnalyzed={fetchData}
      />
    </div>
  )
}
