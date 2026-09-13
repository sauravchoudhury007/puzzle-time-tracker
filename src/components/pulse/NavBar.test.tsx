import { render, screen, act } from '@testing-library/react'
import { vi } from 'vitest'
import NavBar from './NavBar'
import { ThemeProvider } from '@/components/ThemeProvider'
import { navLinks } from '@/lib/navLinks'
import { MODE_STORAGE_KEY } from '@/lib/theme'

const pathname = vi.hoisted(() => ({ current: '/dashboard' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

const renderNav = () =>
  render(
    <ThemeProvider>
      <NavBar />
    </ThemeProvider>
  )

/** This suite also runs extension tests, which leave a partial localStorage behind. */
function installMemoryStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
    },
  })
}

beforeEach(() => {
  pathname.current = '/dashboard'
  installMemoryStorage()
  document.documentElement.removeAttribute('data-mode')
  // jsdom has no matchMedia
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
})

describe('NavBar', () => {
  it('links to every page and marks the current one', () => {
    renderNav()

    navLinks.forEach(link => {
      const el = screen.getByRole('link', { name: link.label })
      expect(el).toHaveAttribute('href', link.href)
    })

    expect(screen.getByRole('link', { name: 'Almanac' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })

  it('toggles dark mode and remembers the choice', async () => {
    renderNav()
    const toggle = screen.getByRole('button', { name: /toggle light or dark mode/i })

    await act(async () => {
      toggle.click()
    })

    expect(document.documentElement.getAttribute('data-mode')).toBe('dark')
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark')

    await act(async () => {
      toggle.click()
    })

    expect(document.documentElement.getAttribute('data-mode')).toBe('light')
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light')
  })
})
