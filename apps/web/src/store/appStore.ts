import { create } from 'zustand'

export type RecordingStatus = 'idle' | 'preflight' | 'listening' | 'paused' | 'error'

export type TemplateId = 'kanzleibrief' | 'freitext' | 'schriftsatz' | 'brief' | 'vermerk'

export type SpeechEngine = 'web-speech' | 'whisper-local'

export interface Section {
  readonly id: string
  readonly label: string
  readonly content: string
}

export interface DocumentState {
  readonly templateId: TemplateId
  readonly title: string
  readonly sections: readonly Section[]
  readonly activeSectionId: string | null
}

const initialDocument: DocumentState = {
  templateId: 'kanzleibrief',
  title: 'Neuer Brief KNH',
  sections: [],
  activeSectionId: null,
}

const ENGINE_KEY = 'kd_speech_engine'

function loadEngine(): SpeechEngine {
  if (typeof window === 'undefined') return 'web-speech'
  const v = window.localStorage?.getItem(ENGINE_KEY)
  return v === 'whisper-local' ? 'whisper-local' : 'web-speech'
}

interface AppState {
  recordingStatus: RecordingStatus
  aiBusy: boolean
  currentDocument: DocumentState
  speechEngine: SpeechEngine
  setRecordingStatus: (status: RecordingStatus) => void
  setAiBusy: (busy: boolean) => void
  setCurrentDocument: (doc: DocumentState) => void
  resetDocument: () => void
  setSpeechEngine: (engine: SpeechEngine) => void
}

export const useAppStore = create<AppState>((set) => ({
  recordingStatus: 'idle',
  aiBusy: false,
  currentDocument: initialDocument,
  speechEngine: loadEngine(),
  setRecordingStatus: (status) => set({ recordingStatus: status }),
  setAiBusy: (busy) => set({ aiBusy: busy }),
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  resetDocument: () => set({ currentDocument: initialDocument }),
  setSpeechEngine: (engine) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(ENGINE_KEY, engine)
      } catch {
        /* private mode etc. */
      }
    }
    set({ speechEngine: engine })
  },
}))
