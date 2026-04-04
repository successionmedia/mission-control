'use client'

import { useState, useEffect } from 'react'
import { LayoutGrid } from 'lucide-react'
import { BoardCard } from '@/components/boards/board-card'
import { NewBoardDialog } from '@/components/boards/new-board-dialog'
import type { Board } from '@/lib/board-types'

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/boards')
      .then((r) => r.json())
      .then((data) => { setBoards(data); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boards</h1>
          <p className="text-muted-foreground">Creator inspiration boards</p>
        </div>
        <NewBoardDialog onCreated={(board) => setBoards([board, ...boards])} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No boards yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onDelete={(id) => setBoards(boards.filter((b) => b.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
