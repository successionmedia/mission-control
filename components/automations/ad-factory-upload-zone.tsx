'use client'

import { useCallback, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const BUCKET = 'ad-factory'

async function uploadOne(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON}`,
      apikey: SUPABASE_ANON,
      'x-upsert': 'true',
      'Content-Type': file.type || 'image/png',
    },
    body: file,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Upload failed: ${text.slice(0, 200)}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

interface AdFactoryUploadZoneProps {
  label: string
  hint?: string
  max?: number
  value: string[]
  onChange: (urls: string[]) => void
}

export function AdFactoryUploadZone({
  label,
  hint,
  max = 5,
  value,
  onChange,
}: AdFactoryUploadZoneProps) {
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(
    async (files: File[]) => {
      const room = max - value.length
      if (room <= 0) return
      const slice = files.slice(0, room).filter((f) => f.type.startsWith('image/'))
      if (slice.length === 0) return
      setUploading(true)
      setError(null)
      try {
        const uploaded = await Promise.all(slice.map(uploadOne))
        onChange([...value, ...uploaded])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [max, value, onChange]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{max}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          handleFiles(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 transition-colors',
          drag ? 'border-primary bg-primary/5' : 'border-border'
        )}
      >
        {value.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {value.map((url, i) => (
              <div key={url + i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`upload ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-md border"
                />
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 bg-background border rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex flex-col items-center justify-center gap-2 py-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          <Upload className="h-5 w-5" />
          <span className="text-sm">
            {uploading
              ? 'Uploading…'
              : value.length >= max
                ? `Max ${max} files`
                : 'Click or drop images here'}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading || value.length >= max}
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
        </label>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
