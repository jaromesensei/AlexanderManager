import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function TopBar() {
  const { profile, signOut } = useAuth()

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-brand-500">אלכסנדר</span>
          <span className="text-sm text-neutral-500">נהריה</span>
        </div>
        <div className="flex items-center gap-3">
          {profile?.full_name && (
            <span className="text-sm text-neutral-400">{profile.full_name}</span>
          )}
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
