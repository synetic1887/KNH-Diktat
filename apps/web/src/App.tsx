import { useEffect } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { useAuthStore } from '@/features/auth/authStore'
import { DictationPage } from '@/routes/dictation-page'
import { DocumentsPage } from '@/routes/documents-page'
import { LoginPage } from '@/routes/login-page'
import { SettingsPage } from '@/routes/settings-page'
import { TemplatesAdminPage } from '@/routes/admin-templates-page'
import { ClientsAdminPage } from '@/routes/admin-clients-page'
import { AuditLogPage } from '@/routes/admin-audit-page'
import { cn } from '@/lib/cn'

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-bordeaux text-primary-foreground'
            : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function AuthMenu() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const init = useAuthStore((s) => s.init)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'unknown') void init()
  }, [status, init])

  if (status !== 'authenticated' || !user) {
    return (
      <NavLink to="/login" className="text-sm text-muted-foreground hover:text-foreground">
        Anmelden
      </NavLink>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {user.email} <span className="rounded bg-muted px-1 py-0.5 text-[10px]">{user.role}</span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await logout()
          navigate('/login', { replace: true })
        }}
      >
        Logout
      </Button>
    </div>
  )
}

export function App() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const isAdmin = status === 'authenticated' && user?.role === 'admin'
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full bg-bordeaux shadow-[0_0_0_3px_rgba(122,31,31,0.15)]"
            />
            <span className="font-semibold tracking-tight">Kanzlei-Diktat</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavItem to="/">Diktat</NavItem>
            <NavItem to="/documents">Dokumente</NavItem>
            {isAdmin ? <NavItem to="/admin/templates">Vorlagen</NavItem> : null}
            {isAdmin ? <NavItem to="/admin/clients">Mandanten</NavItem> : null}
            {isAdmin ? <NavItem to="/admin/audit">Audit</NavItem> : null}
            <NavItem to="/settings">Einstellungen</NavItem>
            <span className="ml-3">
              <AuthMenu />
            </span>
          </nav>
        </div>
      </header>
      <main className="container flex-1 py-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DictationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/templates"
            element={
              <ProtectedRoute requireRole="admin">
                <TemplatesAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/clients"
            element={
              <ProtectedRoute requireRole="admin">
                <ClientsAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute requireRole="admin">
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <footer className="border-t border-border bg-card/30">
        <div className="container py-3 text-xs text-muted-foreground">
          Bordeaux #7a1f1f · DSGVO-bewusst · Solo-Anwalt-fähig.
        </div>
      </footer>
    </div>
  )
}
