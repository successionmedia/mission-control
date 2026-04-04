'use client'

import { useState, useCallback, FormEvent } from 'react'
import { Upload, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { BoardVideo } from '@/lib/board-types'

interface BoardUploadDialogProps {
  boardId: string
  onUploaded: (video: BoardVideo) => void
}

export function BoardUploadDialog({ boardId, onUploaded }: BoardUploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    if (notes) formData.append('notes', notes)

    const res = await fetch(`/api/boards/${boardId}/videos`, {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const video = await res.json()
      onUploaded(video)
      setOpen(false)
      setFile(null)
      setTitle('')
      setNotes('')
    }
    setUploading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Video
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Inspiration Video</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
              file && 'border-green-500 bg-green-500/5'
            )}
            onClick={() => document.getElementById('board-file-input')?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm truncate max-w-xs">{file.name}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drag & drop or click to browse</p>
                <p className="text-xs text-muted-foreground/60 mt-1">MP4, MOV, WebM</p>
              </div>
            )}
            <input
              id="board-file-input"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. UGC Hook Reference — Speaking to camera"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What makes this video good? What should creators take from it?"
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={!file || !title.trim() || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
