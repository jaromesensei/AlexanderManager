import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
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
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <TopBar />
      <main className="flex-1 px-4 pb-24 pt-4">
        {/* מפתח לפי הנתיב => האנימציה מתנגנת מחדש בכל מעבר מסך */}
        <div key={pathname} className="animate-rise">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      {isManager && (
        <Suspense fallback={null}>
          <AssistantWidget />
        </Suspense>
      )}
    </div>
  )
}
