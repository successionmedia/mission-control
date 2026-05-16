/**
 * Supabase storage helpers for the Ad Factory automation.
 * Bucket: 'ad-factory' (public)
 */

import { getSupabaseServer } from '@/lib/supabase-server'

const BUCKET = 'ad-factory'

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

/** Ensure the ad-factory bucket exists. Safe to call repeatedly. */
export async function ensureBucket(): Promise<void> {
  const db = getSupabaseServer()
  const { data: buckets } = await db.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await db.storage.createBucket(BUCKET, { public: true })
  }
}

/**
 * Upload a remote URL (e.g. a Kie CDN result) into our own Supabase bucket
 * so it outlasts Kie's 14-day TTL.
 * Returns the public Supabase URL.
 */
export async function rehostUrl(remoteUrl: string, destPath: string): Promise<string> {
  const res = await fetch(remoteUrl)
  if (!res.ok) throw new Error(`rehostUrl: fetch ${res.status} ${remoteUrl}`)
  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'image/png'

  const db = getSupabaseServer()
  const { error } = await db.storage
    .from(BUCKET)
    .upload(destPath, buffer, {
      contentType,
      upsert: true,
    })
  if (error) throw new Error(`rehostUrl upload: ${error.message}`)
  return publicUrl(destPath)
}

/** Upload raw bytes (Buffer or Uint8Array) to the bucket and return public URL. */
export async function uploadBytes(
  bytes: ArrayBuffer | Uint8Array,
  destPath: string,
  contentType = 'image/png'
): Promise<string> {
  const db = getSupabaseServer()
  const { error } = await db.storage
    .from(BUCKET)
    .upload(destPath, bytes, { contentType, upsert: true })
  if (error) throw new Error(`uploadBytes: ${error.message}`)
  return publicUrl(destPath)
}

/** Slugify a string for filename safety. */
export function slugify(s: string, max = 60): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max) || 'untitled'
  )
}
