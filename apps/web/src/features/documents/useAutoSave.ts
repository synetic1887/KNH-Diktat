import { useEffect, useRef, useState } from 'react'

import { documentsClient } from './documentsClient'
import { useDocumentStore } from '@/features/document'

const DEBOUNCE_MS = 5000

interface AutoSaveState {
  readonly status: 'idle' | 'saving' | 'saved' | 'error'
  readonly serverId: string | null
  readonly lastSavedAt: number | null
  readonly errorMessage: string | null
}

/**
 * Speichert das aktuelle Dokument debounced auf den Server. Erstes Speichern
 * legt einen neuen Datensatz an; danach wird per PUT aktualisiert. Greift nur,
 * wenn das Dokument einen nicht-leeren Inhalt hat.
 */
export function useAutoSave(): AutoSaveState {
  const [state, setState] = useState<AutoSaveState>({
    status: 'idle',
    serverId: null,
    lastSavedAt: null,
    errorMessage: null,
  })
  const stateRef = useRef(state)
  stateRef.current = state

  const sections = useDocumentStore((s) => s.sections)
  const title = useDocumentStore((s) => s.title)
  const templateId = useDocumentStore((s) => s.templateId)

  useEffect(() => {
    const isEmpty = Object.values(sections).every((v) => !v.trim())
    if (isEmpty) return undefined
    const handle = setTimeout(async () => {
      setState((s) => ({ ...s, status: 'saving', errorMessage: null }))
      try {
        const current = stateRef.current
        if (current.serverId) {
          await documentsClient.update(current.serverId, { templateId, title, sections })
          setState({
            status: 'saved',
            serverId: current.serverId,
            lastSavedAt: Date.now(),
            errorMessage: null,
          })
        } else {
          const r = await documentsClient.create({ templateId, title, sections })
          setState({
            status: 'saved',
            serverId: r.document.id,
            lastSavedAt: Date.now(),
            errorMessage: null,
          })
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Fehler beim Speichern',
        }))
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [sections, title, templateId])

  return state
}
