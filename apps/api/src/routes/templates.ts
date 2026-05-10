import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import type { AppDb } from '../db/db'
import { templates } from '../db/schema'
import { newId } from '../lib/security/ids'
import { authMiddleware } from '../lib/security/sessions'
import { logAudit } from '../lib/security/audit'

const SectionSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  kind: z.enum(['meta', 'prose']),
  aliases: z.array(z.string().min(1)).optional(),
})

const TemplateBody = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_-]+$/, 'Slug nur a-z, 0-9, _, -'),
  title: z.string().min(1).max(120),
  sections: z.array(SectionSchema).min(1).max(40),
})

export interface TemplatesRoutesDeps {
  readonly db: AppDb
}

interface SectionDto {
  id: string
  label: string
  kind: 'meta' | 'prose'
  aliases?: string[]
}

function rowToDto(row: typeof templates.$inferSelect) {
  let parsed: SectionDto[] = []
  try {
    parsed = JSON.parse(row.sectionsJson) as SectionDto[]
  } catch {
    parsed = []
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    sections: parsed,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : row.updatedAt,
  }
}

export function createTemplatesRoutes(deps: TemplatesRoutesDeps): Hono {
  const { db } = deps
  const app = new Hono()

  app.use('*', authMiddleware({ db, require: true }))

  app.get('/', async (c) => {
    const u = c.get('user')!
    const rows = await db.select().from(templates).where(eq(templates.orgId, u.orgId))
    return c.json({ templates: rows.map(rowToDto) })
  })

  app.post('/', zValidator('json', TemplateBody), async (c) => {
    const u = c.get('user')!
    if (u.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: 'Adminrechte erforderlich' } }, 403)
    }
    const body = c.req.valid('json')
    const id = newId()
    try {
      await db.insert(templates).values({
        id,
        orgId: u.orgId,
        slug: body.slug,
        title: body.title,
        sectionsJson: JSON.stringify(body.sections),
        createdBy: u.id,
        updatedAt: new Date(),
      })
    } catch (err) {
      if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return c.json({ error: { code: 'slug_taken', message: 'Slug bereits vergeben' } }, 409)
      }
      throw err
    }
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'create',
      targetType: 'template',
      targetId: id,
      payload: { slug: body.slug, title: body.title },
    })
    const inserted = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
    return c.json({ template: rowToDto(inserted[0]) }, 201)
  })

  app.put('/:id', zValidator('json', TemplateBody), async (c) => {
    const u = c.get('user')!
    if (u.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: 'Adminrechte erforderlich' } }, 403)
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const r = await db
      .update(templates)
      .set({
        slug: body.slug,
        title: body.title,
        sectionsJson: JSON.stringify(body.sections),
        updatedAt: new Date(),
      })
      .where(and(eq(templates.id, id), eq(templates.orgId, u.orgId)))
      .returning()
    if (r.length === 0) {
      return c.json({ error: { code: 'not_found', message: 'Vorlage nicht gefunden' } }, 404)
    }
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'update',
      targetType: 'template',
      targetId: id,
      payload: { slug: body.slug, title: body.title },
    })
    return c.json({ template: rowToDto(r[0]) })
  })

  app.delete('/:id', async (c) => {
    const u = c.get('user')!
    if (u.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: 'Adminrechte erforderlich' } }, 403)
    }
    const id = c.req.param('id')
    const r = await db
      .delete(templates)
      .where(and(eq(templates.id, id), eq(templates.orgId, u.orgId)))
      .returning()
    if (r.length === 0) {
      return c.json({ error: { code: 'not_found', message: 'Vorlage nicht gefunden' } }, 404)
    }
    await logAudit(db, {
      orgId: u.orgId,
      userId: u.id,
      action: 'delete',
      targetType: 'template',
      targetId: id,
    })
    return c.json({ ok: true })
  })

  return app
}
