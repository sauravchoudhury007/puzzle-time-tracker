import TodayView from '@/components/TodayView'

/* Static on purpose: the photos are private, so TodayView loads their links only
   once the reader is signed in (see usePhotos and /api/photos). */
export default function HomePage() {
  return <TodayView />
}
