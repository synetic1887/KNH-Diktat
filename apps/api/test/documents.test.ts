import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createApp } from '../src/app'
import { applySchema, openDb } from '../src/db/db'
import { orgs, users } from '../src/db/schema'
import { hashPassword } from '../src/lib/security/passwords'
import { newId } from '../src/lib/security/ids'
import { createLogger } from '../src/lib/log/logger'

async function buildAppWithTwoOrgs() {
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

  // Zwei Orgs + je 1 Member-User direkt in DB anlegen.
  const orgA = 'org-A'
  const orgB = 'org-B'
  await dbHandle.db.insert(orgs).values({ id: orgA, name: 'Org A' })
  await dbHandle.db.insert(orgs).values({ id: orgB, name: 'Org B' })

  const passwordHash = await hashPassword('einpasswort')
  const userA = newId()
  const userB = newId()
  await dbHandle.db.insert(users).values({
    id: userA,
    orgId: orgA,
    email: 'a@a.de',
    passwordHash,
    role: 'member',
  })
  await dbHandle.db.insert(users).values({
    id: userB,
    orgId: orgB,
    email: 'b@b.de',
    passwordHash,
    role: 'member',
  })

  const loginAs = async (email: string) => {
    const r = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'einpasswort' }),
    })
    expect(r.status).toBe(200)
    const setCookie = r.headers.get('set-cookie') ?? ''
    const m = setCookie.match(/kdsess=([^;]+)/)
    return `kdsess=${m?.[1]}`
  }
  void eq // type check is referenced but we don't need the import elsewhere
  return { app, dbHandle, loginAs, orgA, orgB }
}

describe('Documents-CRUD + Org-Isolation', () => {
  it('User der Org A sieht keine Dokumente von Org B', async () => {
    const { app, loginAs } = await buildAppWithTwoOrgs()
    const cookieA = await loginAs('a@a.de')
    const cookieB = await loginAs('b@b.de')

    // A erstellt Dokument
    const create = await app.request('/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieA },
      body: JSON.stringify({
        templateId: 'schriftsatz',
        title: 'Geheim A',
        sections: { sachverhalt: 'Sehr geheim' },
      }),
    })
    expect(create.status).toBe(201)
    const created = (await create.json()) as { document: { id: string; title: string } }
    expect(created.document.title).toBe('Geheim A')

    // B listet → leer
    const listB = await app.request('/api/documents', { headers: { cookie: cookieB } })
    expect(listB.status).toBe(200)
    const listBBody = (await listB.json()) as { documents: unknown[] }
    expect(listBBody.documents).toHaveLength(0)

    // A listet → 1 Eintrag
    const listA = await app.request('/api/documents', { headers: { cookie: cookieA } })
    const listABody = (await listA.json()) as { documents: { title: string }[] }
    expect(listABody.documents).toHaveLength(1)
    expect(listABody.documents[0].title).toBe('Geheim A')

    // B versucht das Dokument von A zu lesen → 404 (nicht 200!)
    const getB = await app.request(`/api/documents/${created.document.id}`, {
      headers: { cookie: cookieB },
    })
    expect(getB.status).toBe(404)
  })

  it('Update + Delete funktionieren nur in eigener Org', async () => {
    const { app, loginAs } = await buildAppWithTwoOrgs()
    const cookieA = await loginAs('a@a.de')
    const cookieB = await loginAs('b@b.de')

    const create = await app.request('/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieA },
      body: JSON.stringify({
        templateId: 'schriftsatz',
        title: 'A-Doc',
        sections: {},
      }),
    })
    const created = (await create.json()) as { document: { id: string } }

    // B versucht Update → 404
    const u = await app.request(`/api/documents/${created.document.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: cookieB },
      body: JSON.stringify({ templateId: 'schriftsatz', title: 'Hijack', sections: {} }),
    })
    expect(u.status).toBe(404)

    // B versucht Delete → 404
    const d = await app.request(`/api/documents/${created.document.id}`, {
      method: 'DELETE',
      headers: { cookie: cookieB },
    })
    expect(d.status).toBe(404)

    // A löscht erfolgreich
    const dA = await app.request(`/api/documents/${created.document.id}`, {
      method: 'DELETE',
      headers: { cookie: cookieA },
    })
    expect(dA.status).toBe(200)
  })
})

describe('Audit-Log + Templates', () => {
  it('Member darf Templates nicht anlegen', async () => {
    const { app, loginAs } = await buildAppWithTwoOrgs()
    const cookieA = await loginAs('a@a.de')
    const r = await app.request('/api/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieA },
      body: JSON.stringify({
        slug: 'mahnung',
        title: 'Mahnung',
        sections: [{ id: 'empfaenger', label: 'Empfänger', kind: 'meta' }],
      }),
    })
    expect(r.status).toBe(403)
  })

  it('Audit-Log ist nur für Admins', async () => {
    const { app, loginAs } = await buildAppWithTwoOrgs()
    const cookieA = await loginAs('a@a.de')
    const r = await app.request('/api/audit', { headers: { cookie: cookieA } })
    expect(r.status).toBe(403)
  })
})
