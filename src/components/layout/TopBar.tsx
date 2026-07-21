import { useState } from 'react'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { hapticTap } from '@/lib/haptics'

export function TopBar() {
  const { profile, signOut } = useAuth()
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  )

  function toggleTheme() {
    const next = dark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      // אחסון חסום - נשאר לפגישה הזו בלבד
    }
    setDark(!dark)
    hapticTap()
  }

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-brand-500">אלכסנדר</span>
          <span className="text-sm text-neutral-500">נהריה</span>
        </div>
        <div className="flex items-center gap-1">
          {profile?.full_name && (
            <span className="ml-1 text-sm text-neutral-400">{profile.full_name}</span>
          )}
          <button
            onClick={toggleTheme}
            aria-label={dark ? 'מצב בהיר' : 'מצב כהה'}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={() => void signOut()}
            aria-label="התנתקות"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
