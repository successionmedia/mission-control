'use client'

import { useState, useCallback, FormEvent } from 'react'
import { Upload, X, Mic, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type LipsyncJob = {
  id: string
  status: string
}

interface LipsyncFormProps {
  onCreated: (job: LipsyncJob) => void
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function uploadToBucket(bucket: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON}`,
      apikey: SUPABASE_ANON,
      'x-upsert': 'true',
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Upload to ${bucket} failed: ${text}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

export function LipsyncForm({ onCreated }: LipsyncFormProps) {
  const [audio, setAudio] = useState<File | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [resolution, setResolution] = useState<'480p' | '720p'>('480p')
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [audioDrag, setAudioDrag] = useState(false)
  const [imageDrag, setImageDrag] = useState(false)

  const onAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setAudioDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) setAudio(f)
  }, [])

  const onImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setImageDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) setImage(f)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!audio || !image) return
    setSubmitting(true)
    setError(null)
    try {
      setStage('Uploading audio…')
      const audioUrl = await uploadToBucket('lipsync-audio', audio)
      setStage('Uploading image…')
      const imageUrl = await uploadToBucket('lipsync-images', image)
      setStage('Submitting to WaveSpeed…')

      const res = await fetch('/api/automations/lipsync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          image_url: imageUrl,
          title: title.trim() || null,
          resolution,
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to start job')

      onCreated(j)
      setAudio(null)
      setImage(null)
      setTitle('')
      setStage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const ready = audio && image && !submitting

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Audio drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setAudioDrag(true) }}
          onDragLeave={() => setAudioDrag(false)}
          onDrop={onAudioDrop}
          onClick={() => document.getElementById('lipsync-audio-input')?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors min-h-[160px] flex items-center justify-center',
            audioDrag ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            audio && 'border-green-500 bg-green-500/5'
          )}
        >
          {audio ? (
            <div className="flex items-center justify-center gap-2">
              <Mic className="h-4 w-4 text-green-600" />
              <span className="text-sm truncate max-w-[200px]">{audio.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setAudio(null) }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div>
              <Mic className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">ElevenLabs voiceover</p>
              <p className="text-xs text-muted-foreground/60 mt-1">MP3, WAV — drag or click</p>
            </div>
          )}
          <input
            id="lipsync-audio-input"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setAudio(e.target.files?.[0] || null)}
          />
        </div>

        {/* Image drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setImageDrag(true) }}
          onDragLeave={() => setImageDrag(false)}
          onDrop={onImageDrop}
          onClick={() => document.getElementById('lipsync-image-input')?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors min-h-[160px] flex items-center justify-center',
            imageDrag ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            image && 'border-green-500 bg-green-500/5'
          )}
        >
          {image ? (
            <div className="flex items-center justify-center gap-2">
              <ImageIcon className="h-4 w-4 text-green-600" />
              <span className="text-sm truncate max-w-[200px]">{image.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setImage(null) }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div>
              <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Character image</p>
              <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG — drag or click</p>
            </div>
          )}
          <input
            id="lipsync-image-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="lipsync-title">Title (optional)</Label>
          <Input
            id="lipsync-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. PC Fiber — UGC Hook 03"
          />
        </div>
        <div className="space-y-2">
          <Label>Resolution</Label>
          <div className="flex gap-2">
            {(['480p', '720p'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResolution(r)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
                  resolution === r
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-muted-foreground/25 hover:bg-muted'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!ready}>
          <Upload className="mr-2 h-4 w-4" />
          {submitting ? stage || 'Submitting…' : 'Generate lipsync video'}
        </Button>
        {submitting && stage && (
          <span className="text-sm text-muted-foreground">{stage}</span>
        )}
      </div>
    </form>
  )
}
