import { describe, expect, it } from 'vitest'

import { createApp } from '../src/app'
import { applySchema, openDb } from '../src/db/db'
import { createLogger } from '../src/lib/log/logger'

function buildTestApp() {
  const dbHandle = openDb(':memory:')
  applySchema(dbHandle.raw)
  const logger = createLogger('test')
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
    logger,
  })
  return { app, dbHandle }
}

describe('GET /api/health', () => {
  it('liefert {status:"ok"} mit Version', async () => {
    const { app } = buildTestApp()
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; version: string }
    expect(body.status).toBe('ok')
    expect(body.version).toMatch(/\d+\.\d+\.\d+/)
  })
})

describe('Unbekannte Route', () => {
  it('liefert 404 mit klarem error.code', async () => {
    const { app } = buildTestApp()
    const res = await app.request('/api/quatsch')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })
})
