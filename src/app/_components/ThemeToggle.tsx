'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[var(--hover)] hover:text-[var(--cream-dim)]"
      style={{ color: 'var(--cream-faint)' }}
    >
      {isLight ? (
        <Sun className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Moon className="w-4 h-4 flex-shrink-0" />
      )}
      {isLight ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
