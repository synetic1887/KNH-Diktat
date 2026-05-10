import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAppStore } from '@/store/appStore'

import {
  ERR_HINTS,
  FATAL_ERRORS,
  getSpeechRecognitionCtor,
  type SpeechRecognitionInstance,
} from './speechRecognition'
import { parseCommand } from './voiceCommands'
import type { Command } from './types'

export type LogLevel = 'info' | 'cmd' | 'final' | 'interim' | 'warn' | 'error'

export interface DictationLogEntry {
  readonly level: LogLevel
  readonly message: string
}

export interface UseDictationOptions {
  /** Wird aufgerufen, wenn der Parser einen Befehl erkennt. */
  readonly onCommand?: (cmd: Command) => void
  /** Wird aufgerufen, wenn ein finales Erkennungsergebnis als Klartext einzufügen ist. */
  readonly onText?: (text: string) => void
  /** Optional: Live-Transkript (interim Results), für UI-Vorschau. */
  readonly onInterim?: (text: string) => void
  /** Optional: Log-Strom für die Diagnose-Ansicht. */
  readonly onLog?: (entry: DictationLogEntry) => void
}

export interface UseDictationApi {
  readonly isAvailable: boolean
  readonly isRecording: boolean
  readonly start: () => Promise<void>
  readonly stop: () => void
  readonly runMicTest: () => Promise<{ ok: boolean; label?: string; error?: string }>
}

interface PreflightInjections {
  readonly getProtocol?: () => string
  readonly getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
}

/**
 * Härtet die Web-Speech-API gegen reale Probleme:
 *  - Pre-Flight-Check (file://, getUserMedia)
 *  - Doppelklick-Schutz via `isInitializingRef`
 *  - Generation-Counter, der stale Handler invalidiert
 *  - 400ms-Cooldown zwischen Auto-Restarts
 *  - Trennung fataler vs. weicher Fehler
 *  - Auto-Restart-Bremse nach 2 weichen Fehlern in Folge
 *
 * Ports von `startRecognition()`/`stopRecognition()` aus reference/mvp.html.
 */
export function useDictation(
  opts: UseDictationOptions = {},
  inj: PreflightInjections = {},
): UseDictationApi {
  const { onCommand, onText, onInterim, onLog } = opts

  const setRecordingStatus = useAppStore((s) => s.setRecordingStatus)

  const SR = useMemo(() => getSpeechRecognitionCtor(), [])
  const isAvailable = SR !== null

  const [isRecording, setRecording] = useState(false)
  const recordingRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const generationRef = useRef(0)
  const isInitializingRef = useRef(false)
  const consecutiveErrorsRef = useRef(0)
  const lastStartAtRef = useRef(0)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable refs für Callbacks, damit die Recognition-Instanz nicht ständig neu gebaut wird.
  const cbRef = useRef({ onCommand, onText, onInterim, onLog })
  useEffect(() => {
    cbRef.current = { onCommand, onText, onInterim, onLog }
  }, [onCommand, onText, onInterim, onLog])

  // Inj nur einmal beim Mount fixieren, damit start/stop stabile Identitäten haben.
  const injRef = useRef(inj)

  const log = useCallback((level: LogLevel, message: string) => {
    cbRef.current.onLog?.({ level, message })
  }, [])

  const setRecState = useCallback(
    (next: boolean) => {
      recordingRef.current = next
      setRecording(next)
      setRecordingStatus(next ? 'listening' : 'idle')
    },
    [setRecordingStatus],
  )

  const preflight = useCallback(async (): Promise<boolean> => {
    const i = injRef.current
    const protocol = i.getProtocol ? i.getProtocol() : window.location.protocol
    if (protocol === 'file:') {
      log(
        'error',
        'Diese Seite läuft als file:// — Chrome erlaubt Mikrofonzugriff dort nicht. Lokalen Server nutzen (z.B. pnpm dev → http://localhost:5173).',
      )
      return false
    }
    const gum = i.getUserMedia ?? navigator.mediaDevices?.getUserMedia.bind(navigator.mediaDevices)
    if (!gum) {
      log('error', 'getUserMedia API nicht verfügbar (oft bei file:// oder altem Browser).')
      return false
    }
    try {
      const stream = await gum({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      return true
    } catch (err) {
      const e = err as DOMException
      log('error', `Mikrofonzugriff verweigert: ${e.name ?? 'Error'} ${e.message ?? ''}`)
      log('warn', ERR_HINTS['not-allowed'] ?? '')
      return false
    }
  }, [log])

  const stop = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    recordingRef.current = false
    generationRef.current++ // invalidiert Handler der laufenden Instanz
    const rec = recognitionRef.current
    if (rec) {
      try {
        rec.stop()
      } catch {
        /* noop */
      }
      try {
        rec.abort()
      } catch {
        /* noop */
      }
    }
    setRecState(false)
  }, [setRecState])

  const handleFinalText = useCallback(
    (raw: string) => {
      const result = parseCommand(raw)
      if (result.type === 'empty') return

      if (result.type === 'command') {
        cbRef.current.onCommand?.(result.command)
        log('cmd', `⟢ Befehl: ${raw.trim()}`)
        return
      }

      cbRef.current.onText?.(result.text)
      log('final', result.text)
    },
    [log],
  )

  const start = useCallback(async () => {
    if (!SR) {
      log(
        'error',
        'Dein Browser unterstützt SpeechRecognition nicht. Bitte Chrome oder Edge verwenden.',
      )
      return
    }
    if (isInitializingRef.current || recordingRef.current) return

    isInitializingRef.current = true
    setRecordingStatus('preflight')
    try {
      if (!recognitionRef.current) {
        const ok = await preflight()
        if (!ok) {
          setRecordingStatus('error')
          return
        }
      }

      // Alte Instanz abbauen
      if (recognitionRef.current) {
        const old = recognitionRef.current
        old.onresult = old.onerror = old.onend = old.onstart = null
        try {
          old.abort()
        } catch {
          /* noop */
        }
      }

      const myGen = ++generationRef.current
      const rec = new SR()
      rec.lang = 'de-DE'
      rec.continuous = true
      rec.interimResults = true
      recognitionRef.current = rec

      rec.onstart = () => {
        if (myGen !== generationRef.current) return
        consecutiveErrorsRef.current = 0
        log('info', '▶ Diktat aktiv')
      }

      rec.onresult = (e) => {
        if (myGen !== generationRef.current) return
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          const txt = r[0]?.transcript ?? ''
          if (r.isFinal) handleFinalText(txt)
          else interim += txt
        }
        cbRef.current.onInterim?.(interim)
      }

      rec.onerror = (e) => {
        if (myGen !== generationRef.current) return
        consecutiveErrorsRef.current++
        const code = e.error || 'unbekannt'
        const hint = ERR_HINTS[code] ?? ''
        log('error', `⚠ ${code}${hint ? ' — ' + hint : ''}`)

        if (FATAL_ERRORS.has(code)) {
          setRecState(false)
          setRecordingStatus('error')
          return
        }
        if (consecutiveErrorsRef.current >= 2) {
          setRecState(false)
          log(
            'warn',
            `Auto-Restart deaktiviert nach ${consecutiveErrorsRef.current} Fehlern. Bitte „Diktat starten" erneut klicken.`,
          )
        }
      }

      rec.onend = () => {
        if (myGen !== generationRef.current) return
        if (!recordingRef.current) {
          setRecState(false)
          return
        }
        const wait = Math.max(0, 400 - (Date.now() - lastStartAtRef.current))
        restartTimerRef.current = setTimeout(() => {
          if (myGen !== generationRef.current || !recordingRef.current) return
          try {
            lastStartAtRef.current = Date.now()
            rec.start()
          } catch (err) {
            const m = err instanceof Error ? err.message : String(err)
            log('error', `Restart fehlgeschlagen: ${m}`)
            setRecState(false)
          }
        }, wait)
      }

      setRecState(true)
      try {
        lastStartAtRef.current = Date.now()
        rec.start()
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        log('error', `Start fehlgeschlagen: ${m}`)
        setRecState(false)
      }
    } finally {
      isInitializingRef.current = false
    }
  }, [SR, preflight, handleFinalText, log, setRecState, setRecordingStatus])

  const runMicTest = useCallback(async () => {
    const i = injRef.current
    const gum = i.getUserMedia ?? navigator.mediaDevices?.getUserMedia.bind(navigator.mediaDevices)
    if (!gum) {
      const msg = 'getUserMedia API nicht verfügbar.'
      log('error', msg)
      return { ok: false, error: msg }
    }
    try {
      const s = await gum({ audio: true })
      const tracks = s.getAudioTracks()
      const label = tracks[0]?.label ?? '(unbenannt)'
      tracks.forEach((t) => t.stop())
      log('info', `✓ Mikrofon zugreifbar — Track: ${label}`)
      return { ok: true, label }
    } catch (err) {
      const e = err as DOMException
      const msg = `${e.name ?? 'Error'}: ${e.message ?? ''}`
      log('error', `⚠ ${msg}`)
      return { ok: false, error: msg }
    }
  }, [log])

  // Cleanup beim Unmount.
  useEffect(() => () => stop(), [stop])

  return { isAvailable, isRecording, start, stop, runMicTest }
}
