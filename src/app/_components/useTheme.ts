'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const listeners = new Set<() => void>()

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
}

// The server has no knowledge of the persisted theme, so it always renders the
// dark default. useSyncExternalStore uses this snapshot during hydration (so
// markup matches the server) then swaps to the real DOM value afterwards —
// avoiding a hydration mismatch without a manual `mounted` flag.
function getServerSnapshot(): Theme {
  return 'dark'
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/**
 * Theme hook backed by the `data-theme` attribute on <html> (set pre-paint by
 * ThemeScript) and persisted to localStorage.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      // ignore storage failures (private mode, disabled, etc.)
    }
    listeners.forEach((l) => l())
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === 'light' ? 'dark' : 'light')
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
