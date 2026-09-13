export const dynamic = 'force-dynamic'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import TodayView from '@/components/TodayView'
import type { Photo } from '@/components/pulse/CoverflowCarousel'
import { SITE } from '@/lib/site'

const AVATAR_FILE_KEY = 'solving.jpeg'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 48 // 48 hours

type SignedUrlCacheEntry<T> = { value: T; expiresAt: number }
type SignedUrlWithPath = { path: string; signedUrl: string | null }

const signedUrlCache = new Map<string, SignedUrlCacheEntry<SignedUrlWithPath[]>>()

const isCacheValid = <T,>(entry?: SignedUrlCacheEntry<T>) => Boolean(entry && entry.expiresAt > Date.now())

async function getSignedUrlsWithCache(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
  ttlSeconds: number
): Promise<SignedUrlWithPath[]> {
  const cacheKey = `${bucket}:${paths.join('|')}:${ttlSeconds}`
  const cached = signedUrlCache.get(cacheKey)

  if (cached && isCacheValid(cached)) {
    return cached.value
  }

  const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, ttlSeconds)

  if (error) {
    console.error('Error creating signed URLs:', error.message)
    return cached?.value ?? []
  }

  const results: SignedUrlWithPath[] =
    data?.map((entry, idx) => ({
      path: paths[idx] ?? `path-${idx}`,
      signedUrl: entry?.signedUrl ?? null,
    })) ?? []

  const expiresAt = Date.now() + ttlSeconds * 1000

  if (results.some(entry => entry.signedUrl)) {
    signedUrlCache.set(cacheKey, { value: results, expiresAt })
  }

  return results
}

const FALLBACK_PHOTOS: Photo[] = [
  {
    src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
    label: 'Crossword + pencil',
  },
  {
    src: 'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=900&q=80',
    label: 'Sunday coffee + puzzle',
  },
  {
    src: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',
    label: 'Slow morning',
  },
  {
    src: 'https://images.unsplash.com/photo-1485463611174-f302f6a5c1c9?auto=format&fit=crop&w=900&q=80',
    label: 'Late night, lamp light',
  },
  {
    src: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=900&q=80',
    label: 'Breakfast + the mini',
  },
  {
    src: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
    label: 'Cafe day',
  },
  {
    src: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=900&q=80',
    label: 'Picnic blanket, slow puzzle',
  },
]

export default async function HomePage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const avatarSigned = await getSignedUrlsWithCache(
    supabaseAdmin,
    'avatar',
    [AVATAR_FILE_KEY],
    SIGNED_URL_TTL_SECONDS
  )
  const avatarUrl = avatarSigned?.[0]?.signedUrl ?? null

  const carouselKeys = Array.from({ length: 7 }, (_, i) => `${i + 1}.jpeg`)
  const carouselSigned = await getSignedUrlsWithCache(
    supabaseAdmin,
    'avatar',
    carouselKeys,
    SIGNED_URL_TTL_SECONDS
  )

  const reel: Photo[] = (carouselSigned ?? [])
    .map((entry, idx) =>
      entry.signedUrl ? { src: entry.signedUrl, label: `Captured ${idx + 1}` } : null
    )
    .filter((item): item is Photo => Boolean(item))

  // The shared portrait leads the reel.
  const photos: Photo[] = avatarUrl
    ? [{ src: avatarUrl, label: SITE.pair }, ...reel]
    : reel

  return <TodayView photos={photos.length > 0 ? photos : FALLBACK_PHOTOS} />
}
