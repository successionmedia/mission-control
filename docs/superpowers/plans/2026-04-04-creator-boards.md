# Creator Boards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add creator-facing inspiration boards to Mission Control — public video boards accessible by creators via share link, while keeping all other routes team-only behind a password.

**Architecture:** Boards and their videos live in Supabase (`boards` + `board_videos` tables, `videos` bucket). All existing routes are protected by Next.js middleware checking a session cookie. Public `/share/[token]` routes bypass auth entirely and render without the sidebar. The root layout delegates sidebar rendering to an `AppShell` client component that checks the pathname.

**Tech Stack:** Next.js 16 App Router, Supabase (existing), TailwindCSS v4, shadcn/ui components (existing), Lucide icons (existing), Web Crypto API for auth hashing (no new deps)

---

## Setup: Supabase + Env

Before touching code, run this SQL in the Supabase SQL editor for the project at `aogkcnwsxnnxflzgyylq.supabase.co`:

```sql
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  share_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Also add these two lines to `.env.local`:
```
TEAM_PASSWORD=your-team-password-here
AUTH_SECRET=your-random-32-char-secret-here
```

Replace both values with something real before deploying.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `middleware.ts` | Create | Protect all routes except `/share/*`, `/login`, `/api/auth/*` |
| `app/login/page.tsx` | Create | Password login page |
| `app/api/auth/login/route.ts` | Create | POST: verify password, set session cookie |
| `app/api/auth/logout/route.ts` | Create | POST: clear session cookie |
| `app/api/boards/route.ts` | Create | GET all boards, POST create board |
| `app/api/boards/[id]/route.ts` | Create | GET single board, DELETE board |
| `app/api/boards/[id]/videos/route.ts` | Create | GET board videos, POST upload video |
| `app/api/boards/[id]/videos/[videoId]/route.ts` | Create | DELETE video |
| `app/boards/page.tsx` | Create | Boards list (team view) |
| `app/boards/[id]/page.tsx` | Create | Board detail with upload button (team view) |
| `app/share/[token]/page.tsx` | Create | Public board (creator view, no sidebar) |
| `components/app-shell.tsx` | Create | Client wrapper — renders sidebar or clean layout based on pathname |
| `components/boards/board-card.tsx` | Create | Board card for list view |
| `components/boards/new-board-dialog.tsx` | Create | Create board modal |
| `components/boards/board-upload-dialog.tsx` | Create | Upload video to board modal |
| `components/boards/board-video-card.tsx` | Create | Video card with hover-play |
| `components/boards/board-video-lightbox.tsx` | Create | Fullscreen video player modal |
| `lib/board-types.ts` | Create | Board and BoardVideo TypeScript types |
| `app/layout.tsx` | Modify | Replace inline sidebar wrapper with `<AppShell>` |
| `components/sidebar.tsx` | Modify | Add Boards nav item |

---

## Task 1: Types

**Files:**
- Create: `lib/board-types.ts`

- [ ] **Step 1: Create types file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/yassine/Desktop/CLAUDE CODE/02-tools/mission-control"
git add lib/board-types.ts
git commit -m "feat: add Board and BoardVideo types"
```

---

## Task 2: Auth Middleware

**Files:**
- Create: `middleware.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create middleware**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PREFIXES = ['/share/', '/login', '/api/auth/']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (isPublic) return NextResponse.next()

  const cookie = req.cookies.get('mc_auth')
  if (cookie?.value === process.env.AUTH_SECRET) return NextResponse.next()

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Create login API route**

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.TEAM_PASSWORD || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  if (password !== process.env.TEAM_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('mc_auth', process.env.AUTH_SECRET, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
```

- [ ] **Step 3: Create logout API route**

```typescript
// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('mc_auth')
  return res
}
```

- [ ] **Step 4: Create login page**

```tsx
// app/login/page.tsx
'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push(searchParams.get('from') || '/')
    } else {
      setError('Wrong password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <Eye className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Mission Control</h1>
          </div>
          <p className="text-sm text-muted-foreground">Team access only</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Enter team password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Enter'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/api/auth/login/route.ts app/api/auth/logout/route.ts app/login/page.tsx
git commit -m "feat: add password auth middleware and login page"
```

---

## Task 3: AppShell — Conditional Sidebar

**Files:**
- Create: `components/app-shell.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create AppShell component**

```tsx
// components/app-shell.tsx
'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = pathname.startsWith('/share/') || pathname === '/login'

  if (isPublic) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Update root layout to use AppShell**

Replace the body content in `app/layout.tsx`:

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mission Control",
  description: "Ad creative management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add Boards to sidebar nav**

In `components/sidebar.tsx`, add the Boards item to the `navItems` array:

```tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Video, Image, Eye, Search, Lightbulb, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/video-ads', label: 'Video Ads', icon: Video },
  { href: '/static-ads', label: 'Static Ads', icon: Image },
  { href: '/spy', label: 'Ad Spy', icon: Search },
  { href: '/hooks', label: 'Hook Vault', icon: Lightbulb },
  { href: '/boards', label: 'Boards', icon: LayoutGrid },
]
```

(Keep the rest of sidebar.tsx identical to current.)

- [ ] **Step 4: Commit**

```bash
git add components/app-shell.tsx app/layout.tsx components/sidebar.tsx
git commit -m "feat: add AppShell for conditional sidebar, add Boards to nav"
```

---

## Task 4: Board API Routes

**Files:**
- Create: `app/api/boards/route.ts`
- Create: `app/api/boards/[id]/route.ts`
- Create: `app/api/boards/[id]/videos/route.ts`
- Create: `app/api/boards/[id]/videos/[videoId]/route.ts`

- [ ] **Step 1: Create boards list/create route**

```typescript
// app/api/boards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { name, description } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('boards')
    .insert({ name: name.trim(), description: description?.trim() || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create board detail/delete route**

```typescript
// app/api/boards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()
  const { error } = await supabase.from('boards').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create board videos route (list + upload)**

```typescript
// app/api/boards/[id]/videos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('board_videos')
    .select('*')
    .eq('board_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string
  const notes = formData.get('notes') as string | null

  if (!file || !title?.trim()) {
    return NextResponse.json({ error: 'File and title are required' }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const ext = file.name.split('.').pop()
  const fileName = `boards/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(fileName, file)

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName)

  const { data, error: insertError } = await supabase
    .from('board_videos')
    .insert({
      board_id: id,
      title: title.trim(),
      file_url: publicUrl,
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Create video delete route**

```typescript
// app/api/boards/[id]/videos/[videoId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const { videoId } = await params
  const supabase = getSupabaseServer()
  const { error } = await supabase.from('board_videos').delete().eq('id', videoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/boards/
git commit -m "feat: add board and board video CRUD API routes"
```

---

## Task 5: Board Components

**Files:**
- Create: `components/boards/board-card.tsx`
- Create: `components/boards/new-board-dialog.tsx`
- Create: `components/boards/board-upload-dialog.tsx`
- Create: `components/boards/board-video-card.tsx`
- Create: `components/boards/board-video-lightbox.tsx`

- [ ] **Step 1: Create board card**

```tsx
// components/boards/board-card.tsx
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

  const shareUrl = `${window.location.origin}/share/${board.share_token}`

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
```

- [ ] **Step 2: Create new board dialog**

```tsx
// components/boards/new-board-dialog.tsx
'use client'

import { useState, FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Board } from '@/lib/board-types'

interface NewBoardDialogProps {
  onCreated: (board: Board) => void
}

export function NewBoardDialog({ onCreated }: NewBoardDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })

    if (res.ok) {
      const board = await res.json()
      onCreated(board)
      setOpen(false)
      setName('')
      setDescription('')
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Board
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Board</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Board Name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. UGC Inspiration Q2"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this board for?"
              rows={2}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : 'Create Board'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create board upload dialog**

```tsx
// components/boards/board-upload-dialog.tsx
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
```

- [ ] **Step 4: Create video card**

```tsx
// components/boards/board-video-card.tsx
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

      {/* Play overlay when not hovered */}
      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="p-3 rounded-full bg-black/50 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white text-sm font-medium leading-tight line-clamp-2">{video.title}</p>
        {video.notes && (
          <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{video.notes}</p>
        )}
      </div>

      {/* Delete button (team view only) */}
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
```

- [ ] **Step 5: Create video lightbox**

```tsx
// components/boards/board-video-lightbox.tsx
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
```

- [ ] **Step 6: Commit**

```bash
git add components/boards/
git commit -m "feat: add board components (card, dialogs, video card, lightbox)"
```

---

## Task 6: Boards Pages (Team View)

**Files:**
- Create: `app/boards/page.tsx`
- Create: `app/boards/[id]/page.tsx`

- [ ] **Step 1: Create boards list page**

```tsx
// app/boards/page.tsx
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
```

- [ ] **Step 2: Create board detail page**

```tsx
// app/boards/[id]/page.tsx
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

  const shareUrl = board ? `${window.location.origin}/share/${board.share_token}` : ''

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
```

- [ ] **Step 3: Commit**

```bash
git add app/boards/
git commit -m "feat: add boards list and board detail pages"
```

---

## Task 7: Public Share Page

**Files:**
- Create: `app/share/[token]/page.tsx`

- [ ] **Step 1: Create public board share page**

This page has NO sidebar (handled by AppShell in Task 3). It fetches the board by `share_token` using the public Supabase client (anon key has read access to `boards` and `board_videos`).

**Important:** Before this works, enable RLS policies in Supabase for public read:

```sql
-- Allow public read on boards
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read boards" ON boards FOR SELECT USING (true);

-- Allow public read on board_videos  
ALTER TABLE board_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read board_videos" ON board_videos FOR SELECT USING (true);
```

Run that SQL in Supabase first, then create the page:

```tsx
// app/share/[token]/page.tsx
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
      {/* Header */}
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

      {/* Video grid */}
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
```

- [ ] **Step 2: Commit**

```bash
git add app/share/
git commit -m "feat: add public share board page for creators"
```

---

## Final Checklist

- [ ] SQL tables created in Supabase (`boards`, `board_videos`)
- [ ] RLS policies set for public read on both tables
- [ ] `TEAM_PASSWORD` and `AUTH_SECRET` added to `.env.local` (and Vercel env vars)
- [ ] Middleware protects all routes except `/share/*`, `/login`, `/api/auth/*`
- [ ] `/boards` shows board list with "New Board" button
- [ ] `/boards/[id]` shows videos with "Upload Video" button and "Copy share link"
- [ ] `/share/[token]` renders without sidebar, accessible without login
- [ ] Video cards show hover-play preview
- [ ] Clicking a video opens fullscreen lightbox
- [ ] Delete works on board detail page (team view only)
