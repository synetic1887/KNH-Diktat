import { aiClient, AIClientError } from '@/features/ai/aiClient'
import { useAppStore } from '@/store/appStore'

import { useDocumentStore, type SectionsMap } from './documentSlice'
import { TEMPLATES } from './templates'

export type AIFailureReason = 'backend-not-configured' | 'rate-limit' | 'http' | 'parse' | 'network'

export interface HighlightRange {
  readonly sectionId: string
  /** 0-basiert, inklusive */
  readonly start: number
  /** 0-basiert, exklusive */
  readonly end: number
}

export type AIEditResult =
  | {
      ok: true
      explanation: string
      appliedEdits: number
      skipped: number
      ranges: readonly HighlightRange[]
    }
  | { ok: false; reason: AIFailureReason; message: string }

export type AIFormulateResult =
  | { ok: true; formulated: string; range: HighlightRange }
  | { ok: false; reason: AIFailureReason; message: string }

function classify(err: unknown): AIFailureReason {
  if (err instanceof AIClientError) {
    if (err.status === 503 || err.code === 'no_provider') return 'backend-not-configured'
    if (err.status === 429 || err.code === 'rate_limit') return 'rate-limit'
    if (err.code === 'ai_parse_failed') return 'parse'
    return 'http'
  }
  return 'network'
}

interface ApplyResult {
  applied: number
  skipped: number
  ranges: HighlightRange[]
}

function applyEditsToActive(
  edits: ReadonlyArray<
    { sectionId: string; find: string; replace: string } | { sectionId: string; newText: string }
  >,
  knownSectionIds: ReadonlySet<string>,
): ApplyResult {
  const slice = useDocumentStore.getState()
  const result: ApplyResult = { applied: 0, skipped: 0, ranges: [] }

  for (const e of edits) {
    if (!knownSectionIds.has(e.sectionId)) {
      result.skipped++
      continue
    }
    if ('newText' in e) {
      const cur = slice.getSnapshot()
      slice.loadDocument({
        ...cur,
        sections: { ...cur.sections, [e.sectionId]: e.newText },
      })
      result.applied++
      result.ranges.push({ sectionId: e.sectionId, start: 0, end: e.newText.length })
    } else {
      // Position des Treffers VOR replace bestimmen, damit der Range nach dem Edit korrekt ist.
      const before = useDocumentStore.getState().sections[e.sectionId] ?? ''
      const idx = before.toLowerCase().indexOf(e.find.toLowerCase())
      const prev = useDocumentStore.getState().activeSectionId
      useDocumentStore.getState().setActiveSection(e.sectionId)
      const ok = useDocumentStore.getState().replaceInActive(e.find, e.replace)
      useDocumentStore.getState().setActiveSection(prev)
      if (ok && idx >= 0) {
        result.applied++
        result.ranges.push({
          sectionId: e.sectionId,
          start: idx,
          end: idx + e.replace.length,
        })
      } else {
        result.skipped++
      }
    }
  }
  return result
}

export type AIFormulateMode = 'formulate' | 'proofread'

export async function requestAIFormulate(
  sectionId: string,
  mode: AIFormulateMode = 'formulate',
): Promise<AIFormulateResult> {
  try {
    const slice = useDocumentStore.getState()
    const tpl = TEMPLATES[slice.templateId]
    const section = tpl.sections.find((s) => s.id === sectionId)
    if (!section) {
      return { ok: false, reason: 'http', message: 'Sektion nicht gefunden.' }
    }
    const sectionContent = (slice.sections[sectionId] ?? '').trim()
    if (!sectionContent) {
      return { ok: false, reason: 'http', message: 'Sektion ist leer.' }
    }

    // Originalinhalt sichern (für Snapshot/Undo) und Sektion direkt streamen.
    const before = useDocumentStore.getState().sections[sectionId] ?? ''
    let streamed = ''
    const writeStreamed = () => {
      const cur = useDocumentStore.getState()
      cur.loadDocument({
        ...cur.getSnapshot(),
        sections: { ...cur.sections, [sectionId]: streamed },
      })
    }

    const out = await aiClient.formulateStream(
      {
        sectionContent,
        sectionLabel: section.label,
        templateTitle: tpl.title,
        mode,
      },
      (delta) => {
        streamed += delta
        writeStreamed()
      },
    )

    const final = out.formulated || streamed
    // Final mit komplettem Text + Snapshot für Undo (löst History-Eintrag aus).
    const cur = useDocumentStore.getState()
    cur.replaceInActive(before, final) // erzeugt History-Eintrag, falls before im Inhalt steht
    if ((cur.sections[sectionId] ?? '') !== final) {
      cur.loadDocument({
        ...cur.getSnapshot(),
        sections: { ...cur.sections, [sectionId]: final },
      })
    }

    return {
      ok: true,
      formulated: final,
      range: { sectionId, start: 0, end: final.length },
    }
  } catch (err) {
    const reason = classify(err)
    return {
      ok: false,
      reason,
      message: err instanceof Error ? err.message : 'Unbekannter Fehler',
    }
  }
}

export async function requestAIEdit(
  instruction: string,
  snapshot: ReturnType<typeof useDocumentStore.getState>['getSnapshot'] extends () => infer R
    ? R
    : never,
): Promise<AIEditResult> {
  try {
    const docArray = Object.entries(snapshot.sections as SectionsMap).map(([id, content]) => ({
      id,
      content,
    }))
    const out = await aiClient.edit({
      document: docArray,
      activeSectionId: snapshot.activeSectionId,
      instruction,
      templateId: snapshot.templateId,
    })
    const known = new Set(docArray.map((d) => d.id))
    const r = applyEditsToActive(out.edits, known)
    return {
      ok: true,
      explanation: out.explanation,
      appliedEdits: r.applied,
      skipped: r.skipped,
      ranges: r.ranges,
    }
  } catch (err) {
    const reason = classify(err)
    return {
      ok: false,
      reason,
      message: err instanceof Error ? err.message : 'Unbekannter Fehler',
    }
  }
}

export async function withAiBusy<T>(fn: () => Promise<T>): Promise<T> {
  const setAiBusy = useAppStore.getState().setAiBusy
  setAiBusy(true)
  try {
    return await fn()
  } finally {
    setAiBusy(false)
  }
}
