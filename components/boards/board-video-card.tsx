'use client'

import { useState, useRef } from 'react'
import { Trash2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BoardVideo } from '@/lib/board-types'

interface BoardVideoCardProps {
  video: BoardVideo
  onClick: () => void
  onDelete?: (id: string) => void
  showDelete?: boolean
}

export function BoardVideoCard({ video, onClick, onDelete, showDelete = false }: BoardVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovered, setHovered] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleMouseEnter() {
    setHovered(true)
    videoRef.current?.play()
  }

  function handleMouseLeave() {
    setHovered(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${video.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/boards/${video.board_id}/videos/${video.id}`, { method: 'DELETE' })
    onDelete?.(video.id)
  }

  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-muted cursor-pointer aspect-[9/16]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <video
        ref={videoRef}
        src={video.file_url}
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />

      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="p-3 rounded-full bg-black/50 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white fill-white" />
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white text-sm font-medium leading-tight line-clamp-2">{video.title}</p>
        {video.notes && (
          <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{video.notes}</p>
        )}
      </div>

      {showDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
