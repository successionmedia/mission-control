export type AssetType = 'video' | 'static'
export type AssetSource = 'own' | 'spy'

export interface Asset {
  id: string
  type: AssetType
  source: AssetSource
  title: string
  brand: string | null
  tags: string[]
  tool_used: string | null
  notes: string | null
  file_url: string
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}
