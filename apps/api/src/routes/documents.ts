import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import type { AppDb } from '../db/db'
import { documents } from '../db/schema'
import { newId } from '../lib/security/ids'
import { authMiddleware } from '../lib/security/sessions'
import { logAudit } from '../lib/security/audit'

const DocumentBody = z.object({
  templateId: z.string().min(1).max(60).nullable().optional(),
  title: z.string().min(1).max(200),
  sections: z.record(z.string(), z.string().max(200_000)),
})

export interface DocumentsRoutesDeps {
  readonly db: AppDb
}

function rowToDto(row: typeof documents.$inferSelect) {
  let sections: Record<string, string> = {}
  try {
    sections = JSON.parse(row.sectionsJson) as Record<string, string>
  } catch {
    sections = {}
  }
  return {
    id: row.id,
    templateId: row.templateId,
    title: row.title,
    sections,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : row.updatedAt,
  }
}

export function createDocumentsRoutes(deps: DocumentsRoutesDeps): Hono {
  const { db } = deps
  const app = new Hono()

  app.use('*', authMiddleware({ db, require: true }))

  app.get('/', async (c) => {
    const u = c.get('user')!
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.orgId, u.orgId))
      .orderBy(desc(documents.updatedAt))
      .limit(200)
    return c.json({ documents: rows.map(rowToDto) })
  })

  app.get('/:id', async (c) => {
    const u = c.get('user')!
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, c.req.param('id')), eq(documents.orgId, u.orgId)))
      .limit(1)
    const r = rows[0]
    if (!r) return c.json({ error: { code: 'not_found', message: 'Nicht gefunden' } }, 404)
    return c.json({ document: rowToDto(r) })
  })

  app.post('/', zValidator('json', DocumentBody), async (c) => {
    const u = c.get('user')!
    const body = c.req.valid('json')
    const id = newId()
    await db.insert(documents).values({
      id,
      orgId: u.orgId,
      templateId: body.templateId ?? null,
      title: body.title,
      sectionsJson: JSON.stringify(body.sections),
      createdBy: u.id,
      updatedAt: new Date(),
    })
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'create',
      targetType: 'document',
      targetId: id,
      payload: { title: body.title, templateId: body.templateId ?? null },
    })
    const r = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
    return c.json({ document: rowToDto(r[0]) }, 201)
  })

  app.put('/:id', zValidator('json', DocumentBody), async (c) => {
    const u = c.get('user')!
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const r = await db
      .update(documents)
      .set({
        templateId: body.templateId ?? null,
        title: body.title,
        sectionsJson: JSON.stringify(body.sections),
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.orgId, u.orgId)))
      .returning()
    if (r.length === 0)
      return c.json({ error: { code: 'not_found', message: 'Nicht gefunden' } }, 404)
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'update',
      targetType: 'document',
      targetId: id,
      payload: { title: body.title },
    })
    return c.json({ document: rowToDto(r[0]) })
  })

  app.delete('/:id', async (c) => {
    const u = c.get('user')!
    const id = c.req.param('id')
    const r = await db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.orgId, u.orgId)))
      .returning()
    if (r.length === 0)
      return c.json({ error: { code: 'not_found', message: 'Nicht gefunden' } }, 404)
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'delete',
      targetType: 'document',
      targetId: id,
    })
    return c.json({ ok: true })
  })

  return app
}
