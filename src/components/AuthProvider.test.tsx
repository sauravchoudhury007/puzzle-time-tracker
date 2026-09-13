import { act, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider } from './AuthProvider'

type AuthListener = (event: string, session: object | null) => void

const auth = vi.hoisted(() => ({
  pathname: '/dashboard',
  storedSession: null as { userId: string } | null,
  listener: null as ((event: string, session: object | null) => void) | null,
  router: { replace: vi.fn() },
  clearPuzzleTimesCache: vi.fn(),
  clearPhotosCache: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => auth.pathname,
  useRouter: () => auth.router,
}))

vi.mock('@/lib/supabaseClient', () => ({
  readStoredSession: () => auth.storedSession,
  supabase: {
    auth: {
      onAuthStateChange: (callback: AuthListener) => {
        auth.listener = callback
        return { data: { subscription: { unsubscribe: () => (auth.listener = null) } } }
      },
    },
  },
}))

vi.mock('@/hooks/usePuzzleTimes', () => ({ clearPuzzleTimesCache: auth.clearPuzzleTimesCache }))
vi.mock('@/hooks/usePhotos', () => ({ clearPhotosCache: auth.clearPhotosCache }))

const renderPage = () =>
  render(
    <AuthProvider>
      <p>page</p>
    </AuthProvider>
  )

const emit = (event: string, session: object | null) => act(() => auth.listener?.(event, session))

beforeEach(() => {
  auth.pathname = '/dashboard'
  auth.storedSession = null
  auth.listener = null
  auth.router.replace.mockClear()
  auth.clearPuzzleTimesCache.mockClear()
  auth.clearPhotosCache.mockClear()
})

describe('AuthProvider', () => {
  it('shows the page straight away when a session is stored', () => {
    auth.storedSession = { userId: 'user-1' }
    renderPage()
    expect(screen.getByText('page')).toBeInTheDocument()
  })

  it('waits for the session when none is stored', () => {
    renderPage()
    expect(screen.queryByText('page')).not.toBeInTheDocument()

    emit('INITIAL_SESSION', { user: { id: 'user-1' } })
    expect(screen.getByText('page')).toBeInTheDocument()
  })

  it('sends a reader with no session to /login', () => {
    renderPage()
    emit('INITIAL_SESSION', null)

    expect(auth.router.replace).toHaveBeenCalledWith('/login')
    expect(screen.queryByText('page')).not.toBeInTheDocument()
  })

  it('forgets the caches and leaves on sign-out', () => {
    auth.storedSession = { userId: 'user-1' }
    renderPage()

    auth.storedSession = null
    emit('SIGNED_OUT', null)

    expect(auth.clearPuzzleTimesCache).toHaveBeenCalled()
    expect(auth.clearPhotosCache).toHaveBeenCalled()
    expect(auth.router.replace).toHaveBeenCalledWith('/login')
    expect(screen.queryByText('page')).not.toBeInTheDocument()
  })

  it('stays on the page when a refresh fails but the session is kept', () => {
    auth.storedSession = { userId: 'user-1' }
    renderPage()
    emit('INITIAL_SESSION', null)

    expect(auth.router.replace).not.toHaveBeenCalled()
    expect(auth.clearPuzzleTimesCache).not.toHaveBeenCalled()
    expect(screen.getByText('page')).toBeInTheDocument()
  })

  it('renders /login without waiting for a session', () => {
    auth.pathname = '/login'
    renderPage()
    expect(screen.getByText('page')).toBeInTheDocument()
  })
})
