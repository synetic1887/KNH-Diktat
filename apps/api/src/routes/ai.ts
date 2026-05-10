import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AIProvider } from '../lib/ai/AIProvider'
import { AIParseError } from '../lib/ai/AnthropicProvider'
import { tokenBucket, clientIp } from '../lib/security/rate-limit'

const FormulateBody = z.object({
  sectionContent: z.string().min(1).max(20000),
  sectionLabel: z.string().min(1).max(120),
  templateTitle: z.string().min(1).max(120),
  mode: z.enum(['formulate', 'proofread']).optional(),
})

const EditBody = z.object({
  document: z
    .array(z.object({ id: z.string().min(1), content: z.string().max(20000) }))
    .min(1)
    .max(50),
  activeSectionId: z.string().min(1).max(120),
  instruction: z.string().min(3).max(2000),
  templateId: z.enum(['kanzleibrief', 'freitext', 'schriftsatz', 'brief', 'vermerk']),
})

export interface AiRoutesDeps {
  /** Falls null/undefined → Stub-Antworten ohne externen Call. */
  readonly provider: AIProvider | null
}

export function createAiRoutes(deps: AiRoutesDeps): Hono {
  const app = new Hono()

  // 30/min pro IP (gesamt)
  app.use(
    '*',
    tokenBucket({
      capacity: 30,
      refillPerSecond: 30 / 60,
      keyFn: (c) => `ai:ip:${clientIp(c)}`,
    }),
  )
  // 10/min pro IP+Endpoint
  app.use(
    '*',
    tokenBucket({
      capacity: 10,
      refillPerSecond: 10 / 60,
      keyFn: (c) => `ai:${c.req.path}:${clientIp(c)}`,
    }),
  )

  app.post('/formulate', zValidator('json', FormulateBody), async (c) => {
    if (!deps.provider) {
      return c.json(
        { error: { code: 'no_provider', message: 'KI-Provider nicht konfiguriert.' } },
        503,
      )
    }
    try {
      const body = c.req.valid('json')
      const out = await deps.provider.formulate(body)
      return c.json(out)
    } catch (err) {
      const e = err as Error
      return c.json(
        { error: { code: 'ai_failed', message: e.message ?? 'AI-Aufruf fehlgeschlagen' } },
        502,
      )
    }
  })

  // Streaming-Variante: Server-Sent-Events (NDJSON-Frames).
  // Clients senden gleichen Body wie /formulate, erhalten zeilenweise:
  //   {"type":"delta","text":"…"}\n
  //   …
  //   {"type":"done","formulated":"<voller Text>"}\n
  // oder bei Fehler:
  //   {"type":"error","code":"ai_failed","message":"…"}\n
  app.post('/formulate-stream', zValidator('json', FormulateBody), async (c) => {
    if (!deps.provider) {
      return c.json(
        { error: { code: 'no_provider', message: 'KI-Provider nicht konfiguriert.' } },
        503,
      )
    }
    const body = c.req.valid('json')
    const provider = deps.provider
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder()
        const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))
        try {
          const out = await provider.formulateStream(body, (delta) => {
            send({ type: 'delta', text: delta })
          })
          send({ type: 'done', formulated: out.formulated })
        } catch (err) {
          const e = err as Error
          send({
            type: 'error',
            code: 'ai_failed',
            message: e.message ?? 'AI-Aufruf fehlgeschlagen',
          })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    })
  })

  app.post('/edit', zValidator('json', EditBody), async (c) => {
    if (!deps.provider) {
      return c.json(
        { error: { code: 'no_provider', message: 'KI-Provider nicht konfiguriert.' } },
        503,
      )
    }
    try {
      const body = c.req.valid('json')
      const out = await deps.provider.edit(body)
      return c.json(out)
    } catch (err) {
      if (err instanceof AIParseError) {
        return c.json({ error: { code: err.code, message: err.message } }, 502)
      }
      const e = err as Error
      return c.json(
        { error: { code: 'ai_failed', message: e.message ?? 'AI-Aufruf fehlgeschlagen' } },
        502,
      )
    }
  })

  return app
}
