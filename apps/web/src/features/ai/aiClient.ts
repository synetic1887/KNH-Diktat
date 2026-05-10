import type { TemplateId } from '@/store/appStore'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

interface ApiErrorBody {
  readonly error?: { readonly code?: string; readonly message?: string }
}

export class AIClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function postJson<TReq extends object, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let parsed: ApiErrorBody = {}
    try {
      parsed = (await res.json()) as ApiErrorBody
    } catch {
      /* noop */
    }
    throw new AIClientError(
      parsed.error?.message ?? `HTTP ${res.status}`,
      parsed.error?.code ?? `http_${res.status}`,
      res.status,
    )
  }
  return (await res.json()) as TRes
}

export type FormulateMode = 'formulate' | 'proofread'

export interface FormulateInput {
  readonly sectionContent: string
  readonly sectionLabel: string
  readonly templateTitle: string
  readonly mode?: FormulateMode
}

export interface FormulateOutput {
  readonly formulated: string
}

export type Edit =
  | { readonly sectionId: string; readonly find: string; readonly replace: string }
  | { readonly sectionId: string; readonly newText: string }

export interface EditInput {
  readonly document: ReadonlyArray<{ readonly id: string; readonly content: string }>
  readonly activeSectionId: string
  readonly instruction: string
  readonly templateId: TemplateId
}

export interface EditOutput {
  readonly edits: readonly Edit[]
  readonly explanation: string
}

type FormulateStreamFrame =
  | { type: 'delta'; text: string }
  | { type: 'done'; formulated: string }
  | { type: 'error'; code: string; message: string }

export const aiClient = {
  formulate(input: FormulateInput): Promise<FormulateOutput> {
    return postJson<FormulateInput, FormulateOutput>('/ai/formulate', input)
  },
  edit(input: EditInput): Promise<EditOutput> {
    return postJson<EditInput, EditOutput>('/ai/edit', input)
  },
  /**
   * Streaming-Variante. Ruft `onDelta` mit jedem Text-Stück auf.
   * Wirft `AIClientError` bei HTTP-Fehler oder Stream-Abbruch.
   * Resolved mit dem komplett zusammengesetzten Text am Ende.
   */
  async formulateStream(
    input: FormulateInput,
    onDelta: (chunk: string) => void,
  ): Promise<FormulateOutput> {
    const res = await fetch(`${API_BASE}/ai/formulate-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    })
    if (!res.ok || !res.body) {
      let parsed: { error?: { code?: string; message?: string } } = {}
      try {
        parsed = await res.json()
      } catch {
        /* noop */
      }
      throw new AIClientError(
        parsed.error?.message ?? `HTTP ${res.status}`,
        parsed.error?.code ?? `http_${res.status}`,
        res.status,
      )
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalText = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        let frame: FormulateStreamFrame
        try {
          frame = JSON.parse(line) as FormulateStreamFrame
        } catch {
          continue
        }
        if (frame.type === 'delta') onDelta(frame.text)
        else if (frame.type === 'done') finalText = frame.formulated
        else if (frame.type === 'error') throw new AIClientError(frame.message, frame.code, 502)
      }
    }
    return { formulated: finalText }
  },
  async health(): Promise<{ status: string; version: string }> {
    const res = await fetch(`${API_BASE}/health`, { credentials: 'include' })
    if (!res.ok) throw new AIClientError(`HTTP ${res.status}`, `http_${res.status}`, res.status)
    return (await res.json()) as { status: string; version: string }
  },
}
