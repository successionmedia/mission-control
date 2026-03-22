'use client'

import { useState } from 'react'
import type { SpyAd } from '@/lib/spy-types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Sparkles, Loader2 } from 'lucide-react'

interface AdDetailDialogProps {
  ad: SpyAd | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAnalyzed?: () => void
}

export function AdDetailDialog({ ad, open, onOpenChange, onAnalyzed }: AdDetailDialogProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [tags, setTags] = useState<Record<string, string> | null>(null)

  if (!ad) return null

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/spy/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_id: ad.id }),
      })
      const data = await res.json()
      if (data.tags) {
        setTags(data.tags)
        onAnalyzed?.()
      }
    } catch (err) {
      console.error('Analyze failed:', err)
    }
    setAnalyzing(false)
  }

  const displayTags = tags || {
    asset_type: ad.asset_type,
    visual_format: ad.visual_format,
    messaging_angle: ad.messaging_angle,
    hook_tactic: ad.hook_tactic,
    offer_type: ad.offer_type,
  }

  const hasAnyTag = Object.values(displayTags).some(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ad.headline || 'Ad Detail'}
            {ad.rank && <Badge variant="outline">#{ad.rank}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Creative */}
          {ad.creative_url && (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {ad.video_url ? (
                <video
                  src={ad.video_url}
                  poster={ad.creative_url ?? undefined}
                  controls
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <img
                  src={ad.creative_url ?? undefined}
                  alt={ad.headline || 'Ad'}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          )}

          {/* Brand & Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            {ad.brand_name && <Badge>{ad.brand_name}</Badge>}
            <Badge variant="secondary">{ad.creative_type}</Badge>
            {ad.cta_type && <Badge variant="outline">{ad.cta_type}</Badge>}
            <span className="text-sm text-muted-foreground">
              {ad.weeks_in_top10} weeks in top 10
            </span>
            {ad.start_date && (
              <span className="text-sm text-muted-foreground">
                Running since {new Date(ad.start_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Ad Copy */}
          {ad.ad_copy && (
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Ad Copy</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ad.ad_copy}</p>
            </div>
          )}

          {/* AI Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">AI Analysis</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                {hasAnyTag ? 'Re-analyze' : 'Analyze'}
              </Button>
            </div>
            {hasAnyTag ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {displayTags.asset_type && (
                  <div><span className="text-muted-foreground">Asset Type:</span> {displayTags.asset_type}</div>
                )}
                {displayTags.visual_format && (
                  <div><span className="text-muted-foreground">Format:</span> {displayTags.visual_format}</div>
                )}
                {displayTags.messaging_angle && (
                  <div><span className="text-muted-foreground">Angle:</span> {displayTags.messaging_angle}</div>
                )}
                {displayTags.hook_tactic && (
                  <div><span className="text-muted-foreground">Hook:</span> {displayTags.hook_tactic}</div>
                )}
                {displayTags.offer_type && (
                  <div><span className="text-muted-foreground">Offer:</span> {displayTags.offer_type}</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not analyzed yet. Click Analyze to tag this ad with AI.
              </p>
            )}
          </div>

          {/* Actions */}
          {ad.ad_library_link && (
            <a
              href={ad.ad_library_link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink className="h-3 w-3 mr-1" />
                View in Ad Library
              </Button>
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
