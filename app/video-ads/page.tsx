'use client'

import { AssetGrid } from '@/components/asset-grid'

export default function VideoAdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Video Ads</h1>
        <p className="text-muted-foreground">Manage your video ad creatives</p>
      </div>
      <AssetGrid type="video" />
    </div>
  )
}
