'use client'

import { useState, useCallback } from 'react'
import type { SpyAd } from '@/lib/spy-types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SpyAdCardProps {
  ad: SpyAd
  onBookmarkToggle?: () => void
  onClick?: () => void
}

export function SpyAdCard({ ad, onBookmarkToggle, onClick }: SpyAdCardProps) {
  const [bookmarked, setBookmarked] = useState(ad.bookmarked)
  const [imgError, setImgError] = useState(false)
  const handleImgError = useCallback(() => setImgError(true), [])

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newVal = !bookmarked
    setBookmarked(newVal)
    await supabase.from('spy_ads').update({ bookmarked: newVal }).eq('id', ad.id)
    onBookmarkToggle?.()
  }

  return (
    <Card
      className="cursor-pointer group overflow-hidden hover:ring-1 hover:ring-primary/20 transition-all"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-muted relative overflow-hidden">
        {ad.creative_url && !imgError ? (
          <img
            src={ad.creative_url}
            alt={ad.headline || 'Ad creative'}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={handleImgError}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-1">
            <span className="text-2xl">{ad.creative_type === 'video' ? '▶' : '🖼'}</span>
            <span>{ad.brand_name || 'No preview'}</span>
          </div>
        )}
        {/* Rank badge */}
        {ad.rank && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">
            #{ad.rank}
          </div>
        )}
        {/* Media type badge */}
        <div className="absolute top-2 right-2">
          <Badge variant={ad.creative_type === 'video' ? 'default' : 'secondary'}>
            {ad.creative_type}
          </Badge>
        </div>
        {/* Bookmark button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
          onClick={toggleBookmark}
        >
          {bookmarked ? (
            <BookmarkCheck className="h-4 w-4 text-amber-400" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Brand name */}
        {ad.brand_name && (
          <p className="text-xs text-muted-foreground font-medium">{ad.brand_name}</p>
        )}

        {/* Headline */}
        {ad.headline && (
          <p className="text-sm font-medium line-clamp-2">{ad.headline}</p>
        )}

        {/* AI Tags */}
        {ad.asset_type && (
          <div className="flex flex-wrap gap-1">
            {ad.asset_type && <Badge variant="outline" className="text-[10px]">{ad.asset_type}</Badge>}
            {ad.messaging_angle && <Badge variant="outline" className="text-[10px]">{ad.messaging_angle}</Badge>}
            {ad.hook_tactic && <Badge variant="outline" className="text-[10px]">{ad.hook_tactic}</Badge>}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{ad.weeks_in_top10}w in top 10</span>
          {ad.ad_library_link && (
            <a
              href={ad.ad_library_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 hover:text-foreground" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
