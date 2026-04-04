// lib/board-types.ts
export interface Board {
  id: string
  name: string
  description: string | null
  share_token: string
  created_at: string
}

export interface BoardVideo {
  id: string
  board_id: string
  title: string
  file_url: string
  notes: string | null
  created_at: string
}
