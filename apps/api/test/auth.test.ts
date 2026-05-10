import { describe, expect, it } from 'vitest'

import { createApp } from '../src/app'
import { applySchema, openDb } from '../src/db/db'
import { createLogger } from '../src/lib/log/logger'

function buildApp() {
  const dbHandle = openDb(':memory:')
  applySchema(dbHandle.raw)
  const app = createApp({
    env: {
      NODE_ENV: 'test',
      PORT: 0,
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: ':memory:',
      ANTHROPIC_MODEL: 'test',
      SESSION_COOKIE_NAME: 'kdsess',
    },
    db: dbHandle,
    provider: null,
    logger: createLogger('test'),
  })
  return { app, dbHandle }
}

function extractCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const m = setCookie.match(/kdsess=([^;]+)/)
  return m ? `kdsess=${m[1]}` : null
}

describe('Auth-Flow', () => {
  it('signup → me → logout → me=401', async () => {
    const { app } = buildApp()

    // Signup
    const signup = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.org', password: 'supergeheim' }),
    })
    expect(signup.status).toBe(201)
    const cookie = extractCookie(signup.headers.get('set-cookie'))
    expect(cookie).toBeTruthy()

    // /me
    const me = await app.request('/api/auth/me', {
      headers: { cookie: cookie! },
    })
    expect(me.status).toBe(200)
    const meBody = (await me.json()) as { user: { email: string; role: string } }
    expect(meBody.user.email).toBe('admin@example.org')
    expect(meBody.user.role).toBe('admin')

    // Logout
    const logout = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie: cookie! },
    })
    expect(logout.status).toBe(200)

    // /me ohne gültige Session → 401
    const me2 = await app.request('/api/auth/me', { headers: { cookie: cookie! } })
    expect(me2.status).toBe(401)
  })

  it('login mit falschem Passwort → 401', async () => {
    const { app } = buildApp()
    await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.de', password: 'einpasswort' }),
    })
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.de', password: 'falsch1234' }),
    })
    expect(login.status).toBe(401)
  })

  it('signup mit existierender E-Mail → 409', async () => {
    const { app } = buildApp()
    const body = JSON.stringify({ email: 'dup@a.de', password: 'einpasswort' })
    const r1 = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    expect(r1.status).toBe(201)
    const r2 = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    expect(r2.status).toBe(409)
  })

  it('/me ohne Cookie → 401', async () => {
    const { app } = buildApp()
    const me = await app.request('/api/auth/me')
    expect(me.status).toBe(401)
  })

  it('/api/ai/* erfordert Login (kein aiOpenForDev)', async () => {
    const { app } = buildApp()
    const res = await app.request('/api/ai/formulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sectionContent: 'x',
        sectionLabel: 'a',
        templateTitle: 'b',
      }),
    })
    expect(res.status).toBe(401)
  })
})
