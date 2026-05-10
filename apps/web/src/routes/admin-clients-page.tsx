import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  clientsClient,
  type ClientUpsertInput,
  type ServerClient,
} from '@/features/clients/clientsClient'

interface DraftState extends ClientUpsertInput {
  readonly id?: string
}

const EMPTY_DRAFT: DraftState = {
  name: '',
  address: '',
  azPrefix: '',
  notes: '',
}

export function ClientsAdminPage() {
  const [list, setList] = useState<ServerClient[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const r = await clientsClient.list()
      setList(r.clients)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const submit = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const payload: ClientUpsertInput = {
        name: draft.name.trim(),
        address: draft.address?.trim() || null,
        azPrefix: draft.azPrefix?.trim() || null,
        notes: draft.notes?.trim() || null,
      }
      if (draft.id) await clientsClient.update(draft.id, payload)
      else await clientsClient.create(payload)
      setDraft(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Mandant wirklich löschen?')) return
    setBusy(true)
    try {
      await clientsClient.delete(id)
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
          <h1 className="text-lg font-semibold tracking-tight">Mandantenstamm</h1>
          <p className="text-sm text-muted-foreground">
            Pro Org. Voice-Befehl im Diktat: „neuer Schriftsatz für Mandant &lt;Name&gt;".
          </p>
        </div>
        <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          Neuer Mandant
        </Button>
      </header>

      {error ? (
        <div className="rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {draft ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">{draft.id ? 'Bearbeiten' : 'Neu'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Name *
              </span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                AZ-Präfix
              </span>
              <input
                type="text"
                value={draft.azPrefix ?? ''}
                onChange={(e) => setDraft({ ...draft, azPrefix: e.target.value })}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Adresse
              </span>
              <input
                type="text"
                value={draft.address ?? ''}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Notizen
              </span>
              <textarea
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy || draft.name.trim().length < 2}>
              Speichern
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)} disabled={busy}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {list === null ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Mandanten.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.azPrefix ? `${c.azPrefix} · ` : ''}
                  {c.address ?? '—'}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    setDraft({
                      ...c,
                      address: c.address ?? '',
                      azPrefix: c.azPrefix ?? '',
                      notes: c.notes ?? '',
                    })
                  }
                >
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => remove(c.id)}
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
