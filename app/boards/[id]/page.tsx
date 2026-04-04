'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BoardUploadDialog } from '@/components/boards/board-upload-dialog'
import { BoardVideoCard } from '@/components/boards/board-video-card'
import { BoardVideoLightbox } from '@/components/boards/board-video-lightbox'
import type { Board, BoardVideo } from '@/lib/board-types'

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [board, setBoard] = useState<Board | null>(null)
  const [videos, setVideos] = useState<BoardVideo[]>([])
  const [active, setActive] = useState<BoardVideo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/boards/${id}`).then((r) => r.json()),
      fetch(`/api/boards/${id}/videos`).then((r) => r.json()),
    ]).then(([boardData, videosData]) => {
      setBoard(boardData)
      setVideos(videosData)
      setLoading(false)
    })
  }, [id])

  const shareUrl = board
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${board.share_token}`
    : ''

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="aspect-[9/16] bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!board) return <p className="text-muted-foreground">Board not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/boards')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{board.name}</h1>
            {board.description && (
              <p className="text-muted-foreground">{board.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Copy share link
          </Button>
          <BoardUploadDialog
            boardId={id}
            onUploaded={(video) => setVideos([video, ...videos])}
          />
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">No videos yet. Upload some inspiration.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {videos.map((video) => (
            <BoardVideoCard
              key={video.id}
              video={video}
              onClick={() => setActive(video)}
              onDelete={(vid) => setVideos(videos.filter((v) => v.id !== vid))}
              showDelete
            />
          ))}
        </div>
      )}

      {active && (
        <BoardVideoLightbox video={active} onClose={() => setActive(null)} />
      )}
    </div>
  )
}
