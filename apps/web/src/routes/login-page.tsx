import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/authStore'
import { AuthError } from '@/features/auth/authClient'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuthStore((s) => s.status)
  const login = useAuthStore((s) => s.login)
  const signup = useAuthStore((s) => s.signup)

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(email, password)
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Unbekannter Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === 'login' ? 'Anmelden' : 'Konto anlegen'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lokale Konten werden in der eigenen SQLite verwaltet.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            E-Mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signup' ? 8 : undefined}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {mode === 'signup' ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Mindestens 8 Zeichen.</p>
          ) : null}
        </div>
        {error ? (
          <div className="rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'))
              setError(null)
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon registriert? Anmelden'}
          </button>
        </div>
      </form>
    </section>
  )
}
