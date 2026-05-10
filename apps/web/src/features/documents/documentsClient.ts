const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export interface ServerDocument {
  readonly id: string
  readonly templateId: string | null
  readonly title: string
  readonly sections: Record<string, string>
  readonly updatedAt: number
}

export interface ServerTemplate {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly sections: ReadonlyArray<{
    id: string
    label: string
    kind: 'meta' | 'prose'
    aliases?: readonly string[]
  }>
  readonly updatedAt: number
}

export interface AuditEntry {
  readonly id: number
  readonly userId: string | null
  readonly action: string
  readonly targetType: string
  readonly targetId: string | null
  readonly payload: unknown
  readonly createdAt: number
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
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
    throw new HttpError(
      parsed.error?.message ?? `HTTP ${res.status}`,
      parsed.error?.code ?? `http_${res.status}`,
      res.status,
    )
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const documentsClient = {
  list(): Promise<{ documents: ServerDocument[] }> {
    return call('/documents')
  },
  get(id: string): Promise<{ document: ServerDocument }> {
    return call(`/documents/${id}`)
  },
  create(input: { templateId: string | null; title: string; sections: Record<string, string> }) {
    return call<{ document: ServerDocument }>('/documents', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  update(
    id: string,
    input: { templateId: string | null; title: string; sections: Record<string, string> },
  ) {
    return call<{ document: ServerDocument }>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },
  delete(id: string): Promise<{ ok: boolean }> {
    return call(`/documents/${id}`, { method: 'DELETE' })
  },
}

export const templatesClient = {
  list(): Promise<{ templates: ServerTemplate[] }> {
    return call('/templates')
  },
  create(input: { slug: string; title: string; sections: ServerTemplate['sections'] }) {
    return call<{ template: ServerTemplate }>('/templates', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  update(id: string, input: { slug: string; title: string; sections: ServerTemplate['sections'] }) {
    return call<{ template: ServerTemplate }>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },
  delete(id: string): Promise<{ ok: boolean }> {
    return call(`/templates/${id}`, { method: 'DELETE' })
  },
}

export const auditClient = {
  list(limit = 100): Promise<{ entries: AuditEntry[] }> {
    return call(`/audit?limit=${limit}`)
  },
}
