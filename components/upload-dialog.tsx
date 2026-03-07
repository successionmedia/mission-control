'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { AssetType, AssetSource } from '@/lib/types'

interface UploadDialogProps {
  defaultType?: AssetType
  onUploadComplete?: () => void
  children?: React.ReactNode
}

export function UploadDialog({ defaultType, onUploadComplete, children }: UploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState({
    title: '',
    type: defaultType || ('video' as AssetType),
    source: 'own' as AssetSource,
    brand: '',
    tags: '',
    tool_used: '',
    notes: '',
  })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    try {
      const isVideo = form.type === 'video'
      const bucket = isVideo ? 'videos' : 'images'
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const { error: insertError } = await supabase.from('assets').insert({
        type: form.type,
        source: form.source,
        title: form.title,
        brand: form.brand || null,
        tags,
        tool_used: form.tool_used || null,
        notes: form.notes || null,
        file_url: publicUrl,
      })

      if (insertError) throw insertError

      setOpen(false)
      setFile(null)
      setForm({ title: '', type: defaultType || 'video', source: 'own', brand: '', tags: '', tool_used: '', notes: '' })
      onUploadComplete?.()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children ? <span /> : <Button />}>
        {children || (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Asset</DialogTitle>
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
            onClick={() => document.getElementById('file-input')?.click()}
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
              </div>
            )}
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept={form.type === 'video' ? 'video/*' : 'image/*'}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => { if (v) setForm({ ...form, type: v as AssetType }) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="static">Static</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => { if (v) setForm({ ...form, source: v as AssetSource }) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">Own Creation</SelectItem>
                  <SelectItem value="spy">Competitor (Spy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ad creative title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g. Nutrotonic"
              />
            </div>
            <div className="space-y-2">
              <Label>Tool Used</Label>
              <Select value={form.tool_used} onValueChange={(v) => { if (v) setForm({ ...form, tool_used: v }) }}>
                <SelectTrigger><SelectValue placeholder="Select tool" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAR">STAR</SelectItem>
                  <SelectItem value="Hemingway">Hemingway</SelectItem>
                  <SelectItem value="Sora">Sora</SelectItem>
                  <SelectItem value="Bond">Bond</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags (comma separated)</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="e.g. shilajit, supplement, UGC"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes about this creative..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={!file || !form.title || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

