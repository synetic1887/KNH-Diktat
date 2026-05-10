import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { AppEnv } from './lib/env'
import type { AIProvider } from './lib/ai/AIProvider'
import type { Logger } from './lib/log/logger'
import { createAiRoutes } from './routes/ai'
import { createAuthRoutes } from './routes/auth'
import { createAuditRoutes } from './routes/audit'
import { createClientsRoutes } from './routes/clients'
import { createDocumentsRoutes } from './routes/documents'
import { createTemplatesRoutes } from './routes/templates'
import type { DbHandle } from './db/db'
import { authMiddleware } from './lib/security/sessions'

export interface AppDeps {
  readonly env: AppEnv
  readonly db: DbHandle
  readonly provider: AIProvider | null
  readonly logger: Logger
  /** Wenn true, sind /api/ai/* OHNE Auth erreichbar — nur für Phase-2-Smoke. */
  readonly aiOpenForDev?: boolean
}

const VERSION = '0.1.0'

export function createApp(deps: AppDeps): Hono {
  const { env, db, provider, logger, aiOpenForDev } = deps
  const app = new Hono()

  const allowedOrigins = (() => {
    if (env.NODE_ENV === 'production') {
      return (
        env.CORS_ORIGINS_PROD?.split(',')
          .map((s) => s.trim())
          .filter(Boolean) ?? []
      )
    }
    return [env.CORS_ORIGIN]
  })()

  app.use(
    '*',
    cors({
      origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : null),
      credentials: true,
      allowHeaders: ['Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  )

  app.use('*', async (c, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms }, 'req')
  })

  app.get('/api/health', (c) => c.json({ status: 'ok', version: VERSION }))

  app.route('/api/auth', createAuthRoutes({ db: db.db }))

  // KI-Routes: in Prod nur mit Auth, im Dev optional offen für Smoke-Tests.
  if (aiOpenForDev) {
    app.route('/api/ai', createAiRoutes({ provider }))
  } else {
    app.use('/api/ai/*', authMiddleware({ db: db.db, require: true }))
    app.route('/api/ai', createAiRoutes({ provider }))
  }

  app.route('/api/templates', createTemplatesRoutes({ db: db.db }))
  app.route('/api/documents', createDocumentsRoutes({ db: db.db }))
  app.route('/api/clients', createClientsRoutes({ db: db.db }))
  app.route('/api/audit', createAuditRoutes({ db: db.db }))

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Unbekannte Route' } }, 404))
  app.onError((err, c) => {
    logger.error({ err }, 'unhandled')
    return c.json({ error: { code: 'internal', message: 'Interner Fehler' } }, 500)
  })

  return app
}
