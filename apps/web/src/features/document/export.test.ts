import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'

import { buildDocumentXml, buildDocxBytes, escapeXml, makeZip } from './export'
import { TEMPLATES } from './templates'

describe('escapeXml', () => {
  it('escaped XML-Sonderzeichen', () => {
    expect(escapeXml('A & B < C > D')).toBe('A &amp; B &lt; C &gt; D')
    expect(escapeXml(`O'Reilly "test"`)).toBe('O&apos;Reilly &quot;test&quot;')
  })
})

describe('buildDocumentXml', () => {
  it('enthält Vorlagentitel und alle Sektion-Labels', () => {
    const sections: Record<string, string> = {
      rubrum_klaeger: 'Hans Müller',
      antraege: 'Wir beantragen, …',
    }
    const xml = buildDocumentXml('schriftsatz', sections)
    expect(xml).toContain('Schriftsatz')
    for (const s of TEMPLATES.schriftsatz.sections) {
      expect(xml).toContain(escapeXml(s.label))
    }
    expect(xml).toContain('Hans Müller')
  })

  it('mehrere \\n\\n erzeugen mehrere <w:p>', () => {
    const xml = buildDocumentXml('schriftsatz', { antraege: 'Eins\n\nZwei\n\nDrei' })
    const matches = xml.match(/<w:p>/g) ?? []
    // Pro Vorlagentitel + jede Sektion-Heading + 3 Absätze in antraege + leere Sektionen
    expect(matches.length).toBeGreaterThan(3)
  })

  it('einzelne \\n erzeugen <w:br/>', () => {
    const xml = buildDocumentXml('vermerk', { inhalt: 'Erste Zeile\nZweite Zeile' })
    expect(xml).toContain('<w:br/>')
  })

  it('escaped Zeichen im Inhalt', () => {
    const xml = buildDocumentXml('schriftsatz', { antraege: 'A < B & C' })
    expect(xml).toContain('A &lt; B &amp; C')
  })
})

describe('makeZip', () => {
  it('erzeugt ein gültiges ZIP, das fflate entpacken kann', () => {
    const bytes = makeZip([
      { name: 'a.txt', data: 'Inhalt A' },
      { name: 'sub/b.txt', data: 'Inhalt B' },
    ])
    const unzipped = unzipSync(bytes)
    expect(strFromU8(unzipped['a.txt'])).toBe('Inhalt A')
    expect(strFromU8(unzipped['sub/b.txt'])).toBe('Inhalt B')
  })
})

describe('buildDocxBytes', () => {
  it('erzeugt valides .docx-Paket mit den drei Pflicht-Dateien', () => {
    const bytes = buildDocxBytes({
      templateId: 'schriftsatz',
      sections: {
        rubrum_klaeger: 'Hans Müller',
        rubrum_beklagter: 'Max Schulze',
        rubrum_az: '12 O 345/26',
        rubrum_gericht: 'LG Berlin',
        antraege: 'Wir beantragen, der Klage stattzugeben.',
        sachverhalt: 'Die Parteien streiten über die Wirksamkeit der Kündigung.',
        begruendung: 'Der Anspruch ergibt sich aus § 280 BGB.',
        beweise: 'Beweis: Zeuge Müller',
        schluss: 'Wir bitten um Termin.',
      },
    })
    const files = unzipSync(bytes)
    expect(Object.keys(files).sort()).toEqual(
      ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'].sort(),
    )

    const ct = strFromU8(files['[Content_Types].xml'])
    expect(ct).toContain('wordprocessingml.document.main+xml')

    const rels = strFromU8(files['_rels/.rels'])
    expect(rels).toContain('Target="word/document.xml"')

    const doc = strFromU8(files['word/document.xml'])
    expect(doc).toContain('<?xml')
    expect(doc).toContain('Schriftsatz')
    expect(doc).toContain('Hans Müller')
    expect(doc).toContain('Max Schulze')
    expect(doc).toContain('12 O 345/26')
    expect(doc).toContain('LG Berlin')
    expect(doc).toContain('Wir beantragen')
    expect(doc).toContain('§ 280 BGB')
    for (const s of TEMPLATES.schriftsatz.sections) {
      expect(doc).toContain(escapeXml(s.label))
    }
  })

  it('generiert Brief korrekt', () => {
    const bytes = buildDocxBytes({
      templateId: 'brief',
      sections: {
        empfaenger: 'Foo Bar',
        text: 'Sehr geehrte Damen und Herren,\n\nfreundliche Grüße',
      },
    })
    const doc = strFromU8(unzipSync(bytes)['word/document.xml'])
    expect(doc).toContain('Mandantenbrief')
    expect(doc).toContain('Foo Bar')
    expect(doc).toContain('freundliche Grüße')
  })

  it('generiert Vermerk korrekt', () => {
    const bytes = buildDocxBytes({
      templateId: 'vermerk',
      sections: { inhalt: 'Telefonat geführt.' },
    })
    const doc = strFromU8(unzipSync(bytes)['word/document.xml'])
    expect(doc).toContain('Aktenvermerk')
    expect(doc).toContain('Telefonat geführt.')
  })
})
