import { NextResponse } from 'next/server'
import { revalidateTag, unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Photo } from '@/components/pulse/CoverflowCarousel'
import { SITE } from '@/lib/site'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

const BUCKET = 'avatar'
/** The shared portrait leads the reel. */
const PATHS = ['solving.jpeg', ...Array.from({ length: 7 }, (_, i) => `${i + 1}.jpeg`)]

const LINK_TTL_SECONDS = 60 * 60 * 24 * 7
/** Re-sign a day before the links lapse, so a cached set always has a day to run. */
const RESIGN_AFTER_SECONDS = LINK_TTL_SECONDS - 60 * 60 * 24
const MIN_REMAINING_MS = 60 * 60 * 1000
const CACHE_TAG = 'avatar-signed-urls'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

type Reel = { photos: Photo[]; expiresAt: number }

async function signReel(): Promise<Reel> {
  const expiresAt = Date.now() + LINK_TTL_SECONDS * 1000
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(PATHS, LINK_TTL_SECONDS)
  // Throwing keeps a failed signing out of the cache.
  if (error) throw new Error(error.message)

  const photos = (data ?? []).flatMap((entry, i) =>
    entry.signedUrl ? [{ src: entry.signedUrl, label: i === 0 ? SITE.pair : `Captured ${i}` }] : []
  )
  if (photos.length === 0) throw new Error('No photo could be signed')
  return { photos, expiresAt }
}

/* One set of links for every server instance. Links that stay the same for days are
   what let the browser and the image optimizer serve the photos from cache. */
const signedReel = unstable_cache(signReel, [CACHE_TAG], {
  revalidate: RESIGN_AFTER_SECONDS,
  tags: [CACHE_TAG],
})

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401, headers: NO_STORE })
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  try {
    let reel = await signedReel()
    // The cache hands back a stale set while it re-signs in the background. After a
    // quiet week that set may be about to lapse, so sign a fresh one right away.
    if (reel.expiresAt - Date.now() < MIN_REMAINING_MS) {
      reel = await signReel()
      revalidateTag(CACHE_TAG)
    }
    return NextResponse.json(reel, { headers: NO_STORE })
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not sign photo links', details: err instanceof Error ? err.message : String(err) },
      { status: 502, headers: NO_STORE }
    )
  }
}
