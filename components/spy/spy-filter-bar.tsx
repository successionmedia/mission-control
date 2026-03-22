'use client'

import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import {
  ASSET_TYPES,
  VISUAL_FORMATS,
  MESSAGING_ANGLES,
  HOOK_TACTICS,
  OFFER_TYPES,
} from '@/lib/spy-types'
import type { SpyBrand } from '@/lib/spy-types'

export interface SpyFilters {
  search: string
  brand_id: string
  creative_type: string
  asset_type: string
  visual_format: string
  messaging_angle: string
  hook_tactic: string
  offer_type: string
  sort: string
}

interface SpyFilterBarProps {
  filters: SpyFilters
  onChange: (filters: SpyFilters) => void
  brands: SpyBrand[]
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: readonly string[] | string[] | Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value
        const lbl = typeof opt === 'string' ? opt : opt.label
        return (
          <option key={val} value={val}>
            {lbl}
          </option>
        )
      })}
    </select>
  )
}

export function SpyFilterBar({ filters, onChange, brands }: SpyFilterBarProps) {
  const update = (key: keyof SpyFilters, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search ads..."
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <FilterSelect
        label="Brand"
        value={filters.brand_id}
        onChange={(v) => update('brand_id', v)}
        options={brands.map((b) => ({ value: b.id, label: b.brand_name }))}
      />

      <FilterSelect
        label="Media"
        value={filters.creative_type}
        onChange={(v) => update('creative_type', v)}
        options={['video', 'image']}
      />

      <FilterSelect
        label="Asset Type"
        value={filters.asset_type}
        onChange={(v) => update('asset_type', v)}
        options={ASSET_TYPES}
      />

      <FilterSelect
        label="Format"
        value={filters.visual_format}
        onChange={(v) => update('visual_format', v)}
        options={VISUAL_FORMATS}
      />

      <FilterSelect
        label="Angle"
        value={filters.messaging_angle}
        onChange={(v) => update('messaging_angle', v)}
        options={MESSAGING_ANGLES}
      />

      <FilterSelect
        label="Hook"
        value={filters.hook_tactic}
        onChange={(v) => update('hook_tactic', v)}
        options={HOOK_TACTICS}
      />

      <FilterSelect
        label="Offer"
        value={filters.offer_type}
        onChange={(v) => update('offer_type', v)}
        options={OFFER_TYPES}
      />

      <FilterSelect
        label="Sort"
        value={filters.sort}
        onChange={(v) => update('sort', v)}
        options={['Newest', 'Oldest', 'Most Weeks', 'Rank']}
      />
    </div>
  )
}
