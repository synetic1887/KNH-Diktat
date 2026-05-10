import { describe, expect, it, vi } from 'vitest'

import type { AIProvider, EditOutput, FormulateOutput } from '../src/lib/ai/AIProvider'
import { AIParseError } from '../src/lib/ai/AnthropicProvider'
import { createApp } from '../src/app'
import { applySchema, openDb } from '../src/db/db'
import { createLogger } from '../src/lib/log/logger'

function buildApp(provider: AIProvider | null) {
  const dbHandle = openDb(':memory:')
  applySchema(dbHandle.raw)
  return createApp({
    env: {
      NODE_ENV: 'test',
      PORT: 0,
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: ':memory:',
      ANTHROPIC_MODEL: 'test',
      SESSION_COOKIE_NAME: 'kdsess',
    },
    db: dbHandle,
    provider,
    logger: createLogger('test'),
    aiOpenForDev: true, // Tests umgehen Auth.
  })
}

describe('POST /api/ai/formulate', () => {
  it('503 ohne Provider', async () => {
    const app = buildApp(null)
    const res = await app.request('/api/ai/formulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sectionContent: 'Test Inhalt',
        sectionLabel: 'Sachverhalt',
        templateTitle: 'Schriftsatz',
      }),
    })
    expect(res.status).toBe(503)
  })

  it('400 bei ungültigem Body', async () => {
    const provider: AIProvider = {
      formulateStream: async () => ({ formulated: '' }),
      formulate: async (): Promise<FormulateOutput> => ({ formulated: '' }),
      edit: async (): Promise<EditOutput> => ({ edits: [], explanation: '' }),
    }
    const app = buildApp(provider)
    const res = await app.request('/api/ai/formulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('200 mit Mock-Provider', async () => {
    const provider: AIProvider = {
      formulateStream: async () => ({ formulated: '' }),
      formulate: vi.fn(async (input) => ({
        formulated: `[überarbeitet] ${input.sectionContent}`,
      })),
      edit: async () => ({ edits: [], explanation: '' }),
    }
    const app = buildApp(provider)
    const res = await app.request('/api/ai/formulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sectionContent: 'Rohtext',
        sectionLabel: 'Sachverhalt',
        templateTitle: 'Schriftsatz',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { formulated: string }
    expect(body.formulated).toContain('[überarbeitet]')
  })
})

describe('POST /api/ai/edit', () => {
  it('502 bei AIParseError', async () => {
    const provider: AIProvider = {
      formulateStream: async () => ({ formulated: '' }),
      formulate: async () => ({ formulated: '' }),
      edit: async () => {
        throw new AIParseError('kein JSON', 'Plain text')
      },
    }
    const app = buildApp(provider)
    const res = await app.request('/api/ai/edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        document: [{ id: 'a', content: 'x' }],
        activeSectionId: 'a',
        instruction: 'mach was',
        templateId: 'schriftsatz',
      }),
    })
    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('ai_parse_failed')
  })

  it('200 mit gültigem Edit', async () => {
    const provider: AIProvider = {
      formulateStream: async () => ({ formulated: '' }),
      formulate: async () => ({ formulated: '' }),
      edit: async () => ({
        edits: [{ sectionId: 'a', find: 'x', replace: 'y' }],
        explanation: 'ok',
      }),
    }
    const app = buildApp(provider)
    const res = await app.request('/api/ai/edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        document: [{ id: 'a', content: 'x' }],
        activeSectionId: 'a',
        instruction: 'tausche x durch y',
        templateId: 'schriftsatz',
      }),
    })
    expect(res.status).toBe(200)
  })
})

describe('Rate-Limit', () => {
  it('greift nach 10 Requests pro Endpoint', async () => {
    const provider: AIProvider = {
      formulateStream: async () => ({ formulated: '' }),
      formulate: async (i) => ({ formulated: i.sectionContent }),
      edit: async () => ({ edits: [], explanation: '' }),
    }
    const app = buildApp(provider)
    const body = JSON.stringify({
      sectionContent: 'x',
      sectionLabel: 'a',
      templateTitle: 'b',
    })
    let last = 200
    for (let i = 0; i < 12; i++) {
      const res = await app.request('/api/ai/formulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
        body,
      })
      last = res.status
    }
    expect(last).toBe(429)
  })
})
