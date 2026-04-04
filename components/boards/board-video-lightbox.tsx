'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { BoardVideo } from '@/lib/board-types'

interface BoardVideoLightboxProps {
  video: BoardVideo
  onClose: () => void
}

export function BoardVideoLightbox({ video, onClose }: BoardVideoLightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        onClick={onClose}
      >
        <X className="h-5 w-5 text-white" />
      </button>

      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          src={video.file_url}
          controls
          autoPlay
          className="max-h-[85vh] max-w-[85vw] rounded-xl"
        />
        <div className="mt-3 text-center">
          <p className="text-white font-semibold">{video.title}</p>
          {video.notes && (
            <p className="text-white/60 text-sm mt-1">{video.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}
