'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { MODE_STORAGE_KEY, type ThemeMode } from '@/lib/theme'

type ThemeContextValue = {
  /** null until mounted — the server cannot know the reader's OS preference. */
  mode: ThemeMode | null
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ mode: null, toggleMode: () => {} })

export const useTheme = () => useContext(ThemeContext)

function readMode(): ThemeMode {
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode | null>(null)

  useEffect(() => {
    setMode(readMode())

    // Follow the OS while the reader has not picked a side themselves.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!window.localStorage.getItem(MODE_STORAGE_KEY)) {
        setMode(media.matches ? 'dark' : 'light')
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggleMode = useCallback(() => {
    setMode(prev => {
      const next: ThemeMode = (prev ?? readMode()) === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, next)
      } catch {
        // Private browsing — the choice just will not survive a reload.
      }
      document.documentElement.setAttribute('data-mode', next)
      return next
    })
  }, [])

  return <ThemeContext.Provider value={{ mode, toggleMode }}>{children}</ThemeContext.Provider>
}
