import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent,
  SpeechRecognitionInstance,
} from './speechRecognition'
import { useAppStore } from '@/store/appStore'
import { useDictation } from './useDictation'

interface MockResult {
  readonly transcript: string
  readonly isFinal: boolean
}

function mockEvent(results: MockResult[], resultIndex = 0): SpeechRecognitionEvent {
  const list = results.map((r) => ({
    isFinal: r.isFinal,
    length: 1,
    item: () => ({ transcript: r.transcript, confidence: 1 }),
    0: { transcript: r.transcript, confidence: 1 },
  })) as unknown as SpeechRecognitionEvent['results']
  Object.defineProperty(list, 'length', { value: results.length })
  return {
    resultIndex,
    results: list,
    type: 'result',
    target: null,
    currentTarget: null,
  } as unknown as SpeechRecognitionEvent
}

class FakeSpeechRecognition implements SpeechRecognitionInstance {
  static instances: FakeSpeechRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null = null
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null = null
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null =
    null
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null = null
  startCalls = 0
  stopCalls = 0
  abortCalls = 0
  constructor() {
    FakeSpeechRecognition.instances.push(this)
  }
  start(): void {
    this.startCalls++
    queueMicrotask(() => this.onstart?.(new Event('start')))
  }
  stop(): void {
    this.stopCalls++
  }
  abort(): void {
    this.abortCalls++
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true
  }
  emitFinal(text: string): void {
    this.onresult?.(mockEvent([{ transcript: text, isFinal: true }]))
  }
  emitInterim(text: string): void {
    this.onresult?.(mockEvent([{ transcript: text, isFinal: false }]))
  }
  emitError(code: string): void {
    this.onerror?.({
      error: code,
      type: 'error',
    } as unknown as SpeechRecognitionErrorEvent)
  }
  emitEnd(): void {
    this.onend?.(new Event('end'))
  }
}

const FakeCtor = FakeSpeechRecognition as unknown as SpeechRecognitionConstructor

beforeEach(() => {
  FakeSpeechRecognition.instances = []
  ;(window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition =
    FakeCtor
  useAppStore.getState().setRecordingStatus('idle')
})

afterEach(() => {
  vi.useRealTimers()
  delete (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
    .SpeechRecognition
})

describe('useDictation', () => {
  it('isAvailable=true wenn SpeechRecognition vorhanden', () => {
    const { result } = renderHook(() => useDictation())
    expect(result.current.isAvailable).toBe(true)
    expect(result.current.isRecording).toBe(false)
  })

  it('startet Aufnahme nach erfolgreichem Preflight', async () => {
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn(), label: 'Test-Mic' }],
    } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    const { result } = renderHook(() =>
      useDictation({}, { getProtocol: () => 'http:', getUserMedia }),
    )
    await act(async () => {
      await result.current.start()
    })
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(FakeSpeechRecognition.instances).toHaveLength(1)
    expect(FakeSpeechRecognition.instances[0].startCalls).toBe(1)
    expect(FakeSpeechRecognition.instances[0].lang).toBe('de-DE')
    expect(FakeSpeechRecognition.instances[0].continuous).toBe(true)
    expect(FakeSpeechRecognition.instances[0].interimResults).toBe(true)
    expect(result.current.isRecording).toBe(true)
    expect(useAppStore.getState().recordingStatus).toBe('listening')
  })

  it('preflight bei file:// schlägt fehl', async () => {
    const onLog = vi.fn()
    const { result } = renderHook(() =>
      useDictation({ onLog }, { getProtocol: () => 'file:', getUserMedia: vi.fn() }),
    )
    await act(async () => {
      await result.current.start()
    })
    expect(FakeSpeechRecognition.instances).toHaveLength(0)
    expect(useAppStore.getState().recordingStatus).toBe('error')
    expect(onLog.mock.calls.some(([e]) => /file:\/\//.test(e.message))).toBe(true)
  })

  it('Doppelklick-Schutz: zweiter start() während Init wird ignoriert', async () => {
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    let resolveGUM: (s: MediaStream) => void = () => {}
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((res) => (resolveGUM = res)))
    const { result } = renderHook(() =>
      useDictation({}, { getProtocol: () => 'http:', getUserMedia }),
    )

    await act(async () => {
      // Beide start()-Aufrufe parallel anstoßen, dann GUM auflösen — alles innerhalb desselben act-Scope.
      const first = result.current.start()
      const second = result.current.start()
      resolveGUM(stream)
      await Promise.all([first, second])
    })

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(FakeSpeechRecognition.instances).toHaveLength(1)
  })

  it('finales Ergebnis ohne Befehl ruft onText', async () => {
    const onText = vi.fn()
    const onCommand = vi.fn()
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation(
        { onText, onCommand },
        { getProtocol: () => 'http:', getUserMedia: vi.fn().mockResolvedValue(stream) },
      ),
    )
    await act(async () => {
      await result.current.start()
    })
    const rec = FakeSpeechRecognition.instances[0]
    act(() => rec.emitFinal('Die Parteien streiten über die Wirksamkeit.'))
    expect(onText).toHaveBeenCalledWith('Die Parteien streiten über die Wirksamkeit.')
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('finales Ergebnis "stopp" ruft onCommand mit control/stop', async () => {
    const onText = vi.fn()
    const onCommand = vi.fn()
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation(
        { onText, onCommand },
        { getProtocol: () => 'http:', getUserMedia: vi.fn().mockResolvedValue(stream) },
      ),
    )
    await act(async () => {
      await result.current.start()
    })
    const rec = FakeSpeechRecognition.instances[0]
    act(() => rec.emitFinal('stopp'))
    expect(onCommand).toHaveBeenCalledWith({ category: 'control', kind: 'stop' })
    expect(onText).not.toHaveBeenCalled()
  })

  it('interim-Ergebnis ruft onInterim', async () => {
    const onInterim = vi.fn()
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation(
        { onInterim },
        { getProtocol: () => 'http:', getUserMedia: vi.fn().mockResolvedValue(stream) },
      ),
    )
    await act(async () => {
      await result.current.start()
    })
    const rec = FakeSpeechRecognition.instances[0]
    act(() => rec.emitInterim('die Klage'))
    expect(onInterim).toHaveBeenLastCalledWith('die Klage')
  })

  it('fataler Fehler stoppt sofort', async () => {
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation(
        {},
        { getProtocol: () => 'http:', getUserMedia: vi.fn().mockResolvedValue(stream) },
      ),
    )
    await act(async () => {
      await result.current.start()
    })
    const rec = FakeSpeechRecognition.instances[0]
    act(() => rec.emitError('not-allowed'))
    expect(result.current.isRecording).toBe(false)
    expect(useAppStore.getState().recordingStatus).toBe('error')
  })

  it('zwei weiche Fehler in Folge bremsen Auto-Restart', async () => {
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation(
        {},
        { getProtocol: () => 'http:', getUserMedia: vi.fn().mockResolvedValue(stream) },
      ),
    )
    await act(async () => {
      await result.current.start()
    })
    const rec = FakeSpeechRecognition.instances[0]
    act(() => rec.emitError('no-speech'))
    expect(result.current.isRecording).toBe(true)
    act(() => rec.emitError('aborted'))
    expect(result.current.isRecording).toBe(false)
  })

  it('onend startet nach 400ms erneut, wenn noch aktiv', async () => {
    vi.useFakeTimers()
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation(
        {},
        {
          getProtocol: () => 'http:',
          getUserMedia: () => Promise.resolve(stream),
        },
      ),
    )
    await act(async () => {
      await result.current.start()
    })
    const rec = FakeSpeechRecognition.instances[0]
    act(() => rec.emitEnd())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(rec.startCalls).toBeGreaterThanOrEqual(2)
    vi.useRealTimers()
  })

  it('stop() invalidiert Handler-Generation und stoppt Restart-Timer', async () => {
    vi.useFakeTimers()
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation(
        {},
        {
          getProtocol: () => 'http:',
          getUserMedia: () => Promise.resolve(stream),
        },
      ),
    )
    await act(async () => {
      await result.current.start()
    })
    const rec = FakeSpeechRecognition.instances[0]
    act(() => rec.emitEnd())
    act(() => result.current.stop())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(rec.startCalls).toBe(1)
    expect(useAppStore.getState().recordingStatus).toBe('idle')
    vi.useRealTimers()
  })

  it('runMicTest gibt OK + Label zurück', async () => {
    const tracks = [{ stop: vi.fn(), label: 'Built-In Microphone' }]
    const stream = {
      getTracks: () => tracks,
      getAudioTracks: () => tracks,
    } as unknown as MediaStream
    const { result } = renderHook(() =>
      useDictation({}, { getUserMedia: vi.fn().mockResolvedValue(stream) }),
    )
    const r = await result.current.runMicTest()
    expect(r.ok).toBe(true)
    expect(r.label).toBe('Built-In Microphone')
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  it('runMicTest meldet Fehler, wenn getUserMedia ablehnt', async () => {
    const err = Object.assign(new Error('Denied'), { name: 'NotAllowedError' })
    const { result } = renderHook(() =>
      useDictation({}, { getUserMedia: vi.fn().mockRejectedValue(err) }),
    )
    const r = await result.current.runMicTest()
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/NotAllowedError/)
  })
})

describe('useDictation — kein SpeechRecognition im Browser', () => {
  beforeEach(() => {
    delete (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
      .SpeechRecognition
    delete (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
      .webkitSpeechRecognition
  })
  it('isAvailable=false', () => {
    const { result } = renderHook(() => useDictation())
    expect(result.current.isAvailable).toBe(false)
  })
  it('start() loggt Hinweis und macht nichts', async () => {
    const onLog = vi.fn()
    const { result } = renderHook(() => useDictation({ onLog }))
    await act(async () => {
      await result.current.start()
    })
    expect(onLog).toHaveBeenCalled()
    expect(onLog.mock.calls[0][0].level).toBe('error')
  })
})
