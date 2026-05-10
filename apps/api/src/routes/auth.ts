import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { AppDb } from '../db/db'
import { users } from '../db/schema'
import { DEFAULT_ORG_ID, ensureSeed } from '../db/seed'
import { newId } from '../lib/security/ids'
import { hashPassword, verifyPassword } from '../lib/security/passwords'
import {
  SESSION_COOKIE,
  authMiddleware,
  clearSessionCookie,
  createSession,
  deleteSession,
  setSessionCookie,
} from '../lib/security/sessions'
import { tokenBucket, clientIp } from '../lib/security/rate-limit'

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  /** Optional: Name der neuen Org. Default: Default-Org für Solo-Entwicklung. */
  orgName: z.string().min(2).max(120).optional(),
})

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
})

export interface AuthRoutesDeps {
  readonly db: AppDb
}

export function createAuthRoutes(deps: AuthRoutesDeps): Hono {
  const { db } = deps
  const app = new Hono()

  // 10 Login-Versuche pro Minute pro IP
  const loginLimiter = tokenBucket({
    capacity: 10,
    refillPerSecond: 10 / 60,
    keyFn: (c) => `auth:${clientIp(c)}`,
  })

  app.post('/signup', loginLimiter, zValidator('json', SignupBody), async (c) => {
    const { email, password } = c.req.valid('json')
    const exists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (exists.length > 0) {
      return c.json({ error: { code: 'email_taken', message: 'E-Mail bereits registriert' } }, 409)
    }
    await ensureSeed(db)
    const hash = await hashPassword(password)
    const userId = newId()
    await db.insert(users).values({
      id: userId,
      orgId: DEFAULT_ORG_ID,
      email,
      passwordHash: hash,
      role: 'admin', // erste Person → Admin der Default-Org
    })
    const session = await createSession(db, userId, DEFAULT_ORG_ID)
    setSessionCookie(c, session.id, session.expiresAt)
    return c.json({ user: { id: userId, email, orgId: DEFAULT_ORG_ID, role: 'admin' } }, 201)
  })

  app.post('/login', loginLimiter, zValidator('json', LoginBody), async (c) => {
    const { email, password } = c.req.valid('json')
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    const user = rows[0]
    if (!user) {
      return c.json(
        { error: { code: 'invalid_credentials', message: 'Ungültige Zugangsdaten' } },
        401,
      )
    }
    const ok = await verifyPassword(user.passwordHash, password)
    if (!ok) {
      return c.json(
        { error: { code: 'invalid_credentials', message: 'Ungültige Zugangsdaten' } },
        401,
      )
    }
    const session = await createSession(db, user.id, user.orgId)
    setSessionCookie(c, session.id, session.expiresAt)
    return c.json({
      user: { id: user.id, email: user.email, orgId: user.orgId, role: user.role },
    })
  })

  app.post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) await deleteSession(db, token)
    clearSessionCookie(c)
    return c.json({ ok: true })
  })

  app.get('/me', authMiddleware({ db }), async (c) => {
    const user = c.get('user')
    if (!user)
      return c.json({ error: { code: 'unauthenticated', message: 'Nicht angemeldet' } }, 401)
    return c.json({ user })
  })

  return app
}
