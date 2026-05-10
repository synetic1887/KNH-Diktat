import { describe, expect, it } from 'vitest'

import type { ServerClient } from './clientsClient'
import { fuzzyFindClients, levenshtein } from './fuzzyMatch'

const c = (id: string, name: string, azPrefix: string | null = null): ServerClient => ({
  id,
  name,
  address: null,
  azPrefix,
  notes: null,
  createdAt: 0,
})

describe('levenshtein', () => {
  it('exakt = 0', () => {
    expect(levenshtein('mueller', 'mueller')).toBe(0)
  })
  it('eine Einfügung = 1', () => {
    expect(levenshtein('muller', 'mueller')).toBe(1)
  })
  it('zwei Substitutionen = 2', () => {
    expect(levenshtein('muler', 'meier')).toBe(2)
  })

  it('komplett unterschiedliche kurze Strings', () => {
    expect(levenshtein('katze', 'hund')).toBe(5)
  })
})

describe('fuzzyFindClients', () => {
  const list: ServerClient[] = [
    c('1', 'Hans Müller', '12 O'),
    c('2', 'Eva Schulze'),
    c('3', 'Müller GmbH'),
    c('4', 'Frank Weber'),
  ]

  it('findet exakten Treffer', () => {
    const r = fuzzyFindClients('Müller', list)
    expect(r.map((x) => x.client.name)).toContain('Hans Müller')
    expect(r.map((x) => x.client.name)).toContain('Müller GmbH')
  })

  it('matcht trotz fehlendem Umlaut', () => {
    const r = fuzzyFindClients('mueller', list)
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].client.name).toMatch(/Müller/)
  })

  it('matcht trotz Tippfehler', () => {
    const r = fuzzyFindClients('Mülla', list)
    expect(r.length).toBeGreaterThan(0)
  })

  it('ignoriert deutlich abweichende Namen', () => {
    const r = fuzzyFindClients('Schmidt', list)
    expect(r).toHaveLength(0)
  })

  it('cross-Org-Treffer NICHT enthalten (es wird nur die übergebene Liste durchsucht)', () => {
    // Sicherstellen, dass die Funktion ausschließlich die übergebene Liste betrachtet.
    const r = fuzzyFindClients('Hans', [])
    expect(r).toHaveLength(0)
  })
})
