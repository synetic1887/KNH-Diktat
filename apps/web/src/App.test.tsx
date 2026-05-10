import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { App } from './App'
import { useAuthStore } from './features/auth/authStore'

beforeEach(() => {
  // global fetch ungenutzt im Test — wir setzen Auth-Status direkt.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ error: { code: 'unauth' } }), { status: 401 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  useAuthStore.setState({ status: 'unknown', user: null })
})

describe('App (Smoke)', () => {
  it('zeigt Login-Seite, wenn nicht angemeldet', () => {
    useAuthStore.setState({ status: 'anonymous', user: null })
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/Kanzlei-Diktat/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /Anmelden/i })).toBeInTheDocument()
  })

  it('zeigt Diktat-Aufnahme, wenn angemeldet', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.de', orgId: 'o1', role: 'member' },
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Aufnahme/i)).toBeInTheDocument()
  })
})
