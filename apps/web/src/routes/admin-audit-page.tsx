import { useEffect, useState } from 'react'

import { auditClient, type AuditEntry } from '@/features/documents/documentsClient'

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const r = await auditClient.list(200)
        setEntries(r.entries)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden')
      }
    })()
  }, [])

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Audit-Log</h1>
      <p className="text-sm text-muted-foreground">
        Alle Schreibvorgänge dieser Org. Maximal 200 Einträge.
      </p>
      {error ? (
        <div className="rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {entries === null ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Einträge.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Zeit</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Aktion</th>
                <th className="px-3 py-2 font-medium">Ziel</th>
                <th className="px-3 py-2 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(e.createdAt)}</td>
                  <td className="px-3 py-2 font-mono">{e.userId ?? '—'}</td>
                  <td className="px-3 py-2 font-medium">{e.action}</td>
                  <td className="px-3 py-2">
                    {e.targetType}:{e.targetId ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground max-w-md truncate">
                    {e.payload ? JSON.stringify(e.payload) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
