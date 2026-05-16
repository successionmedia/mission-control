'use client'

import { Download, RotateCcw, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface AdFactoryJobResult {
  number: number
  name: string
  status: 'queued' | 'generating' | 'success' | 'fail'
  kie_task_id?: string
  image_url?: string
  error?: string
}

export interface AdFactoryJob {
  id: string
  campaign_name: string
  brand_slug: string
  status: 'pending' | 'generating' | 'completed' | 'partial' | 'failed'
  output_type: string
  aspect_ratio: string
  resolution: string
  total_prompts: number
  completed_prompts: number
  results: AdFactoryJobResult[]
  error_message?: string
  created_at: string
}

interface Props {
  job: AdFactoryJob
  onRetry: () => void
}

function StatusBadge({ status }: { status: AdFactoryJob['status'] }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
    generating: { label: 'Generating', className: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Complete', className: 'bg-green-100 text-green-700' },
    partial: { label: 'Partial', className: 'bg-yellow-100 text-yellow-700' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  }
  const entry = map[status] || map.pending
  return <Badge className={entry.className}>{entry.label}</Badge>
}

function ResultTile({ r }: { r: AdFactoryJobResult }) {
  if (r.status === 'success' && r.image_url) {
    return (
      <a
        href={r.image_url}
        target="_blank"
        rel="noreferrer"
        className="relative aspect-square rounded-lg overflow-hidden border bg-muted block group"
        title={`#${r.number} ${r.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
          #{r.number} {r.name}
        </div>
      </a>
    )
  }
  if (r.status === 'fail') {
    return (
      <div
        className="relative aspect-square rounded-lg border-2 border-dashed border-red-300 bg-red-50/50 flex flex-col items-center justify-center p-2 text-center"
        title={r.error}
      >
        <XCircle className="h-5 w-5 text-red-600" />
        <div className="text-[10px] text-red-700 mt-1 line-clamp-2">{r.name}</div>
      </div>
    )
  }
  if (r.status === 'generating') {
    return (
      <div className="relative aspect-square rounded-lg border bg-muted/30 flex flex-col items-center justify-center p-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2 text-center">
          #{r.number} {r.name}
        </div>
      </div>
    )
  }
  return (
    <div className="relative aspect-square rounded-lg border bg-muted/20 flex flex-col items-center justify-center p-2">
      <Clock className="h-5 w-5 text-muted-foreground" />
      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2 text-center">
        #{r.number} {r.name}
      </div>
    </div>
  )
}

export function AdFactoryJobCard({ job, onRetry }: Props) {
  const hasFailed = job.results.some((r) => r.status === 'fail')
  const hasSuccess = job.results.some((r) => r.status === 'success')
  const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'partial'

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{job.campaign_name}</h3>
            <StatusBadge status={job.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {job.brand_slug} · {job.output_type.replace('_', ' ')} · {job.aspect_ratio} · {job.resolution}
            <span className="mx-1.5">·</span>
            {new Date(job.created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasFailed && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retry failed
            </Button>
          )}
          {hasSuccess && isTerminal && (
            <a
              href={`/api/automations/ad-factory/${job.id}/download`}
              download
              className="inline-flex items-center gap-1.5 text-sm h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-3.5 w-3.5" />
              Zip
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        <span className="text-muted-foreground">
          {job.completed_prompts}/{job.total_prompts} complete
        </span>
        {job.error_message && (
          <span className="text-muted-foreground truncate">· {job.error_message}</span>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
        {job.results.map((r) => (
          <ResultTile key={r.number} r={r} />
        ))}
      </div>
    </Card>
  )
}
