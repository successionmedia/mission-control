'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, Trash2, ExternalLink, MoreHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Board } from '@/lib/board-types'

interface BoardCardProps {
  board: Board
  onDelete: (id: string) => void
}

export function BoardCard({ board, onDelete }: BoardCardProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete board "${board.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/boards/${board.id}`, { method: 'DELETE' })
    onDelete(board.id)
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/${board.share_token}`
    : `/share/${board.share_token}`

  return (
    <Card className="group relative hover:border-primary/50 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/boards/${board.id}`} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{board.name}</h3>
              {board.description && (
                <p className="text-sm text-muted-foreground truncate">{board.description}</p>
              )}
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(shareUrl)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Copy share link
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
