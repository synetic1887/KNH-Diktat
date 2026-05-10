import { useEffect, useRef, useState } from 'react'

import { useDocumentStore } from './documentSlice'
import {
  findSlots,
  renderBriefpapierWithMarkers,
  updateEmpfaengerSlots,
  updateInhaltSlot,
  type SlotRefs,
} from './briefpapier'
import { cn } from '@/lib/cn'

export interface BriefpapierPreviewProps {
  readonly interim?: string
}

/**
 * Lädt das Briefpapier genau einmal pro Mount und rendert es via docx-preview.
 * Danach werden Empfänger- und Inhalts-Slots imperativ aktualisiert — kein
 * Re-Render → kein Logo-Flackern beim Diktieren.
 */
export function BriefpapierPreview({ interim = '' }: BriefpapierPreviewProps) {
  const empfaenger = useDocumentStore((s) => s.sections['empfaenger'] ?? '')
  const inhalt = useDocumentStore((s) => s.sections['inhalt'] ?? '')
  const title = useDocumentStore((s) => s.title)
  const setTitle = useDocumentStore((s) => s.setTitle)
  const activeSectionId = useDocumentStore((s) => s.activeSectionId)
  const setActive = useDocumentStore((s) => s.setActiveSection)
  const loadDocument = useDocumentStore((s) => s.loadDocument)

  // 4 Empfänger-Zeilen aus `empfaenger` ableiten — beim Tippen werden sie
  // wieder zu einem \n-getrennten String zusammengesetzt.
  const empfLines = (() => {
    const split = empfaenger.split('\n')
    return [0, 1, 2, 3].map((i) => split[i] ?? '')
  })()

  const updateEmpfLine = (idx: number, value: string) => {
    const next = [...empfLines]
    next[idx] = value
    // trailing leere Zeilen wegschneiden, aber Zwischenleerzeilen erhalten
    let lastFilled = -1
    next.forEach((v, i) => {
      if (v.length > 0) lastFilled = i
    })
    const trimmed = next.slice(0, lastFilled + 1).join('\n')
    const snap = useDocumentStore.getState().getSnapshot()
    loadDocument({
      ...snap,
      sections: { ...snap.sections, empfaenger: trimmed },
    })
  }

  const containerRef = useRef<HTMLDivElement | null>(null)
  const slotsRef = useRef<SlotRefs | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  // Initial-Render: genau einmal, kein State im Dependency-Array.
  useEffect(() => {
    let cancelled = false
    const el = containerRef.current
    if (!el) return
    setStatus('loading')
    setError(null)
    void (async () => {
      try {
        await renderBriefpapierWithMarkers(el)
        if (cancelled) return
        slotsRef.current = findSlots(el)
        // Initial-Befüllung mit aktuellen State-Werten.
        updateEmpfaengerSlots(
          slotsRef.current,
          useDocumentStore.getState().sections['empfaenger'] ?? '',
        )
        updateInhaltSlot(slotsRef.current, useDocumentStore.getState().sections['inhalt'] ?? '')
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Slot-Updates bei State-Änderungen — KEIN docx-Re-Render.
  useEffect(() => {
    if (!slotsRef.current) return
    updateEmpfaengerSlots(slotsRef.current, empfaenger)
  }, [empfaenger])

  useEffect(() => {
    if (!slotsRef.current) return
    const live = interim
      ? `${inhalt}${inhalt && !inhalt.endsWith(' ') && !inhalt.endsWith('\n') ? ' ' : ''}${interim}`
      : inhalt
    updateInhaltSlot(slotsRef.current, live)
  }, [inhalt, interim])

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Dokument-Titel"
          className="w-full max-w-2xl border-0 bg-transparent text-2xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
        />
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Briefpapier KNH
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[260px_1fr] items-start">
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Adressfeld
            </h3>
            <button
              type="button"
              onClick={() => setActive('empfaenger')}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                activeSectionId === 'empfaenger'
                  ? 'bg-bordeaux text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
              title="Per Sprachbefehl auswählen"
            >
              {activeSectionId === 'empfaenger' ? 'aktiv' : 'auswählen'}
            </button>
          </div>
          {[0, 1, 2, 3].map((idx) => (
            <input
              key={idx}
              type="text"
              value={empfLines[idx]}
              onChange={(e) => updateEmpfLine(idx, e.target.value)}
              placeholder={
                idx === 0
                  ? 'z.B. Frau Dr. Anna Müller'
                  : idx === 1
                    ? 'z.B. Kanzlei Müller & Partner'
                    : idx === 2
                      ? 'z.B. Musterstraße 12'
                      : 'z.B. 60311 Frankfurt am Main'
              }
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ))}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            4 Zeilen — wie im Briefpapier. Tippen oder Tab zum Wechseln.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 self-stretch">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Brief-Inhalt (Diktat)
            </span>
            <button
              type="button"
              onClick={() => setActive('inhalt')}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                activeSectionId === 'inhalt'
                  ? 'bg-bordeaux text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              {activeSectionId === 'inhalt' ? 'aktiv' : 'auswählen'}
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Drücke „Diktat starten" in der Sidebar und sprich frei. Der Text wird unten in den Brief
            eingefügt. Sprachbefehl „springe zu Inhalt" wechselt hierher.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-2">
        {status === 'error' ? (
          <p className="text-sm text-destructive p-4">
            Vorschau konnte nicht geladen werden: {error}
          </p>
        ) : null}
        <div
          ref={containerRef}
          className={cn(
            'kd-briefpapier-host overflow-auto bg-white shadow-inner rounded',
            'min-h-[1100px]',
            status === 'loading' && 'opacity-60',
          )}
        />
      </div>
    </div>
  )
}
