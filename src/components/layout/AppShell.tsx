import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { SideNav } from './SideNav'
import { useAuth } from '@/contexts/AuthContext'

// טעינה עצלה — העוזר (וספריות כבדות שלו) נטענים אחרי הצגת המסך, לא חוסמים.
const AssistantWidget = lazy(() =>
  import('@/components/assistant/AssistantWidget').then((m) => ({
    default: m.AssistantWidget,
  }))
)

export function AppShell() {
  const { pathname } = useLocation()
  const { isManager } = useAuth()
  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="mx-auto flex w-full max-w-7xl">
        <SideNav />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-10">
          {/* מפתח לפי הנתיב => האנימציה מתנגנת מחדש בכל מעבר מסך */}
          <div
            key={pathname}
            className="animate-rise mx-auto w-full max-w-lg md:max-w-2xl lg:max-w-4xl"
          >
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      {isManager && (
        <Suspense fallback={null}>
          <AssistantWidget />
        </Suspense>
      )}
    </div>
  )
}
