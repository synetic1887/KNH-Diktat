import { create } from 'zustand'

import type { TemplateId } from '@/store/appStore'

import { TEMPLATES, resolveSectionByAlias } from './templates'

const MAX_HISTORY = 50

export interface SectionsMap {
  readonly [sectionId: string]: string
}

export interface DocumentSnapshot {
  readonly templateId: TemplateId
  readonly title: string
  readonly sections: SectionsMap
  readonly activeSectionId: string
}

interface HistoryEntry {
  readonly sections: SectionsMap
  readonly activeSectionId: string
}

interface DocumentState {
  templateId: TemplateId
  title: string
  sections: SectionsMap
  activeSectionId: string
  history: HistoryEntry[]
}

interface DocumentActions {
  setActiveSection: (id: string) => void
  jumpToSection: (rawTarget: string) => boolean
  nextSection: () => void
  prevSection: () => void
  appendToActive: (text: string) => void
  appendRaw: (text: string) => void
  replaceInActive: (find: string, replace: string) => boolean
  deleteLastWord: () => void
  deleteLastSentence: () => void
  deleteParagraph: () => void
  undo: () => boolean
  setTemplate: (templateId: TemplateId) => void
  setTitle: (title: string) => void
  loadDocument: (snapshot: DocumentSnapshot) => void
  resetForTemplate: (templateId: TemplateId) => void
  getSnapshot: () => DocumentSnapshot
}

function emptySectionsFor(templateId: TemplateId): SectionsMap {
  const map: Record<string, string> = {}
  for (const s of TEMPLATES[templateId].sections) map[s.id] = ''
  return map
}

function pushHistory(state: DocumentState): HistoryEntry[] {
  const entry: HistoryEntry = {
    sections: { ...state.sections },
    activeSectionId: state.activeSectionId,
  }
  const next = state.history.length >= MAX_HISTORY ? state.history.slice(1) : state.history.slice()
  next.push(entry)
  return next
}

const initialTemplate: TemplateId = 'kanzleibrief'
const initialSections = emptySectionsFor(initialTemplate)
const initialActive =
  TEMPLATES[initialTemplate].defaultSectionId ?? TEMPLATES[initialTemplate].sections[0].id

function defaultSectionFor(templateId: TemplateId): string {
  return TEMPLATES[templateId].defaultSectionId ?? TEMPLATES[templateId].sections[0].id
}

/**
 * Hat das Dokument schon nicht-leeren Inhalt?
 * Wird vom UI ausgewertet, um vor `setTemplate` zu bestätigen.
 */
export function isDocumentEmpty(state: { sections: SectionsMap }): boolean {
  return Object.values(state.sections).every((v) => !v.trim())
}

export const useDocumentStore = create<DocumentState & DocumentActions>((set, get) => ({
  templateId: initialTemplate,
  title: 'Neuer Brief KNH',
  sections: initialSections,
  activeSectionId: initialActive,
  history: [],

  setActiveSection: (id) => {
    const t = TEMPLATES[get().templateId]
    if (!t.sections.some((s) => s.id === id)) return
    set({ activeSectionId: id })
  },

  jumpToSection: (rawTarget) => {
    const id = resolveSectionByAlias(get().templateId, rawTarget)
    if (!id) return false
    set({ activeSectionId: id })
    return true
  },

  nextSection: () => {
    const { templateId, activeSectionId } = get()
    const list = TEMPLATES[templateId].sections
    const i = list.findIndex((s) => s.id === activeSectionId)
    if (i >= 0 && i < list.length - 1) set({ activeSectionId: list[i + 1].id })
  },

  prevSection: () => {
    const { templateId, activeSectionId } = get()
    const list = TEMPLATES[templateId].sections
    const i = list.findIndex((s) => s.id === activeSectionId)
    if (i > 0) set({ activeSectionId: list[i - 1].id })
  },

  appendToActive: (text) => {
    set((state) => {
      const cur = state.sections[state.activeSectionId] ?? ''
      const needsSpace =
        cur.length > 0 &&
        !cur.endsWith(' ') &&
        !cur.endsWith('\n') &&
        !text.startsWith(' ') &&
        !text.startsWith('\n') &&
        !'.,;:!?'.includes(text[0] ?? '')
      const next = cur + (needsSpace ? ' ' : '') + text
      return {
        history: pushHistory(state),
        sections: { ...state.sections, [state.activeSectionId]: next },
      }
    })
  },

  appendRaw: (text) => {
    set((state) => ({
      history: pushHistory(state),
      sections: {
        ...state.sections,
        [state.activeSectionId]: (state.sections[state.activeSectionId] ?? '') + text,
      },
    }))
  },

  replaceInActive: (find, replace) => {
    const state = get()
    const cur = state.sections[state.activeSectionId] ?? ''
    if (!find) return false
    const lower = cur.toLowerCase()
    const idx = lower.indexOf(find.toLowerCase())
    if (idx < 0) return false
    const next = cur.slice(0, idx) + replace + cur.slice(idx + find.length)
    set({
      history: pushHistory(state),
      sections: { ...state.sections, [state.activeSectionId]: next },
    })
    return true
  },

  deleteLastWord: () => {
    set((state) => {
      const cur = (state.sections[state.activeSectionId] ?? '').replace(/\s+$/, '')
      const next = cur.replace(/\S+\s*$/, '')
      return {
        history: pushHistory(state),
        sections: { ...state.sections, [state.activeSectionId]: next },
      }
    })
  },

  deleteLastSentence: () => {
    set((state) => {
      const cur = state.sections[state.activeSectionId] ?? ''
      // Trailing whitespace + abschließendes Satzzeichen entfernen, dann
      // bis zum nächstvorgelagerten Satzende slicen.
      const stripped = cur.replace(/\s+$/, '').replace(/[.!?]+\s*$/, '')
      const idx = Math.max(
        stripped.lastIndexOf('.'),
        stripped.lastIndexOf('!'),
        stripped.lastIndexOf('?'),
      )
      const next = idx >= 0 ? stripped.slice(0, idx + 1) : ''
      return {
        history: pushHistory(state),
        sections: { ...state.sections, [state.activeSectionId]: next },
      }
    })
  },

  deleteParagraph: () => {
    set((state) => ({
      history: pushHistory(state),
      sections: { ...state.sections, [state.activeSectionId]: '' },
    }))
  },

  undo: () => {
    const state = get()
    if (state.history.length === 0) return false
    const prev = state.history[state.history.length - 1]
    set({
      history: state.history.slice(0, -1),
      sections: { ...prev.sections },
      activeSectionId: prev.activeSectionId,
    })
    return true
  },

  setTemplate: (templateId) => {
    if (!(templateId in TEMPLATES)) return
    set({
      templateId,
      title: `Neuer ${TEMPLATES[templateId].title}`,
      sections: emptySectionsFor(templateId),
      activeSectionId: defaultSectionFor(templateId),
      history: [],
    })
  },

  setTitle: (title) => set({ title }),

  loadDocument: (snapshot) => {
    set({
      templateId: snapshot.templateId,
      title: snapshot.title,
      sections: { ...snapshot.sections },
      activeSectionId: snapshot.activeSectionId,
      history: [],
    })
  },

  resetForTemplate: (templateId) => {
    set({
      templateId,
      title: `Neuer ${TEMPLATES[templateId].title}`,
      sections: emptySectionsFor(templateId),
      activeSectionId: defaultSectionFor(templateId),
      history: [],
    })
  },

  getSnapshot: () => {
    const s = get()
    return {
      templateId: s.templateId,
      title: s.title,
      sections: { ...s.sections },
      activeSectionId: s.activeSectionId,
    }
  },
}))
