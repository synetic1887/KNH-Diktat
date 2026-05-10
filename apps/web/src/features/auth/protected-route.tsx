import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from './authStore'

interface ProtectedRouteProps {
  readonly children: React.ReactNode
  readonly requireRole?: 'admin' | 'member'
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const init = useAuthStore((s) => s.init)
  const location = useLocation()

  useEffect(() => {
    if (status === 'unknown') void init()
  }, [status, init])

  if (status === 'unknown') {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Lade Sitzung…
      </div>
    )
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (requireRole === 'admin' && user?.role !== 'admin') {
    return (
      <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        Diese Ansicht ist nur für Administratoren.
      </div>
    )
  }
  return <>{children}</>
}
