const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export interface ServerClient {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly azPrefix: string | null
  readonly notes: string | null
  readonly createdAt: number
}

interface ApiError extends Error {
  status: number
  code: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let parsed: { error?: { code?: string; message?: string } } = {}
    try {
      parsed = await res.json()
    } catch {
      /* noop */
    }
    const e = new Error(parsed.error?.message ?? `HTTP ${res.status}`) as ApiError
    e.status = res.status
    e.code = parsed.error?.code ?? `http_${res.status}`
    throw e
  }
  return (await res.json()) as T
}

export interface ClientUpsertInput {
  readonly name: string
  readonly address?: string | null
  readonly azPrefix?: string | null
  readonly notes?: string | null
}

export const clientsClient = {
  list(): Promise<{ clients: ServerClient[] }> {
    return call('/clients')
  },
  create(input: ClientUpsertInput) {
    return call<{ client: ServerClient }>('/clients', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  update(id: string, input: ClientUpsertInput) {
    return call<{ client: ServerClient }>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },
  delete(id: string): Promise<{ ok: boolean }> {
    return call(`/clients/${id}`, { method: 'DELETE' })
  },
}
