import { useCallback, useEffect, useState } from 'react'

import { clientsClient, type ServerClient } from '@/features/clients/clientsClient'
import { fuzzyFindClients } from '@/features/clients/fuzzyMatch'
import {
  DictationButton,
  DictationDiagnostics,
  useDictation,
  useWhisperDictation,
  type Command,
  type DictationLogEntry,
} from '@/features/dictation'
import {
  BriefpapierPreview,
  DocumentPreview,
  ExportButton,
  isDocumentEmpty,
  requestAIEdit,
  requestAIFormulate,
  useDocumentStore,
  withAiBusy,
} from '@/features/document'
import type { HighlightRange } from '@/features/document/aiCommands'
import type { PreviewHighlight } from '@/features/document/document-preview'
import { useAutoSave } from '@/features/documents/useAutoSave'
import { useAppStore, type TemplateId } from '@/store/appStore'
import { cn } from '@/lib/cn'

const LEVEL_STYLE: Record<DictationLogEntry['level'], string> = {
  info: 'text-muted-foreground',
  cmd: 'text-bordeaux',
  final: 'text-foreground',
  interim: 'text-muted-foreground/70 italic',
  warn: 'text-amber-700',
  error: 'text-destructive',
}

const TEMPLATE_OPTIONS: ReadonlyArray<{ id: TemplateId; label: string }> = [
  { id: 'kanzleibrief', label: 'Briefpapier KNH' },
  { id: 'freitext', label: 'Freitext' },
  { id: 'schriftsatz', label: 'Schriftsatz' },
  { id: 'vermerk', label: 'Vermerk' },
]

export function DictationPage() {
  const recordingStatus = useAppStore((s) => s.recordingStatus)
  const aiBusy = useAppStore((s) => s.aiBusy)
  const speechEngine = useAppStore((s) => s.speechEngine)

  const docStore = useDocumentStore
  const templateId = useDocumentStore((s) => s.templateId)

  const [logs, setLogs] = useState<DictationLogEntry[]>([])
  const [interim, setInterim] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [clientList, setClientList] = useState<ServerClient[]>([])
  const [aiNotice, setAiNotice] = useState<{
    level: 'info' | 'warn' | 'error'
    message: string
  } | null>(null)
  const [highlights, setHighlights] = useState<readonly PreviewHighlight[]>([])
  const autoSave = useAutoSave()

  const flashHighlights = useCallback((ranges: readonly HighlightRange[]) => {
    if (ranges.length === 0) return
    setHighlights(ranges)
    const handle = setTimeout(() => setHighlights([]), 2500)
    return () => clearTimeout(handle)
  }, [])

  // Notice automatisch nach 6s ausblenden (außer Fehler — die bleiben).
  useEffect(() => {
    if (!aiNotice || aiNotice.level === 'error') return
    const handle = setTimeout(() => setAiNotice(null), 6000)
    return () => clearTimeout(handle)
  }, [aiNotice])

  useEffect(() => {
    void (async () => {
      try {
        const r = await clientsClient.list()
        setClientList(r.clients)
      } catch {
        /* clients are optional */
      }
    })()
  }, [])

  const handleLog = useCallback((entry: DictationLogEntry) => {
    setLogs((prev) => [...prev.slice(-99), entry])
  }, [])

  const runFormulate = useCallback(
    async (mode: 'formulate' | 'proofread') => {
      const sectionId = useDocumentStore.getState().activeSectionId
      setAiNotice({
        level: 'info',
        message:
          mode === 'proofread'
            ? 'KI prüft Rechtschreibung und Satzbau…'
            : 'KI formuliert im juristischen Stil…',
      })
      await withAiBusy(async () => {
        const r = await requestAIFormulate(sectionId, mode)
        if (r.ok) {
          flashHighlights([r.range])
          const msg =
            mode === 'proofread'
              ? '✓ Rechtschreibung & Satzbau überprüft.'
              : '✓ Formulierung übernommen.'
          setAiNotice({ level: 'info', message: msg })
          handleLog({ level: 'info', message: msg })
        } else {
          const msg = `KI ${mode === 'proofread' ? '„Rechtschreibung"' : '„formulieren"'} fehlgeschlagen (${r.reason}): ${r.message}`
          setAiNotice({
            level: r.reason === 'backend-not-configured' ? 'warn' : 'error',
            message: msg,
          })
          handleLog({
            level: r.reason === 'backend-not-configured' ? 'warn' : 'error',
            message: msg,
          })
          setShowLog(true)
        }
      })
    },
    [flashHighlights, handleLog],
  )

  const handleText = useCallback(
    (text: string) => {
      docStore.getState().appendToActive(text)
    },
    [docStore],
  )

  const handleTemplateChange = useCallback(
    (next: TemplateId) => {
      const empty = isDocumentEmpty(docStore.getState())
      if (!empty) {
        const ok = window.confirm(
          'Aktuelles Dokument enthält Inhalt. Beim Vorlagenwechsel geht alles verloren. Fortfahren?',
        )
        if (!ok) {
          handleLog({ level: 'warn', message: 'Vorlagenwechsel abgebrochen.' })
          return
        }
      }
      docStore.getState().setTemplate(next)
      handleLog({ level: 'info', message: `Vorlage gewechselt: ${next}` })
    },
    [docStore, handleLog],
  )

  const handleCommand = useCallback(
    (cmd: Command) => {
      const slice = docStore.getState()
      switch (cmd.category) {
        case 'punctuation':
          slice.appendRaw(cmd.char)
          return
        case 'control':
          return
        case 'edit':
          if (cmd.kind === 'undo') {
            const ok = slice.undo()
            handleLog({
              level: ok ? 'info' : 'warn',
              message: ok ? '↶ Rückgängig' : 'Nichts rückgängig',
            })
            return
          }
          if (cmd.kind === 'replace') {
            const ok = slice.replaceInActive(cmd.find, cmd.replace)
            handleLog({
              level: ok ? 'info' : 'warn',
              message: ok ? `„${cmd.find}" → „${cmd.replace}"` : `„${cmd.find}" nicht gefunden`,
            })
            return
          }
          if (cmd.kind === 'delete-last-word') return slice.deleteLastWord()
          if (cmd.kind === 'delete-last-sentence') return slice.deleteLastSentence()
          if (cmd.kind === 'delete-paragraph') return slice.deleteParagraph()
          return
        case 'navigation':
          if (cmd.kind === 'next-section') return slice.nextSection()
          if (cmd.kind === 'prev-section') return slice.prevSection()
          if (cmd.kind === 'jump-section') {
            const ok = slice.jumpToSection(cmd.target)
            if (!ok) handleLog({ level: 'warn', message: `Sektion „${cmd.target}" nicht gefunden` })
            return
          }
          return
        case 'template':
          if (cmd.kind === 'new-with-client') {
            const matches = fuzzyFindClients(cmd.clientQuery, clientList, 5)
            if (matches.length === 0) {
              handleLog({
                level: 'warn',
                message: `Mandant „${cmd.clientQuery}" nicht gefunden.`,
              })
              handleTemplateChange(cmd.templateId)
              return
            }
            const top = matches[0]
            const isUnique = matches.length === 1 || matches[1].score > top.score
            if (!isUnique) {
              handleLog({
                level: 'warn',
                message: `Mehrere Treffer für „${cmd.clientQuery}": ${matches
                  .map((m) => m.client.name)
                  .join(', ')} — bitte präzisieren.`,
              })
              handleTemplateChange(cmd.templateId)
              return
            }
            handleTemplateChange(cmd.templateId)
            const slice2 = docStore.getState()
            const targetSection =
              cmd.templateId === 'schriftsatz'
                ? 'rubrum_klaeger'
                : cmd.templateId === 'brief'
                  ? 'empfaenger'
                  : cmd.templateId === 'vermerk'
                    ? 'mandant'
                    : 'inhalt'
            const filled = `${top.client.name}${top.client.address ? `\n${top.client.address}` : ''}`
            slice2.loadDocument({
              ...slice2.getSnapshot(),
              sections: { ...slice2.sections, [targetSection]: filled },
              activeSectionId: targetSection,
            })
            handleLog({
              level: 'info',
              message: `✓ Vorlage ${cmd.templateId} mit „${top.client.name}" eröffnet.`,
            })
            return
          }
          handleTemplateChange(cmd.templateId)
          return
        case 'ai':
          if (cmd.kind === 'formulate') {
            void runFormulate('formulate')
            return
          }
          setAiNotice({ level: 'info', message: 'KI denkt nach…' })
          void withAiBusy(async () => {
            const r = await requestAIEdit(cmd.instruction, slice.getSnapshot())
            if (r.ok && r.appliedEdits > 0) {
              flashHighlights(r.ranges)
              const msg = `✓ ${r.appliedEdits} Änderung(en)${r.skipped ? ` (${r.skipped} übersprungen)` : ''}: ${r.explanation}`
              setAiNotice({ level: 'info', message: msg })
              handleLog({ level: 'info', message: msg })
            } else if (r.ok) {
              const msg = `KI hat keine passenden Edits gefunden${r.skipped ? ` (${r.skipped} übersprungen)` : ''}: ${r.explanation}`
              setAiNotice({ level: 'warn', message: msg })
              handleLog({ level: 'warn', message: msg })
              setShowLog(true)
            } else {
              const msg = `KI-Korrektur fehlgeschlagen (${r.reason}): ${r.message}`
              setAiNotice({ level: 'error', message: msg })
              handleLog({ level: 'error', message: msg })
              setShowLog(true)
            }
          })
          return
      }
    },
    [docStore, handleLog, handleTemplateChange, clientList, flashHighlights, runFormulate],
  )

  const webSpeech = useDictation({
    onCommand: handleCommand,
    onText: handleText,
    onInterim: setInterim,
    onLog: handleLog,
  })
  const whisper = useWhisperDictation({
    onCommand: handleCommand,
    onText: handleText,
    onLog: handleLog,
    onLoadProgress: (p) => {
      if (p.total > 0) {
        const pct = Math.round((p.loaded / p.total) * 100)
        handleLog({ level: 'info', message: `Lade ${p.file}: ${pct}%` })
      }
    },
  })
  const { isAvailable, isRecording, start, stop, runMicTest } =
    speechEngine === 'whisper-local' ? whisper : webSpeech

  const toggle = () => {
    if (isRecording) stop()
    else void start()
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Aufnahme</h2>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                recordingStatus === 'listening'
                  ? 'bg-bordeaux text-primary-foreground'
                  : recordingStatus === 'error'
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {recordingStatus}
              {aiBusy ? ' • KI' : ''}
            </span>
          </div>
          <DictationButton isRecording={isRecording} isAvailable={isAvailable} onToggle={toggle} />
          <DictationDiagnostics
            onMicTest={runMicTest}
            onLog={handleLog}
            isAvailable={isAvailable}
          />
          {!isAvailable ? (
            <p className="text-[11px] leading-relaxed text-destructive">
              Dieser Browser unterstützt SpeechRecognition nicht. Bitte Chrome oder Edge.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">KI-Werkzeuge</h2>
          <button
            type="button"
            onClick={() => void runFormulate('proofread')}
            disabled={aiBusy}
            className="w-full rounded-md border border-bordeaux/40 bg-bordeaux/5 px-3 py-2 text-left text-xs hover:bg-bordeaux/10 disabled:opacity-50"
          >
            <div className="font-semibold text-bordeaux">Rechtschreibung & Satzbau prüfen</div>
            <div className="text-[10px] text-muted-foreground">
              Korrigiert nur Tippfehler und glättet Satzbau — keine inhaltliche Umformulierung.
            </div>
          </button>
          <button
            type="button"
            onClick={() => void runFormulate('formulate')}
            disabled={aiBusy}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-50"
          >
            <div className="font-semibold">Juristisch formulieren</div>
            <div className="text-[10px] text-muted-foreground">
              Volljurist-Stil, knapp und präzise. Inhalte bleiben, Form ändert sich.
            </div>
          </button>
          <p className="text-[10px] text-muted-foreground pt-1">
            Wirkt auf die aktive Sektion. Sprachbefehl „formulieren" entspricht dem zweiten Button.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">Vorlage</h2>
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTemplateChange(opt.id)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  opt.id === templateId
                    ? 'bg-bordeaux text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Sprachbefehl: „vorlage freitext / brief / schriftsatz / vermerk".
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <h2 className="text-sm font-semibold text-foreground">Kurzhilfe</h2>
          <div>„punkt", „komma" → Satzzeichen</div>
          <div>„neuer absatz" → ⏎⏎</div>
          <div>„ändere X zu Y" → KI-Korrektur</div>
          <div>„formulieren" → KI poliert aktive Sektion</div>
          <div>„rückgängig" / „lösche letzten satz"</div>
          <div>„stopp" → Diktat beenden</div>
        </div>
      </aside>

      <article className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {autoSave.status === 'saving'
              ? 'Speichere…'
              : autoSave.status === 'saved' && autoSave.lastSavedAt
                ? `Auto-gespeichert · ${new Date(autoSave.lastSavedAt).toLocaleTimeString('de-DE')}`
                : autoSave.status === 'error'
                  ? `Fehler: ${autoSave.errorMessage}`
                  : 'Bereit zum Diktieren'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {showLog ? 'Log ausblenden' : 'Log anzeigen'}
            </button>
            <ExportButton />
          </div>
        </div>

        {aiNotice ? (
          <div
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              aiNotice.level === 'info'
                ? 'border-bordeaux/30 bg-bordeaux/5 text-bordeaux'
                : aiNotice.level === 'warn'
                  ? 'border-amber-500/40 bg-amber-50 text-amber-800'
                  : 'border-destructive/40 bg-destructive/5 text-destructive',
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <span>{aiNotice.message}</span>
              <button
                type="button"
                onClick={() => setAiNotice(null)}
                aria-label="Hinweis schließen"
                className="text-current/70 hover:text-current"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative">
          {templateId === 'kanzleibrief' ? (
            <BriefpapierPreview interim={interim} />
          ) : (
            <DocumentPreview interim={interim} highlights={highlights} />
          )}
          {aiBusy ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-background/40 backdrop-blur-[1px]">
              <span className="rounded-full bg-bordeaux px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-md animate-pulse">
                KI denkt nach…
              </span>
            </div>
          ) : null}
        </div>

        {showLog ? (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Diagnose-Log
            </h2>
            <div className="mt-2 max-h-[200px] overflow-auto rounded border border-border bg-card p-3 font-mono text-[11px]">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">Noch keine Einträge.</p>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={cn('whitespace-pre-wrap', LEVEL_STYLE[l.level])}>
                    {l.message}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </article>
    </section>
  )
}
