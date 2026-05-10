import { Hono } from 'hono'
import { desc, eq } from 'drizzle-orm'

import type { AppDb } from '../db/db'
import { auditLog } from '../db/schema'
import { authMiddleware } from '../lib/security/sessions'

export interface AuditRoutesDeps {
  readonly db: AppDb
}

export function createAuditRoutes(deps: AuditRoutesDeps): Hono {
  const { db } = deps
  const app = new Hono()
  app.use('*', authMiddleware({ db, require: true, requireRole: 'admin' }))

  app.get('/', async (c) => {
    const u = c.get('user')!
    const limitParam = Number(c.req.query('limit') ?? '100')
    const limit = Math.min(500, Math.max(1, isFinite(limitParam) ? limitParam : 100))
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.orgId, u.orgId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
    return c.json({
      entries: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        payload: r.payloadJson ? JSON.parse(r.payloadJson) : null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
      })),
    })
  })

  return app
}
