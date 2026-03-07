'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { AssetSource } from '@/lib/types'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  source: AssetSource | 'all'
  onSourceChange: (value: AssetSource | 'all') => void
  toolFilter: string
  onToolFilterChange: (value: string) => void
}

export function FilterBar({ search, onSearchChange, source, onSourceChange, toolFilter, onToolFilterChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, brand, or tags..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={source} onValueChange={(v) => { if (v) onSourceChange(v as AssetSource | 'all') }}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="own">Own</SelectItem>
          <SelectItem value="spy">Spy</SelectItem>
        </SelectContent>
      </Select>
      <Select value={toolFilter} onValueChange={(v) => { if (v) onToolFilterChange(v) }}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Tool" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tools</SelectItem>
          <SelectItem value="STAR">STAR</SelectItem>
          <SelectItem value="Hemingway">Hemingway</SelectItem>
          <SelectItem value="Sora">Sora</SelectItem>
          <SelectItem value="Bond">Bond</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
