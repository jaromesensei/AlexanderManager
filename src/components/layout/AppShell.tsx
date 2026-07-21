import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <TopBar />
      <main className="flex-1 px-4 pb-24 pt-4">
        {/* מפתח לפי הנתיב => האנימציה מתנגנת מחדש בכל מעבר מסך */}
        <div key={pathname} className="animate-rise">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
