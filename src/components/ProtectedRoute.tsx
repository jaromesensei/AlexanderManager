import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FullScreenSpinner } from '@/components/ui/Spinner'

/** עוטף מסלולים שדורשים התחברות. `managerOnly` חוסם עובדים. */
export function ProtectedRoute({
  children,
  managerOnly = false,
}: {
  children: ReactNode
  managerOnly?: boolean
}) {
  const { session, isManager, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (managerOnly && !isManager) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
