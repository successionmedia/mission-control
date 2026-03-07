'use client'

import { DashboardStats } from '@/components/dashboard-stats'
import { UploadDialog } from '@/components/upload-dialog'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your ad creatives</p>
        </div>
        <UploadDialog />
      </div>
      <DashboardStats />
    </div>
  )
}
