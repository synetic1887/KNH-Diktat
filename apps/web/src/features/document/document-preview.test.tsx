import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { useDocumentStore } from './documentSlice'
import { DocumentPreview } from './document-preview'

beforeEach(() => {
  useDocumentStore.getState().resetForTemplate('schriftsatz')
})

describe('DocumentPreview — Multi-Sektion (Schriftsatz)', () => {
  it('rendert Section-Chips für alle Sektionen', () => {
    render(<DocumentPreview />)
    expect(screen.getByRole('button', { name: /Kläger/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anträge/ })).toBeInTheDocument()
  })

  it('Klick auf Sektion-Chip ändert aktive Sektion', () => {
    render(<DocumentPreview />)
    const sachverhalt = screen.getByRole('button', { name: /Sachverhalt/ })
    fireEvent.click(sachverhalt)
    expect(useDocumentStore.getState().activeSectionId).toBe('sachverhalt')
  })

  it('zeigt aktiven Section-Chip mit data-active=true', () => {
    useDocumentStore.getState().setActiveSection('antraege')
    render(<DocumentPreview />)
    const active = screen.getByRole('button', { name: /Anträge/ })
    expect(active).toHaveAttribute('data-active', 'true')
  })

  it('zeigt Inhalt der aktiven Sektion im Hauptfeld', () => {
    useDocumentStore.getState().appendToActive('Konkreter Inhalt')
    render(<DocumentPreview />)
    expect(screen.getByText('Konkreter Inhalt')).toBeInTheDocument()
  })

  it('zeigt Interim-Text inline bei Bedarf', () => {
    useDocumentStore.getState().appendToActive('Bisheriger Text.')
    render(<DocumentPreview interim="Sehr geehrter Herr" />)
    expect(screen.getByText(/Bisheriger Text\./)).toBeInTheDocument()
    expect(screen.getByText(/Sehr geehrter Herr/)).toBeInTheDocument()
  })
})

describe('DocumentPreview — Freitext', () => {
  beforeEach(() => {
    useDocumentStore.getState().resetForTemplate('freitext')
  })

  it('zeigt KEINE Section-Chips bei Single-Section-Vorlage', () => {
    render(<DocumentPreview />)
    // Freitext hat nur „Inhalt" — keine Chip-Reihe nötig
    expect(screen.queryByRole('button', { name: /Inhalt/ })).not.toBeInTheDocument()
  })

  it('zeigt Placeholder wenn leer', () => {
    render(<DocumentPreview />)
    expect(screen.getByText(/Sprich einfach drauf los/)).toBeInTheDocument()
  })

  it('Interim-Text alleine wird angezeigt', () => {
    render(<DocumentPreview interim="Sehr geehrter Herr Geis" />)
    expect(screen.getByText('Sehr geehrter Herr Geis')).toBeInTheDocument()
  })
})
