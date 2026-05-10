import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'

import type { AppDb } from '../../db/db'
import { sessions, users } from '../../db/schema'
import { newSessionId } from './ids'

export const SESSION_COOKIE = 'kdsess'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 Tage

export interface SessionUser {
  readonly id: string
  readonly email: string
  readonly orgId: string
  readonly role: 'admin' | 'member'
}

export async function createSession(
  db: AppDb,
  userId: string,
  orgId: string,
): Promise<{ id: string; expiresAt: Date }> {
  const id = newSessionId()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ id, userId, orgId, expiresAt })
  return { id, expiresAt }
}

export function setSessionCookie(c: Context, token: string, expires: Date): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: c.req.url.startsWith('https://'),
    path: '/',
    expires,
  })
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export async function loadSessionUser(db: AppDb, token: string): Promise<SessionUser | null> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      orgId: users.orgId,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1)
  const r = rows[0]
  if (!r) return null
  if (r.expiresAt instanceof Date && r.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token))
    return null
  }
  return { id: r.userId, email: r.email, orgId: r.orgId, role: r.role }
}

declare module 'hono' {
  interface ContextVariableMap {
    user?: SessionUser
  }
}

export interface AuthMiddlewareOptions {
  readonly db: AppDb
  readonly require?: boolean
  readonly requireRole?: 'admin' | 'member'
}

/** Lädt User in den Context. Bei `require:true` → 401 ohne gültige Session. */
export function authMiddleware(opts: AuthMiddlewareOptions): MiddlewareHandler {
  return async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    const user = token ? await loadSessionUser(opts.db, token) : null
    if (user) c.set('user', user)
    if (opts.require && !user) {
      return c.json({ error: { code: 'unauthenticated', message: 'Nicht angemeldet' } }, 401)
    }
    if (opts.requireRole === 'admin' && user?.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: 'Adminrechte erforderlich' } }, 403)
    }
    await next()
  }
}

export async function deleteSession(db: AppDb, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token))
}
