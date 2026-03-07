'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Asset, AssetType, AssetSource } from '@/lib/types'
import { AssetCard } from './asset-card'
import { FilterBar } from './filter-bar'
import { UploadDialog } from './upload-dialog'
import { VideoPlayer } from './video-player'
import { ImageLightbox } from './image-lightbox'

interface AssetGridProps {
  type: AssetType
}

export function AssetGrid({ type }: AssetGridProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<AssetSource | 'all'>('all')
  const [toolFilter, setToolFilter] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  const fetchAssets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false })

    if (!error && data) setAssets(data)
    setLoading(false)
  }

  useEffect(() => { fetchAssets() }, [type])

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (source !== 'all' && a.source !== source) return false
      if (toolFilter !== 'all' && a.tool_used !== toolFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          a.title.toLowerCase().includes(q) ||
          a.brand?.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [assets, source, toolFilter, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          source={source}
          onSourceChange={setSource}
          toolFilter={toolFilter}
          onToolFilterChange={setToolFilter}
        />
        <UploadDialog defaultType={type} onUploadComplete={fetchAssets} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No {type === 'video' ? 'video' : 'static'} ads found</p>
          <p className="text-sm mt-1">Upload your first creative to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onDelete={fetchAssets}
              onSelect={setSelectedAsset}
            />
          ))}
        </div>
      )}

      {selectedAsset && type === 'video' && (
        <VideoPlayer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
      {selectedAsset && type === 'static' && (
        <ImageLightbox asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  )
}
