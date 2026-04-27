'use client'

import { useEffect, useState } from 'react'
import { LipsyncForm } from '@/components/automations/lipsync-form'
import { LipsyncJobCard, type LipsyncJob } from '@/components/automations/lipsync-job-card'

export default function LipsyncPage() {
  const [jobs, setJobs] = useState<LipsyncJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/automations/lipsync')
        const data = await r.json()
        setJobs(data.jobs ?? [])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function handleCreated(job: LipsyncJob) {
    setJobs((prev) => [job, ...prev])
  }

  function handleUpdate(updated: LipsyncJob) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)))
  }

  function handleDelete(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Lipsync</h1>
        <p className="text-muted-foreground">
          Drop an ElevenLabs voiceover and a character image — we&apos;ll lipsync them together via WaveSpeed InfiniteTalk.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <LipsyncForm onCreated={handleCreated} />
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Recent jobs</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet — submit one above.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <LipsyncJobCard
                key={job.id}
                job={job}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
