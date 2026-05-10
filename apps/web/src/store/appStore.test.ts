import { describe, expect, it, beforeEach } from 'vitest'

import { useAppStore } from './appStore'

describe('appStore (Smoke)', () => {
  beforeEach(() => {
    useAppStore.getState().resetDocument()
    useAppStore.getState().setRecordingStatus('idle')
    useAppStore.getState().setAiBusy(false)
  })

  it('startet im idle-Zustand', () => {
    const state = useAppStore.getState()
    expect(state.recordingStatus).toBe('idle')
    expect(state.aiBusy).toBe(false)
    expect(state.currentDocument.templateId).toBe('kanzleibrief')
  })

  it('setzt den Recording-Status', () => {
    useAppStore.getState().setRecordingStatus('listening')
    expect(useAppStore.getState().recordingStatus).toBe('listening')
  })

  it('toggelt aiBusy', () => {
    useAppStore.getState().setAiBusy(true)
    expect(useAppStore.getState().aiBusy).toBe(true)
  })
})
