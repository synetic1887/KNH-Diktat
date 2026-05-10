import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import type { AppDb } from '../db/db'
import { clients } from '../db/schema'
import { newId } from '../lib/security/ids'
import { authMiddleware } from '../lib/security/sessions'
import { logAudit } from '../lib/security/audit'

const ClientBody = z.object({
  name: z.string().min(2).max(200),
  address: z.string().max(500).nullable().optional(),
  azPrefix: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export interface ClientsRoutesDeps {
  readonly db: AppDb
}

function rowToDto(row: typeof clients.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    azPrefix: row.azPrefix,
    notes: row.notes,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
  }
}

export function createClientsRoutes(deps: ClientsRoutesDeps): Hono {
  const { db } = deps
  const app = new Hono()
  app.use('*', authMiddleware({ db, require: true }))

  app.get('/', async (c) => {
    const u = c.get('user')!
    const rows = await db.select().from(clients).where(eq(clients.orgId, u.orgId))
    return c.json({ clients: rows.map(rowToDto) })
  })

  app.post('/', zValidator('json', ClientBody), async (c) => {
    const u = c.get('user')!
    if (u.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: 'Adminrechte erforderlich' } }, 403)
    }
    const body = c.req.valid('json')
    const id = newId()
    await db.insert(clients).values({
      id,
      orgId: u.orgId,
      name: body.name,
      address: body.address ?? null,
      azPrefix: body.azPrefix ?? null,
      notes: body.notes ?? null,
    })
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'create',
      targetType: 'client',
      targetId: id,
      payload: { name: body.name },
    })
    const r = await db.select().from(clients).where(eq(clients.id, id)).limit(1)
    return c.json({ client: rowToDto(r[0]) }, 201)
  })

  app.put('/:id', zValidator('json', ClientBody), async (c) => {
    const u = c.get('user')!
    if (u.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: 'Adminrechte erforderlich' } }, 403)
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const r = await db
      .update(clients)
      .set({
        name: body.name,
        address: body.address ?? null,
        azPrefix: body.azPrefix ?? null,
        notes: body.notes ?? null,
      })
      .where(and(eq(clients.id, id), eq(clients.orgId, u.orgId)))
      .returning()
    if (r.length === 0)
      return c.json({ error: { code: 'not_found', message: 'Nicht gefunden' } }, 404)
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'update',
      targetType: 'client',
      targetId: id,
      payload: { name: body.name },
    })
    return c.json({ client: rowToDto(r[0]) })
  })

  app.delete('/:id', async (c) => {
    const u = c.get('user')!
    if (u.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: 'Adminrechte erforderlich' } }, 403)
    }
    const id = c.req.param('id')
    const r = await db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.orgId, u.orgId)))
      .returning()
    if (r.length === 0)
      return c.json({ error: { code: 'not_found', message: 'Nicht gefunden' } }, 404)
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'delete',
      targetType: 'client',
      targetId: id,
    })
    return c.json({ ok: true })
  })

  return app
}
