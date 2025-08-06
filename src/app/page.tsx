export const dynamic = 'force-dynamic';
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'

export default async function HomePage() {
  // Initialize Supabase Admin client with service role key
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Generate a signed URL for the known file
  let avatarUrl: string | null = null
  {
    const { data: signedData, error: urlError } = await supabaseAdmin.storage
      .from('avatar')
      .createSignedUrl('solving.jpeg', 300)
    if (urlError) {
      console.error('Error creating signed URL:', urlError.message)
    } else {
      avatarUrl = signedData.signedUrl
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-500 to-blue-500 text-white p-8">
      <h1 className="text-5xl font-extrabold mt-12 mb-6">
        🧩 NYT Minis Time Tracker 🧩
      </h1>
      <p className="text-xl mb-8">Tracking our journey together!</p>

      {avatarUrl && (
        <div className="mb-8 w-80 h-80 overflow-hidden rounded-full border-4 border-white shadow-xl">
          <Image
            src={avatarUrl!}
            alt="You and your partner solving puzzles"
            width={320}
            height={320}
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      )}

      <nav className="space-y-4 w-full max-w-xs">
        <Link
          href="/entry"
          className="block text-center bg-white text-purple-600 py-3 px-6 rounded-full font-semibold hover:bg-opacity-90"
        >
          Log a Puzzle Time
        </Link>
        <Link
          href="/dashboard"
          className="block text-center bg-white text-purple-600 py-3 px-6 rounded-full font-semibold hover:bg-opacity-90"
        >
          View Dashboard
        </Link>
        <Link
          href="/data"
          className="block text-center bg-white text-purple-600 py-3 px-6 rounded-full font-semibold hover:bg-opacity-90"
        >
          Import / Export Data
        </Link>
      </nav>
    </main>
  )
}
