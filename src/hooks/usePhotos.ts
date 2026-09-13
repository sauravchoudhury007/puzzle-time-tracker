'use client'

import { useEffect, useState } from 'react'
import type { Photo } from '@/components/pulse/CoverflowCarousel'
import { supabase } from '@/lib/supabaseClient'
import { HIGHLIGHT_REEL_CACHE_KEY } from '@/lib/storageKeys'

/* The reel's photos sit in a private bucket, so their links are signed by
   /api/photos for signed-in readers only. A set of links is good for a week and is
   reused until a day before it lapses — the same URLs every visit are what let the
   browser keep the resized photos cached. */

/** Stop reusing stored links once they have less than this left. */
const MIN_REMAINING_MS = 24 * 60 * 60 * 1000

/** Stand-in reel for when the photos cannot be loaded. */
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

type StoredReel = { photos: Photo[]; expiresAt: number }

function readStoredReel(): StoredReel | null {
  try {
    const raw = window.localStorage.getItem(HIGHLIGHT_REEL_CACHE_KEY)
    const stored = raw ? (JSON.parse(raw) as Partial<StoredReel>) : null
    if (
      typeof stored?.expiresAt !== 'number' ||
      !Array.isArray(stored.photos) ||
      !stored.photos.every(p => typeof p?.src === 'string' && typeof p?.label === 'string')
    ) {
      return null
    }
    return { photos: stored.photos, expiresAt: stored.expiresAt }
  } catch {
    return null
  }
}

function writeStoredReel(reel: StoredReel) {
  try {
    window.localStorage.setItem(HIGHLIGHT_REEL_CACHE_KEY, JSON.stringify(reel))
  } catch {
    // Private browsing — the links are just fetched again next visit.
  }
}

/** Forgets the stored links — on sign-out. */
export function clearPhotosCache() {
  try {
    window.localStorage.removeItem(HIGHLIGHT_REEL_CACHE_KEY)
  } catch {
    // Storage unavailable — nothing was persisted either.
  }
}

let inFlight: Promise<Photo[]> | null = null

async function fetchReel(): Promise<Photo[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const res = await fetch('/api/photos', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) throw new Error(`Photos request failed (${res.status})`)
  const reel = (await res.json()) as StoredReel
  writeStoredReel(reel)
  return reel.photos
}

/** The highlight reel, or null while its links are loading. */
export function usePhotos(): Photo[] | null {
  const [photos, setPhotos] = useState<Photo[] | null>(null)

  useEffect(() => {
    const stored = readStoredReel()
    if (stored && stored.photos.length > 0 && stored.expiresAt - Date.now() > MIN_REMAINING_MS) {
      setPhotos(stored.photos)
      return
    }

    let active = true
    inFlight ??= fetchReel().finally(() => {
      inFlight = null
    })
    inFlight
      .then(list => {
        if (active) setPhotos(list.length > 0 ? list : FALLBACK_PHOTOS)
      })
      .catch(() => {
        // Links in their last day still beat the stand-ins.
        const usable = stored && stored.photos.length > 0 && stored.expiresAt > Date.now()
        if (active) setPhotos(usable ? stored.photos : FALLBACK_PHOTOS)
      })
    return () => {
      active = false
    }
  }, [])

  return photos
}
