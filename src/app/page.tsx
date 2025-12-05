export const dynamic = 'force-dynamic';
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import NavPill from '@/components/NavPill'
import Carousel3D from '@/components/Carousel3D'

const AVATAR_FILE_KEY = 'solving.jpeg'
let cachedAvatarUrl: { url: string; expiresAt: number } | null = null
const SIGNED_URL_TTL_SECONDS = 60 * 30 // 30 minutes

export default async function HomePage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let avatarUrl: string | null = null
  const now = Date.now()

  if (cachedAvatarUrl && cachedAvatarUrl.expiresAt > now) {
    avatarUrl = cachedAvatarUrl.url
  } else {
    const { data: signedData, error: urlError } = await supabaseAdmin.storage
      .from('avatar')
      .createSignedUrl(AVATAR_FILE_KEY, SIGNED_URL_TTL_SECONDS)
    if (urlError) {
      console.error('Error creating signed URL:', urlError.message)
    } else if (signedData?.signedUrl) {
      avatarUrl = signedData.signedUrl
      cachedAvatarUrl = {
        url: signedData.signedUrl,
        expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
      }
    }
  }

  const carouselKeys = Array.from({ length: 7 }, (_, i) => `${i + 1}.jpeg`)

  const { data: carouselSigned, error: carouselError } = await supabaseAdmin.storage
    .from('avatar')
    .createSignedUrls(carouselKeys, SIGNED_URL_TTL_SECONDS)

  if (carouselError) {
    console.error('Error creating carousel signed URLs:', carouselError.message)
  }

  let carouselImages =
    (carouselSigned?.map((entry, idx) =>
      entry.signedUrl
        ? {
            src: entry.signedUrl,
            alt: `Captured ${idx + 1}`,
          }
        : null
    ) ?? []).filter(
      (item): item is { src: string; alt: string } => Boolean(item?.src)
    )

  if (carouselImages.length === 0) {
    carouselImages = [
      {
        src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80',
        alt: 'Crossword grid and pencil',
      },
      {
        src: 'https://images.unsplash.com/photo-1486946255434-2466348c2166?auto=format&fit=crop&w=800&q=80',
        alt: 'Notebook with puzzle notes',
      },
      {
        src: 'https://images.unsplash.com/photo-1504275107627-0c2ba7a43dba?auto=format&fit=crop&w=800&q=80',
        alt: 'Morning coffee and puzzle time',
      },
      {
        src: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
        alt: 'Colorful desk with stationery',
      },
      {
        src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
        alt: 'Friends solving puzzles together',
      },
      {
        src: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80',
        alt: 'Minimal workspace and tablet',
      },
      {
        src: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=800&q=80',
        alt: 'Evening glow over workspace',
      },
    ]
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b1c] text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-0 h-80 w-80 rounded-full bg-sky-500/25 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/30 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(111,199,255,0.14),transparent_32%),radial-gradient(circle_at_30%_80%,rgba(100,70,255,0.18),transparent_30%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-12 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="absolute inset-y-4 left-3 w-px bg-gradient-to-b from-sky-400/70 via-indigo-300/60 to-transparent" />
            <div className="relative space-y-8">
              <nav className="space-y-3">
                {[
                  { href: '/dashboard', label: 'Dashboard' },
                  { href: '/entry', label: 'Log a Puzzle Time' },
                  { href: '/tracker', label: 'View Tracker' },
                  { href: '/data', label: 'Import / Export' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 shadow-inner transition hover:border-sky-400/60 hover:bg-white/10"
                  >
                    <span className="h-2 w-2 rounded-full bg-white/40 transition group-hover:bg-sky-300" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-8">
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_45%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-white/0" />
              <div className="relative flex flex-col items-center gap-6">
                <h1 className="text-3xl font-extrabold md:text-4xl text-center">NYT Minis Time Tracker</h1>
                {avatarUrl ? (
                  <div className="relative h-48 w-48">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400/40 via-transparent to-indigo-500/50 blur-2xl" />
                    <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.4)]">
                      <Image
                        src={avatarUrl}
                        alt="You and your partner solving puzzles"
                        fill
                        sizes="250px"
                        className="object-cover"
                        priority
                        unoptimized
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/5 text-xs text-white/60">
                    Shared photo slot
                  </div>
                )}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_40%)]" />
              <div className="relative flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/70">Highlight reel</p>
                  </div>
                </div>

                <Carousel3D images={carouselImages} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
