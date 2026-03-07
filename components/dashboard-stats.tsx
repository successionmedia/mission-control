'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Video, Image, Eye, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Asset } from '@/lib/types'

export function DashboardStats() {
  const [stats, setStats] = useState({ videos: 0, statics: 0, spy: 0 })
  const [recent, setRecent] = useState<Asset[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setStats({
          videos: data.filter((a) => a.type === 'video').length,
          statics: data.filter((a) => a.type === 'static').length,
          spy: data.filter((a) => a.source === 'spy').length,
        })
        setRecent(data.slice(0, 5))
      }
    }
    load()
  }, [])

  const cards = [
    { title: 'Video Ads', value: stats.videos, icon: Video, color: 'text-blue-500' },
    { title: 'Static Ads', value: stats.statics, icon: Image, color: 'text-green-500' },
    { title: 'Spy Ads', value: stats.spy, icon: Eye, color: 'text-red-500' },
    { title: 'Total', value: stats.videos + stats.statics, icon: Clock, color: 'text-purple-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assets uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {recent.map((asset) => (
                <div key={asset.id} className="flex items-center gap-3">
                  <div className="h-10 w-16 rounded bg-muted overflow-hidden flex-shrink-0">
                    {asset.type === 'video' ? (
                      <video src={asset.file_url} className="w-full h-full object-cover" muted preload="metadata" />
                    ) : (
                      <img src={asset.file_url} alt={asset.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.type === 'video' ? 'Video' : 'Static'} &middot; {asset.source === 'spy' ? 'Spy' : 'Own'}
                      {asset.brand && ` &middot; ${asset.brand}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(asset.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
