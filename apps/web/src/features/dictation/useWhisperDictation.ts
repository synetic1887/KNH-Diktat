import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppStore } from '@/store/appStore'

import { parseCommand } from './voiceCommands'
import {
  blobToPcm16k,
  loadWhisperPipeline,
  transcribePcm16k,
  type WhisperLoadProgress,
} from './whisperRecognition'
import type { DictationLogEntry, UseDictationApi, UseDictationOptions } from './useDictation'

const SILENCE_RMS = 0.012
const SILENCE_MS = 1100
const MIN_CHUNK_MS = 500
const MAX_CHUNK_MS = 18_000

export interface UseWhisperOptions extends UseDictationOptions {
  readonly onLoadProgress?: (p: WhisperLoadProgress) => void
}

interface AudioBufferState {
  recorder: MediaRecorder
  chunks: BlobPart[]
  startedAt: number
}

/**
 * Diktat via Whisper im Browser. Identische API wie useDictation, intern aber
 * MediaRecorder + Stille-Erkennung + Whisper-Pipeline.
 *
 * Limitation: kein Interim-Stream — Text erscheint je Chunk (typisch alle 1–6 s).
 */
export function useWhisperDictation(opts: UseWhisperOptions = {}): UseDictationApi {
  const { onCommand, onText, onLog, onLoadProgress } = opts

  const setRecordingStatus = useAppStore((s) => s.setRecordingStatus)
  const [isRecording, setIsRecording] = useState(false)
  const [isAvailable, setIsAvailable] = useState(false)

  const bufRef = useRef<AudioBufferState | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const silenceCounterRef = useRef(0)
  const lastSpeechAtRef = useRef(0)
  const checkLoopRef = useRef<number | null>(null)
  const recordingRef = useRef(false)

  const cbRef = useRef({ onCommand, onText, onLog, onLoadProgress })
  useEffect(() => {
    cbRef.current = { onCommand, onText, onLog, onLoadProgress }
  }, [onCommand, onText, onLog, onLoadProgress])

  // Capability-Check + Lazy-Preload-Hinweis.
  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    setIsAvailable(ok)
  }, [])

  const log = useCallback((level: DictationLogEntry['level'], message: string) => {
    cbRef.current.onLog?.({ level, message })
  }, [])

  const finalizeChunk = useCallback(async () => {
    const buf = bufRef.current
    if (!buf) return
    const elapsed = Date.now() - buf.startedAt
    if (elapsed < MIN_CHUNK_MS) return
    // Recorder kurz stoppen, neuen starten.
    const chunks = buf.chunks
    buf.chunks = []
    buf.startedAt = Date.now()
    try {
      buf.recorder.requestData()
    } catch {
      /* noop */
    }
    if (chunks.length === 0) return
    const blob = new Blob(chunks, { type: buf.recorder.mimeType || 'audio/webm' })
    try {
      const pcm = await blobToPcm16k(blob)
      const text = await transcribePcm16k(pcm, 'de')
      if (!text) return
      const result = parseCommand(text)
      if (result.type === 'command') {
        cbRef.current.onCommand?.(result.command)
        log('cmd', `⟢ Befehl: ${text}`)
      } else if (result.type === 'text') {
        cbRef.current.onText?.(result.text)
        log('final', result.text)
      }
    } catch (err) {
      log('error', `Whisper-Fehler: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [log])

  const stop = useCallback(() => {
    recordingRef.current = false
    setIsRecording(false)
    setRecordingStatus('idle')
    if (checkLoopRef.current !== null) {
      cancelAnimationFrame(checkLoopRef.current)
      checkLoopRef.current = null
    }
    const buf = bufRef.current
    if (buf) {
      try {
        buf.recorder.stop()
      } catch {
        /* noop */
      }
      bufRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    analyserRef.current = null
    void finalizeChunk()
  }, [setRecordingStatus, finalizeChunk])

  const start = useCallback(async () => {
    if (recordingRef.current) return
    if (!isAvailable) {
      log('error', 'MediaRecorder oder getUserMedia nicht verfügbar.')
      return
    }
    setRecordingStatus('preflight')
    try {
      log('info', 'Lade Whisper-Modell (erste Nutzung kann ~150 MB Download bedeuten)…')
      await loadWhisperPipeline({
        onProgress: (p) => cbRef.current.onLoadProgress?.(p),
      })
      log('info', '✓ Whisper-Modell bereit.')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : undefined,
      })
      const buf: AudioBufferState = { recorder, chunks: [], startedAt: Date.now() }
      bufRef.current = buf
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) buf.chunks.push(e.data)
      }
      recorder.onstop = () => {
        // Fallback: bei Stop letzten Chunk via finalizeChunk einsammeln.
      }
      recorder.start(500) // dataavailable alle 500 ms

      // Pegel-Analyse für Silence-Detection.
      const ctx = new (
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!
      )()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      const buffer = new Float32Array(analyser.fftSize)
      lastSpeechAtRef.current = Date.now()
      silenceCounterRef.current = 0

      const tick = () => {
        if (!recordingRef.current || !analyserRef.current) return
        analyserRef.current.getFloatTimeDomainData(buffer)
        let sumSq = 0
        for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
        const rms = Math.sqrt(sumSq / buffer.length)
        const now = Date.now()
        if (rms > SILENCE_RMS) {
          lastSpeechAtRef.current = now
        }
        const sinceLastSpeech = now - lastSpeechAtRef.current
        const elapsed = now - buf.startedAt
        if ((sinceLastSpeech >= SILENCE_MS && elapsed >= MIN_CHUNK_MS) || elapsed >= MAX_CHUNK_MS) {
          void finalizeChunk()
        }
        checkLoopRef.current = requestAnimationFrame(tick)
      }
      recordingRef.current = true
      setIsRecording(true)
      setRecordingStatus('listening')
      checkLoopRef.current = requestAnimationFrame(tick)
    } catch (err) {
      log(
        'error',
        `Whisper-Start fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      )
      setRecordingStatus('error')
    }
  }, [finalizeChunk, isAvailable, log, setRecordingStatus])

  const runMicTest = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      const tracks = s.getAudioTracks()
      const label = tracks[0]?.label ?? '(unbenannt)'
      tracks.forEach((t) => t.stop())
      log('info', `✓ Mikrofon zugreifbar — Track: ${label}`)
      return { ok: true, label }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err)
      log('error', `Mikrofon-Test fehlgeschlagen: ${m}`)
      return { ok: false, error: m }
    }
  }, [log])

  useEffect(() => () => stop(), [stop])

  return { isAvailable, isRecording, start, stop, runMicTest }
}
