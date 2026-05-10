/**
 * Whisper-basierte Spracherkennung — DSGVO-konform, läuft komplett im Browser.
 *
 * Nutzt @huggingface/transformers (WASM/WebGPU). Erste Verwendung lädt das Modell
 * (~150 MB für whisper-base, ~480 MB für whisper-small). Wird im Browser-Cache
 * gehalten. Keine Audio-Daten verlassen den Rechner.
 *
 * Workflow (kein echtes Streaming):
 *   1. MediaRecorder sammelt Audio.
 *   2. Bei Stille (>1.2s ohne Pegel) oder Stop: Chunk → Whisper-Pipeline.
 *   3. Result wird als final-Text emittiert (kein Interim-Result).
 *
 * Für die Web-Speech-API-Parität siehe useDictation.ts.
 */

type WhisperPipeline = (
  audio: Float32Array,
  opts: { language: string; task: string },
) => Promise<{
  text: string
}>

let cachedPipeline: WhisperPipeline | null = null
let pipelinePromise: Promise<WhisperPipeline> | null = null

export interface WhisperLoadProgress {
  readonly file: string
  readonly progress: number
  readonly loaded: number
  readonly total: number
}

export interface LoadOptions {
  readonly model?: string
  readonly onProgress?: (p: WhisperLoadProgress) => void
}

/**
 * Lädt die Whisper-Pipeline (idempotent). Defaultmodell: whisper-base
 * (gut genug, ~150 MB). whisper-small ist genauer, aber 480 MB.
 */
export async function loadWhisperPipeline(opts: LoadOptions = {}): Promise<WhisperPipeline> {
  if (cachedPipeline) return cachedPipeline
  if (pipelinePromise) return pipelinePromise
  pipelinePromise = (async () => {
    const transformers = await import('@huggingface/transformers')
    const modelName = opts.model ?? 'Xenova/whisper-base'
    const pipe = await transformers.pipeline('automatic-speech-recognition', modelName, {
      dtype: 'fp32',
      progress_callback: (p: unknown) => {
        if (
          p &&
          typeof p === 'object' &&
          'status' in p &&
          (p as { status: string }).status === 'progress'
        ) {
          const x = p as {
            file?: string
            progress?: number
            loaded?: number
            total?: number
          }
          opts.onProgress?.({
            file: x.file ?? '',
            progress: x.progress ?? 0,
            loaded: x.loaded ?? 0,
            total: x.total ?? 0,
          })
        }
      },
    })
    cachedPipeline = pipe as unknown as WhisperPipeline
    return cachedPipeline
  })()
  return pipelinePromise
}

/** Konvertiert ein Audio-Blob in Float32-PCM @16kHz, das Whisper erwartet. */
export async function blobToPcm16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer()
  // OfflineAudioContext für deterministisches Resampling auf 16 kHz.
  const decoder = new (
    window.AudioContext ||
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!
  )()
  const decoded = await decoder.decodeAudioData(buf.slice(0))
  await decoder.close()
  if (decoded.sampleRate === 16000 && decoded.numberOfChannels === 1) {
    return decoded.getChannelData(0)
  }
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

export async function transcribePcm16k(
  pcm: Float32Array,
  language: 'de' | 'en' = 'de',
): Promise<string> {
  const pipe = await loadWhisperPipeline()
  const result = await pipe(pcm, { language, task: 'transcribe' })
  return (result.text ?? '').trim()
}
