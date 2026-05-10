/**
 * Minimaltypen für die Web Speech API.
 * Der Standard ist nicht in lib.dom.d.ts enthalten — wir typisieren nur das,
 * was wir tatsächlich nutzen (Chrome/Edge prefix `webkitSpeechRecognition`).
 */

export interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

export interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message?: string
}

export interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives?: number
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export const ERR_HINTS: Readonly<Record<string, string>> = {
  'not-allowed':
    'Mikro-Berechtigung wurde abgelehnt. In Chrome: Schloss-Icon links neben der URL → „Mikrofon" → erlauben.',
  'service-not-allowed':
    'Spracherkennungs-Dienst nicht erlaubt — meist weil die Seite nicht über https:// oder http://localhost geladen wurde.',
  'audio-capture': 'Kein Mikrofon gefunden. Prüfe Audio-Einstellungen des Systems.',
  'no-speech': 'Längere Stille erkannt — Diktat pausiert.',
  network:
    'Netzwerkfehler. Spracherkennung benötigt Online-Verbindung (Chrome nutzt Google-Server).',
  aborted:
    'Erkennung wurde abgebrochen — meist weil die Seite über file:// läuft oder Mikro-Berechtigung fehlt.',
  'language-not-supported': 'Sprache de-DE nicht unterstützt vom Browser.',
  'bad-grammar': 'Grammatik-Konfiguration des Browsers passt nicht.',
}

export const FATAL_ERRORS: ReadonlySet<string> = new Set([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'language-not-supported',
  'bad-grammar',
])
