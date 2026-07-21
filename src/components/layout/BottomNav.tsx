import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NAV_ITEMS } from './navItems'
import { cn } from '@/lib/utils'
import { hapticTap } from '@/lib/haptics'

export function BottomNav() {
  const { isManager } = useAuth()
  const items = NAV_ITEMS.filter((item) => isManager || item.employeeVisible)

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={hapticTap}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                isActive ? 'text-brand-500' : 'text-neutral-400 hover:text-neutral-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn('h-6 w-6', isActive && 'stroke-[2.5]')}
                  aria-hidden
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
