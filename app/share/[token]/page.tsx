'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Eye, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BoardVideoCard } from '@/components/boards/board-video-card'
import { BoardVideoLightbox } from '@/components/boards/board-video-lightbox'
import type { Board, BoardVideo } from '@/lib/board-types'

export default function ShareBoardPage() {
  const { token } = useParams<{ token: string }>()
  const [board, setBoard] = useState<Board | null>(null)
  const [videos, setVideos] = useState<BoardVideo[]>([])
  const [active, setActive] = useState<BoardVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: boardData, error } = await supabase
        .from('boards')
        .select('*')
        .eq('share_token', token)
        .single()

      if (error || !boardData) { setNotFound(true); setLoading(false); return }

      const { data: videosData } = await supabase
        .from('board_videos')
        .select('*')
        .eq('board_id', boardData.id)
        .order('created_at', { ascending: false })

      setBoard(boardData)
      setVideos(videosData || [])
      setLoading(false)
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading board...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-xl font-semibold">Board not found</p>
        <p className="text-muted-foreground text-sm">This link may be invalid or expired.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-3">
        <Eye className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm text-muted-foreground">Mission Control</span>
        <span className="text-muted-foreground/40">·</span>
        <h1 className="font-bold">{board!.name}</h1>
        {board!.description && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <p className="text-sm text-muted-foreground">{board!.description}</p>
          </>
        )}
      </header>

      <main className="p-6">
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Play className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No videos on this board yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {videos.map((video) => (
              <BoardVideoCard
                key={video.id}
                video={video}
                onClick={() => setActive(video)}
                showDelete={false}
              />
            ))}
          </div>
        )}
      </main>

      {active && <BoardVideoLightbox video={active} onClose={() => setActive(null)} />}
    </div>
  )
}
