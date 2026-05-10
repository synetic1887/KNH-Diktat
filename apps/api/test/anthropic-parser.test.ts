import { describe, expect, it } from 'vitest'

import {
  AnthropicProvider,
  extractFirstJsonObject,
  stripMarkdownFences,
} from '../src/lib/ai/AnthropicProvider'

describe('stripMarkdownFences', () => {
  it('entfernt ```json ... ```', () => {
    expect(stripMarkdownFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('entfernt ``` ... ```', () => {
    expect(stripMarkdownFences('```\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('lässt unmarkierten JSON-Text unangetastet', () => {
    expect(stripMarkdownFences('{"a":1}')).toBe('{"a":1}')
  })
})

describe('extractFirstJsonObject', () => {
  it('findet JSON inmitten von Vorrede', () => {
    const text = 'Hier ist die Antwort: {"edits": [], "explanation": "ok"} bitte schön.'
    expect(extractFirstJsonObject(text)).toBe('{"edits": [], "explanation": "ok"}')
  })

  it('handhabt geschachtelte Klammern und Strings korrekt', () => {
    const text = '{"edits":[{"sectionId":"a","find":"{","replace":"}"}],"explanation":"ok"}'
    expect(extractFirstJsonObject(text)).toBe(text)
  })

  it('gibt null bei fehlendem JSON', () => {
    expect(extractFirstJsonObject('Plain text')).toBeNull()
  })
})

describe('AnthropicProvider — Edit-Parsing', () => {
  function fakeClient(responseText: string) {
    return {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: responseText }] }
        },
      },
    } as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client']
  }

  it('parst gültige JSON-Antwort', async () => {
    const json = '{"edits":[{"sectionId":"a","find":"x","replace":"y"}],"explanation":"ok"}'
    const provider = new AnthropicProvider({
      apiKey: 'test',
      model: 'test',
      client: fakeClient(json),
    })
    const out = await provider.edit({
      document: [{ id: 'a', content: 'x' }],
      activeSectionId: 'a',
      instruction: 'tausche',
      templateId: 'schriftsatz',
    })
    expect(out.edits).toHaveLength(1)
    expect(out.explanation).toBe('ok')
  })

  it('parst JSON, das in Markdown-Fences steckt', async () => {
    const wrapped = '```json\n{"edits":[],"explanation":"nichts"}\n```'
    const provider = new AnthropicProvider({
      apiKey: 'test',
      model: 'test',
      client: fakeClient(wrapped),
    })
    const out = await provider.edit({
      document: [{ id: 'a', content: 'x' }],
      activeSectionId: 'a',
      instruction: 'tausche',
      templateId: 'schriftsatz',
    })
    expect(out.edits).toHaveLength(0)
  })

  it('wirft AIParseError bei kaputter Antwort', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'test',
      model: 'test',
      client: fakeClient('Plain text ohne JSON'),
    })
    await expect(
      provider.edit({
        document: [{ id: 'a', content: 'x' }],
        activeSectionId: 'a',
        instruction: 'tausche',
        templateId: 'schriftsatz',
      }),
    ).rejects.toThrow(/JSON/)
  })

  it('wirft AIParseError bei Schema-Fehler', async () => {
    const provider = new AnthropicProvider({
      apiKey: 'test',
      model: 'test',
      client: fakeClient('{"edits":[{"sectionId":"a"}],"explanation":"ok"}'),
    })
    await expect(
      provider.edit({
        document: [{ id: 'a', content: 'x' }],
        activeSectionId: 'a',
        instruction: 'tausche',
        templateId: 'schriftsatz',
      }),
    ).rejects.toThrow(/Schema/)
  })
})
