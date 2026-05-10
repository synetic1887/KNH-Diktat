import { Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useDocumentStore } from './documentSlice'
import { downloadDocx } from './export'
import { exportKanzleibriefDocx } from './briefpapier'

export function ExportButton() {
  const templateId = useDocumentStore((s) => s.templateId)
  const sections = useDocumentStore((s) => s.sections)
  const title = useDocumentStore((s) => s.title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    setBusy(true)
    setError(null)
    try {
      if (templateId === 'kanzleibrief') {
        await exportKanzleibriefDocx({
          empfaenger: sections['empfaenger'] ?? '',
          inhalt: sections['inhalt'] ?? '',
          filename: title,
        })
      } else {
        downloadDocx({ templateId, sections, filename: title })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      <Button
        type="button"
        onClick={onClick}
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={busy}
      >
        <Download className="h-4 w-4" aria-hidden />
        {busy ? 'Exportiere…' : 'Export .docx'}
      </Button>
    </div>
  )
}
