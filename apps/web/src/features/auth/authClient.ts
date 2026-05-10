const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly orgId: string
  readonly role: 'admin' | 'member'
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<TRes>(path: string, init?: RequestInit): Promise<TRes> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } = {}
    try {
      body = await res.json()
    } catch {
      /* noop */
    }
    throw new AuthError(
      body.error?.message ?? `HTTP ${res.status}`,
      body.error?.code ?? `http_${res.status}`,
      res.status,
    )
  }
  return (await res.json()) as TRes
}

export const authClient = {
  signup(email: string, password: string): Promise<{ user: AuthUser }> {
    return call('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
  },
  login(email: string, password: string): Promise<{ user: AuthUser }> {
    return call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  },
  logout(): Promise<{ ok: boolean }> {
    return call('/auth/logout', { method: 'POST' })
  },
  me(): Promise<{ user: AuthUser }> {
    return call('/auth/me')
  },
}
