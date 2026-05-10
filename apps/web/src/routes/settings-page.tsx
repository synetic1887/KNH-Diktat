import { useAppStore, type SpeechEngine } from '@/store/appStore'
import { cn } from '@/lib/cn'

const ENGINE_OPTIONS: ReadonlyArray<{
  id: SpeechEngine
  title: string
  body: string
  pro: readonly string[]
  contra: readonly string[]
}> = [
  {
    id: 'web-speech',
    title: 'Web Speech API (Chrome/Edge)',
    body: 'Standard-Spracherkennung des Browsers. Schnell, Live-Interim-Anzeige, kein Modell-Download.',
    pro: ['Sofort einsatzbereit', 'Live-Vorschau beim Sprechen', '0 MB Download'],
    contra: [
      'Audio läuft über Google-Server (USA, nicht DSGVO-konform für Mandatsdaten)',
      'Nur Chrome/Edge',
    ],
  },
  {
    id: 'whisper-local',
    title: 'Whisper (lokal im Browser, DSGVO)',
    body: 'OpenAI Whisper läuft via @huggingface/transformers im Browser. Audio verlässt den Rechner nicht.',
    pro: [
      'Audio bleibt lokal — DSGVO-konform',
      'Bessere de-DE-Erkennung mit Fachvokabular',
      'Funktioniert auch offline (nach Download)',
    ],
    contra: [
      'Erste Nutzung: ~150 MB Modell-Download',
      'Kein Live-Interim — Text erscheint chunkweise (alle 1–6 s)',
      'Etwas höhere Latenz auf älteren Geräten',
    ],
  },
]

export function SettingsPage() {
  const engine = useAppStore((s) => s.speechEngine)
  const setEngine = useAppStore((s) => s.setSpeechEngine)

  return (
    <section className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Wahl der Spracherkennung. Wechselt sofort — neue Aufnahme startet mit gewählter Engine.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Spracherkennung</h2>
        <div className="space-y-3">
          {ENGINE_OPTIONS.map((opt) => {
            const active = opt.id === engine
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEngine(opt.id)}
                aria-pressed={active}
                className={cn(
                  'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-bordeaux bg-bordeaux/5'
                    : 'border-border bg-background hover:bg-accent/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{opt.title}</span>
                  {active ? (
                    <span className="rounded bg-bordeaux px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary-foreground">
                      Aktiv
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{opt.body}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[11px]">
                  <ul className="space-y-0.5">
                    {opt.pro.map((p, i) => (
                      <li key={i} className="text-emerald-700">
                        + {p}
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-0.5">
                    {opt.contra.map((c, i) => (
                      <li key={i} className="text-amber-700">
                        − {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">KI-Provider</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Anthropic (Claude Sonnet) — der API-Key liegt ausschließlich serverseitig in{' '}
          <code className="font-mono">.env</code>. System-Prompt verlangt Stil eines Volljuristen
          mit zweitem Staatsexamen.
        </p>
      </div>
    </section>
  )
}
