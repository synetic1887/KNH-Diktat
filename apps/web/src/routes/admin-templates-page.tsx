import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { templatesClient, type ServerTemplate } from '@/features/documents/documentsClient'

export function TemplatesAdminPage() {
  const [tpls, setTpls] = useState<ServerTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const r = await templatesClient.list()
      setTpls(r.templates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const onCreate = async () => {
    const slug = window.prompt('Slug (a-z, _, -):')
    if (!slug) return
    const title = window.prompt('Titel:')
    if (!title) return
    setBusy(true)
    try {
      await templatesClient.create({
        slug,
        title,
        sections: [{ id: 'inhalt', label: 'Inhalt', kind: 'prose' }],
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!window.confirm('Vorlage wirklich löschen?')) return
    setBusy(true)
    try {
      await templatesClient.delete(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Vorlagen-Verwaltung</h1>
          <p className="text-sm text-muted-foreground">Pro Org. Sektionen-Editor minimal.</p>
        </div>
        <Button size="sm" onClick={onCreate} disabled={busy}>
          Neue Vorlage
        </Button>
      </header>

      {error ? (
        <div className="rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {tpls === null ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : tpls.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Vorlagen vorhanden.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {tpls.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {t.slug} · {t.sections.length} Sektion(en)
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(t.id)}
                disabled={busy}
                className="text-destructive hover:bg-destructive/10"
              >
                Löschen
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
