'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { Asset } from '@/lib/types'

interface ImageLightboxProps {
  asset: Asset
  onClose: () => void
}

export function ImageLightbox({ asset, onClose }: ImageLightboxProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{asset.title}</DialogTitle>
        </DialogHeader>
        <img
          src={asset.file_url}
          alt={asset.title}
          className="w-full rounded-lg"
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant={asset.source === 'spy' ? 'destructive' : 'default'}>
            {asset.source === 'spy' ? 'Spy' : 'Own'}
          </Badge>
          {asset.brand && <Badge variant="outline">{asset.brand}</Badge>}
          {asset.tool_used && <Badge variant="secondary">{asset.tool_used}</Badge>}
          {asset.tags.map((tag) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
        {asset.notes && (
          <p className="text-sm text-muted-foreground mt-2">{asset.notes}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
