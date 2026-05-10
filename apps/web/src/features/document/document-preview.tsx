import { useDocumentStore } from './documentSlice'
import { TEMPLATES } from './templates'
import { cn } from '@/lib/cn'

export interface PreviewHighlight {
  readonly sectionId: string
  readonly start: number
  readonly end: number
}

export interface DocumentPreviewProps {
  /** Live-Interim-Text aus der laufenden Spracherkennung (inline am Ende). */
  readonly interim?: string
  /** Bereiche, die kurz aufleuchten sollen (KI-Edits). */
  readonly highlights?: readonly PreviewHighlight[]
}

interface ContentSegment {
  readonly text: string
  readonly highlight: boolean
}

function segmentContent(
  content: string,
  highlights: readonly PreviewHighlight[],
): ContentSegment[] {
  if (highlights.length === 0) return [{ text: content, highlight: false }]
  // Sortieren + Überlappungen mergen
  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  for (const h of sorted) {
    const last = merged[merged.length - 1]
    if (last && h.start <= last.end) {
      last.end = Math.max(last.end, h.end)
    } else {
      merged.push({ start: Math.max(0, h.start), end: Math.min(content.length, h.end) })
    }
  }
  const out: ContentSegment[] = []
  let cursor = 0
  for (const r of merged) {
    if (r.start > cursor) out.push({ text: content.slice(cursor, r.start), highlight: false })
    if (r.end > r.start) out.push({ text: content.slice(r.start, r.end), highlight: true })
    cursor = r.end
  }
  if (cursor < content.length) out.push({ text: content.slice(cursor), highlight: false })
  return out
}

export function DocumentPreview({ interim = '', highlights = [] }: DocumentPreviewProps) {
  const templateId = useDocumentStore((s) => s.templateId)
  const sections = useDocumentStore((s) => s.sections)
  const activeSectionId = useDocumentStore((s) => s.activeSectionId)
  const setActive = useDocumentStore((s) => s.setActiveSection)
  const title = useDocumentStore((s) => s.title)
  const setTitle = useDocumentStore((s) => s.setTitle)

  const tpl = TEMPLATES[templateId]
  const active = tpl.sections.find((s) => s.id === activeSectionId) ?? tpl.sections[0]
  const activeContent = sections[active.id] ?? ''
  const empty = activeContent.trim().length === 0
  const showSectionChips = tpl.sections.length > 1

  const activeHighlights = highlights.filter((h) => h.sectionId === active.id)
  const segments = empty ? [] : segmentContent(activeContent, activeHighlights)

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Dokument-Titel"
          className="w-full max-w-2xl border-0 bg-transparent text-2xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
        />
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {tpl.title}
        </span>
      </div>

      {showSectionChips ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tpl.sections.map((s) => {
            const hasHighlight = highlights.some((h) => h.sectionId === s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                data-active={s.id === active.id || undefined}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  s.id === active.id
                    ? 'bg-bordeaux text-primary-foreground'
                    : hasHighlight
                      ? 'bg-bordeaux/15 text-bordeaux ring-1 ring-bordeaux/40'
                      : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {s.label}
                {sections[s.id]?.trim() ? '' : ' °'}
              </button>
            )
          })}
        </div>
      ) : null}

      <div
        className={cn(
          'mt-4 rounded-lg border border-border bg-background p-6 shadow-inner min-h-[420px] flex flex-col',
        )}
      >
        <div
          className={cn(
            'flex-1 whitespace-pre-wrap text-[15px] leading-7',
            empty && !interim ? 'text-muted-foreground/70 italic' : 'text-foreground',
          )}
          aria-live="polite"
          aria-label={`Aktive Sektion: ${active.label}`}
        >
          {empty && !interim ? active.placeholder : null}
          {!empty
            ? segments.map((seg, i) =>
                seg.highlight ? (
                  <mark
                    key={i}
                    className="rounded bg-bordeaux/15 px-0.5 text-bordeaux animate-[pulse_1.2s_ease-in-out_2]"
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )
            : null}
          {interim ? (
            <span className="text-bordeaux/80 italic">
              {!empty ? ' ' : ''}
              {interim}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{active.label}</span>
          <span>
            {activeContent.length.toLocaleString('de-DE')} Zeichen ·{' '}
            {activeContent.split(/\s+/).filter(Boolean).length.toLocaleString('de-DE')} Wörter
          </span>
        </div>
      </div>
    </div>
  )
}
