import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { documentsClient, type ServerDocument } from '@/features/documents/documentsClient'
import { useDocumentStore } from '@/features/document'
import type { TemplateId } from '@/store/appStore'

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const VALID_TEMPLATES: ReadonlySet<TemplateId> = new Set([
  'kanzleibrief',
  'freitext',
  'schriftsatz',
  'brief',
  'vermerk',
])

export function DocumentsPage() {
  const [docs, setDocs] = useState<ServerDocument[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const resetForTemplate = useDocumentStore((s) => s.resetForTemplate)

  const refresh = async () => {
    try {
      const r = await documentsClient.list()
      setDocs(r.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const open = async (id: string) => {
    setBusyId(id)
    try {
      const { document } = await documentsClient.get(id)
      const templateId: TemplateId = VALID_TEMPLATES.has(document.templateId as TemplateId)
        ? (document.templateId as TemplateId)
        : 'kanzleibrief'
      const firstId = Object.keys(document.sections)[0] ?? 'sachverhalt'
      loadDocument({
        templateId,
        title: document.title,
        sections: document.sections,
        activeSectionId: firstId,
      })
      window.location.hash = '#geladen'
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Dokument wirklich löschen?')) return
    setBusyId(id)
    try {
      await documentsClient.delete(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dokumente</h1>
          <p className="text-sm text-muted-foreground">
            Persistierte Dokumente deiner Org. Auto-Save aus dem Diktat ist aktiv.
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          onClick={() => resetForTemplate('kanzleibrief')}
        >
          <Link to="/">Neu</Link>
        </Button>
      </header>

      {error ? (
        <div className="rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {docs === null ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Dokumente.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {d.templateId ?? 'kein Template'} · {formatDate(d.updatedAt)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === d.id}
                  onClick={() => open(d.id)}
                >
                  Öffnen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === d.id}
                  onClick={() => remove(d.id)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
