import { Stethoscope, TestTube2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { DictationLogEntry } from './useDictation'

export interface DictationDiagnosticsProps {
  readonly onMicTest: () => Promise<{ ok: boolean; label?: string; error?: string }>
  readonly onLog: (entry: DictationLogEntry) => void
  readonly isAvailable: boolean
}

export function DictationDiagnostics({ onMicTest, onLog, isAvailable }: DictationDiagnosticsProps) {
  const [busy, setBusy] = useState(false)

  const handleMicTest = async () => {
    setBusy(true)
    onLog({ level: 'cmd', message: '— Mikro-Test —' })
    onLog({
      level: 'info',
      message: `Protokoll: ${window.location.protocol} · Host: ${window.location.host || '(leer)'}`,
    })
    onLog({
      level: 'info',
      message: `SpeechRecognition: ${isAvailable ? 'verfügbar' : 'FEHLT'}`,
    })
    onLog({
      level: 'info',
      message: `navigator.mediaDevices: ${navigator.mediaDevices ? 'vorhanden' : 'FEHLT'}`,
    })
    await onMicTest()
    setBusy(false)
  }

  const handleDiag = () => {
    onLog({ level: 'cmd', message: '— Diagnose —' })
    onLog({ level: 'info', message: `UserAgent: ${navigator.userAgent.slice(0, 140)}` })
    onLog({
      level: 'info',
      message: `Sprache: ${navigator.language} · Online: ${navigator.onLine}`,
    })
    onLog({
      level: 'info',
      message: `SpeechRecognition: ${isAvailable ? 'verfügbar' : 'FEHLT'}`,
    })
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleMicTest}
        disabled={busy}
        className="gap-1.5"
      >
        <TestTube2 className="h-4 w-4" aria-hidden /> Mikro testen
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={handleDiag} className="gap-1.5">
        <Stethoscope className="h-4 w-4" aria-hidden /> Diagnose
      </Button>
    </div>
  )
}
