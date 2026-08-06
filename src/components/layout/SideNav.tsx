import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NAV_ITEMS } from './navItems'
import { cn } from '@/lib/utils'

// ניווט צד — מוצג רק במסכים גדולים (אייפד/מחשב). בטלפון משתמשים ב-BottomNav.
export function SideNav() {
  const { isManager } = useAuth()
  const items = NAV_ITEMS.filter((item) => isManager || item.employeeVisible)

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col gap-1 border-l border-neutral-800 p-3 lg:flex">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'accent-soft text-brand-500'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
            )
          }
        >
          <item.icon className="h-5 w-5 shrink-0" aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </aside>
  )
}
