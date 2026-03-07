'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreVertical, Trash2, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Asset } from '@/lib/types'

interface AssetCardProps {
  asset: Asset
  onDelete?: () => void
  onSelect?: (asset: Asset) => void
}

export function AssetCard({ asset, onDelete, onSelect }: AssetCardProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const bucket = asset.type === 'video' ? 'videos' : 'images'
      const fileName = asset.file_url.split('/').pop()
      if (fileName) {
        await supabase.storage.from(bucket).remove([fileName])
      }
      await supabase.from('assets').delete().eq('id', asset.id)
      onDelete?.()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="group overflow-hidden cursor-pointer" onClick={() => onSelect?.(asset)}>
      <div className="relative aspect-video bg-muted">
        {asset.type === 'video' ? (
          <>
            <video
              src={asset.file_url}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
              onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
              onMouseOut={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-black/50 rounded-full p-3">
                <Play className="h-6 w-6 text-white fill-white" />
              </div>
            </div>
          </>
        ) : (
          <img
            src={asset.file_url}
            alt={asset.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="secondary" size="icon" className="h-8 w-8" />}>
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDelete} disabled={deleting} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant={asset.source === 'spy' ? 'destructive' : 'default'} className="text-xs">
            {asset.source === 'spy' ? 'Spy' : 'Own'}
          </Badge>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{asset.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          {asset.brand && (
            <span className="text-xs text-muted-foreground">{asset.brand}</span>
          )}
          {asset.tool_used && (
            <Badge variant="outline" className="text-xs">{asset.tool_used}</Badge>
          )}
        </div>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {asset.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
            {asset.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">+{asset.tags.length - 3}</Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
