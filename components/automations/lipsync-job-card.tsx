'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Trash2, Download, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export type LipsyncJob = {
  id: string
  title: string | null
  audio_url: string
  image_url: string
  resolution: string
  wavespeed_task_id: string | null
  status: string
  result_video_url: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  upstream_status?: string
}

interface Props {
  job: LipsyncJob
  onUpdate: (j: LipsyncJob) => void
  onDelete: (id: string) => void
}

export function LipsyncJobCard({ job, onUpdate, onDelete }: Props) {
  const [dots, setDots] = useState('')
  const isTerminal = job.status === 'completed' || job.status === 'failed'

  useEffect(() => {
    if (isTerminal) return
    const dotI = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500)
    const pollI = setInterval(async () => {
      try {
        const r = await fetch(`/api/automations/lipsync/${job.id}`)
        if (!r.ok) return
        const data = await r.json()
        onUpdate(data)
      } catch {
        // ignore — next tick will retry
      }
    }, 5000)
    return () => {
      clearInterval(dotI)
      clearInterval(pollI)
    }
  }, [job.id, isTerminal, onUpdate])

  async function handleDelete() {
    if (!confirm('Delete this job?')) return
    await fetch(`/api/automations/lipsync/${job.id}`, { method: 'DELETE' })
    onDelete(job.id)
  }

  const created = new Date(job.created_at)
  const elapsedSec = Math.round((Date.now() - created.getTime()) / 1000)

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="shrink-0">
          {job.status === 'completed' && job.result_video_url ? (
            <video
              src={job.result_video_url}
              controls
              className="w-64 h-64 object-cover rounded-lg bg-black"
              poster={job.image_url}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.image_url}
              alt={job.title ?? 'lipsync source'}
              className="w-64 h-64 object-cover rounded-lg"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-medium truncate">
                {job.title || 'Lipsync job'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {job.resolution} · created {created.toLocaleString()}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Status */}
          {job.status === 'pending' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Queued{dots}</span>
            </div>
          )}

          {job.status === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Generating{dots}{' '}
                <span className="text-muted-foreground/60">
                  ({elapsedSec}s elapsed{job.upstream_status ? ` · ${job.upstream_status}` : ''})
                </span>
              </span>
            </div>
          )}

          {job.status === 'completed' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Ready</span>
              </div>
              {job.result_video_url && (
                <a
                  href={job.result_video_url}
                  download
                  className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
                >
                  <Download className="h-3 w-3" />
                  Download video
                </a>
              )}
            </div>
          )}

          {job.status === 'failed' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                <span>Failed</span>
              </div>
              {job.error_message && (
                <p className="text-xs text-destructive/80 break-words">
                  {job.error_message}
                </p>
              )}
            </div>
          )}

          {/* Inputs */}
          <div className="text-xs text-muted-foreground pt-1 border-t">
            <div className="truncate">
              <span className="text-muted-foreground/60">audio: </span>
              <a href={job.audio_url} className="hover:underline" target="_blank" rel="noreferrer">
                {job.audio_url.split('/').pop()}
              </a>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
