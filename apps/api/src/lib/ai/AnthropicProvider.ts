import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import type {
  AIProvider,
  EditInput,
  EditOutput,
  FormulateInput,
  FormulateMode,
  FormulateOutput,
} from './AIProvider'

const PROOFREAD_SYSTEM = `Du bist Lektor mit Schwerpunkt deutsche Rechtssprache. Deine Aufgabe: Rechtschreibung, Grammatik, Interpunktion und Satzbau prüfen und behutsam korrigieren — nicht inhaltlich umschreiben.

Regeln:
- Nur Rechtschreib-, Grammatik- und Interpunktionsfehler korrigieren.
- Ungeschickte Satzbauten leicht glätten, aber NICHT inhaltlich umstellen oder verkürzen.
- Sinngemäße Aussage, Reihenfolge der Argumente, Fachbegriffe und Namen bleiben unverändert.
- Diktierte Floskeln (Diktat-Artefakte wie doppelte „und", abgebrochene Halbsätze) behutsam glätten.
- Korrekte Paragraphen-Schreibweise: „§ 280 Abs. 1 BGB", „Art. 6 Abs. 1 lit. b DSGVO".
- Wenn der Text bereits sauber ist: gib ihn unverändert zurück.

Antworte AUSSCHLIESSLICH mit dem korrigierten Text — keine Vorrede, keine Kommentare, keine Markdown-Fences, kein Erklärungsblock.`

const FORMULATE_SYSTEM = `Du bist Volljurist mit zweitem Staatsexamen, schreibst für eine deutsche Anwaltskanzlei.

Stil:
- Knapp, präzise, sachlich-juristisch — wie ein Schriftsatz an deutsches Gericht oder ein anwaltliches Mandantenschreiben.
- Korrekte juristische Terminologie: Anspruchsgrundlage, Substantiierung, Tatbestand, Tenor, hilfsweise, vorsorglich, Kläger/Beklagter, Antragsteller/Antragsgegner, Verfügungsberechtigung, etc.
- Im Tatbestand: Indikativ Präsens für aktuelle Tatsachen, Imperfekt für abgeschlossene Vorgänge.
- In rechtlicher Würdigung: Konjunktiv für Hilfserwägungen, Indikativ für eigene Wertung.
- Nominalstil maßvoll, keine umständlichen Schachtelsätze; jeder Satz trägt eine Aussage.
- Aktive Konstruktion bevorzugen, Passiv nur bei tatsächlich unklarem Akteur.
- Keine Floskeln („Selbstverständlich…"), keine Höflichkeitsschwurbel, kein „würden gerne".
- Paragraphen-Zitate korrekt: „§ 280 Abs. 1 BGB", „Art. 6 Abs. 1 lit. b DSGVO".

Bewahre alle Tatsachen, Daten, Namen und Zitate verbatim. Erfinde keine.

Antworte AUSSCHLIESSLICH mit dem überarbeiteten Text — keine Vorrede, keine Kommentare, keine Markdown-Fences.`

const EDIT_SYSTEM = `Du bist Volljurist mit zweitem Staatsexamen und arbeitest als Korrektur-Assistent für eine deutsche Anwaltskanzlei. Du bekommst:
1) ein Rechtsdokument als JSON (Liste von Sektionen mit id und content)
2) die aktive Sektion-ID
3) eine Anweisung in natürlicher Sprache (häufig diktiert)

Rufe das Tool "apply_edits" auf:
- Bevorzuge find/replace für minimale Änderungen — gerade bei Tippfehlern und Namenskorrekturen ist das richtige Mittel.
- "find" muss als Substring im Inhalt vorkommen (case-insensitive Match wird vom Frontend angewendet).
- "newText" nur, wenn die ganze Sektion umgeschrieben oder erheblich umstrukturiert werden soll.
- Verwende exakt die "sectionId"-Werte aus dem Dokument.
- Bei sprachlich-stilistischen Korrekturen: schreibe wie ein Volljurist (knapp, präzise, korrekte juristische Terminologie, Indikativ Präsens für Tatsachen).
- Bei reiner Tippfehler-Korrektur: nur den Tippfehler beheben, sonst nichts ändern.
- Erfinde keine Inhalte und ergänze keine Tatsachen, die nicht im Dokument oder in der Anweisung stehen.
- Bei unklarer Anweisung: leere edits-Liste + Erklärung warum.

Korrekte Paragraphen-Schreibweise: „§ 280 Abs. 1 BGB" (Leerzeichen nach §, Abs. mit Punkt). „Art. 6 Abs. 1 lit. b DSGVO".`

const APPLY_EDITS_TOOL: Anthropic.Tool = {
  name: 'apply_edits',
  description:
    'Liefert strukturierte Text-Edits für ein deutsches Rechtsdokument. Pro Edit entweder find/replace ODER newText, jeweils mit sectionId.',
  input_schema: {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sectionId: { type: 'string', description: 'ID einer existierenden Sektion' },
            find: {
              type: 'string',
              description: 'Exakte zu ersetzende Zeichenkette (Substring)',
            },
            replace: { type: 'string', description: 'Ersetzende Zeichenkette' },
            newText: {
              type: 'string',
              description: 'Alternativ: voller neuer Inhalt der Sektion',
            },
          },
          required: ['sectionId'],
        },
      },
      explanation: {
        type: 'string',
        description: 'Kurzer deutscher Hinweis (1-2 Sätze)',
      },
    },
    required: ['edits', 'explanation'],
  },
}

const EditSchema = z.object({
  edits: z.array(
    z.union([
      z.object({
        sectionId: z.string(),
        find: z.string(),
        replace: z.string(),
      }),
      z.object({
        sectionId: z.string(),
        newText: z.string(),
      }),
    ]),
  ),
  explanation: z.string(),
})

export interface AnthropicProviderOptions {
  readonly apiKey: string
  readonly model: string
  /** Für Tests injizierbar — Default: echter SDK-Client. */
  readonly client?: Anthropic
}

interface RawCallOpts {
  readonly system: string
  readonly user: string
  readonly maxTokens?: number
}

export function stripMarkdownFences(text: string): string {
  let s = text.trim()
  // entferne ```json ... ``` oder ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return s.trim()
}

export function extractFirstJsonObject(text: string): string | null {
  const trimmed = stripMarkdownFences(text)
  const start = trimmed.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === '\\') {
      escape = true
      continue
    }
    if (c === '"') inString = !inString
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  return null
}

export class AIParseError extends Error {
  readonly code = 'ai_parse_failed'
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message)
  }
}

export class AnthropicProvider implements AIProvider {
  private readonly client: Anthropic
  private readonly model: string

  constructor(opts: AnthropicProviderOptions) {
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey })
    this.model = opts.model
  }

  private async call({ system, user, maxTokens = 1024 }: RawCallOpts): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const text = res.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return text
  }

  private formulateUserPrompt(input: FormulateInput): string {
    const isProof = input.mode === 'proofread'
    const action = isProof
      ? 'Bitte korrigiere Rechtschreibung, Grammatik und Satzbau dieses Diktats. Nicht inhaltlich umschreiben.'
      : 'Bitte überarbeite diesen Text in juristischem Stil.'
    return `Vorlage: ${input.templateTitle}
Sektion: ${input.sectionLabel}

Rohtext der Sektion:
"""
${input.sectionContent}
"""

${action}`
  }

  private systemFor(mode: FormulateMode | undefined): string {
    return mode === 'proofread' ? PROOFREAD_SYSTEM : FORMULATE_SYSTEM
  }

  async formulate(input: FormulateInput): Promise<FormulateOutput> {
    const text = await this.call({
      system: this.systemFor(input.mode),
      user: this.formulateUserPrompt(input),
      maxTokens: 1024,
    })
    return { formulated: stripMarkdownFences(text) }
  }

  async formulateStream(
    input: FormulateInput,
    onDelta: (chunk: string) => void,
  ): Promise<FormulateOutput> {
    const user = this.formulateUserPrompt(input)
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 1024,
      system: this.systemFor(input.mode),
      messages: [{ role: 'user', content: user }],
    })

    let full = ''
    stream.on('text', (delta: string) => {
      full += delta
      onDelta(delta)
    })

    await stream.finalMessage()
    return { formulated: stripMarkdownFences(full) }
  }

  async edit(input: EditInput): Promise<EditOutput> {
    const user = `templateId: ${input.templateId}
activeSectionId: ${input.activeSectionId}
document: ${JSON.stringify(input.document)}

Anweisung:
${input.instruction}`

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      system: EDIT_SYSTEM,
      tools: [APPLY_EDITS_TOOL],
      tool_choice: { type: 'tool', name: 'apply_edits' },
      messages: [{ role: 'user', content: user }],
    })

    // Primärer Pfad: tool_use-Block (Anthropic garantiert wohlgeformtes JSON).
    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use',
    )
    if (toolUse) {
      const result = EditSchema.safeParse(toolUse.input)
      if (!result.success) {
        throw new AIParseError(
          `Schema-Fehler: ${result.error.message}`,
          JSON.stringify(toolUse.input),
        )
      }
      return result.data
    }

    // Fallback: Text-JSON parsen (für Mock-Tests + falls Modell tool_use nicht nutzt).
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const json = extractFirstJsonObject(text)
    if (!json) throw new AIParseError('Antwort enthielt weder tool_use noch JSON', text)
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (e) {
      throw new AIParseError(`JSON-Parse-Fehler: ${(e as Error).message}`, text)
    }
    const result = EditSchema.safeParse(parsed)
    if (!result.success) {
      throw new AIParseError(`Schema-Fehler: ${result.error.message}`, text)
    }
    return result.data
  }
}
