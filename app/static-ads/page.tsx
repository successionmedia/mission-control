'use client'

import { AssetGrid } from '@/components/asset-grid'

export default function StaticAdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Static Ads</h1>
        <p className="text-muted-foreground">Manage your static ad creatives</p>
      </div>
      <AssetGrid type="static" />
    </div>
  )
}
