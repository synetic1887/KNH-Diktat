import { describe, expect, it } from 'vitest'

import { isAiEditIntent, parseCommand } from './voiceCommands'

describe('parseCommand — Punctuation', () => {
  it.each([
    ['punkt', '.'],
    ['komma', ','],
    ['doppelpunkt', ':'],
    ['semikolon', ';'],
    ['fragezeichen', '?'],
    ['ausrufezeichen', '!'],
    ['anführungszeichen', '"'],
    ['anfuehrungszeichen', '"'],
  ])('mappt "%s" auf "%s"', (input, char) => {
    const r = parseCommand(input)
    expect(r).toEqual({
      type: 'command',
      command: { category: 'punctuation', kind: 'punct', char },
    })
  })

  it('mappt "neuer absatz" auf \\n\\n', () => {
    const r = parseCommand('neuer absatz')
    expect(r).toEqual({
      type: 'command',
      command: { category: 'punctuation', kind: 'paragraph', char: '\n\n' },
    })
  })

  it('mappt "absatz" auf \\n\\n', () => {
    const r = parseCommand('absatz')
    expect(r).toEqual({
      type: 'command',
      command: { category: 'punctuation', kind: 'paragraph', char: '\n\n' },
    })
  })

  it('mappt "neue zeile" auf \\n', () => {
    const r = parseCommand('neue zeile')
    expect(r).toEqual({
      type: 'command',
      command: { category: 'punctuation', kind: 'newline', char: '\n' },
    })
  })
})

describe('parseCommand — Control', () => {
  it.each(['stopp', 'stop', 'diktat beenden', 'Stopp.', 'STOP'])('erkennt Stop "%s"', (input) => {
    expect(parseCommand(input)).toEqual({
      type: 'command',
      command: { category: 'control', kind: 'stop' },
    })
  })
})

describe('parseCommand — Edit (lokal)', () => {
  it('erkennt "rückgängig"', () => {
    expect(parseCommand('rückgängig')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'undo' },
    })
  })
  it('erkennt "rueckgaengig" (ASCII-Variante)', () => {
    expect(parseCommand('rueckgaengig')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'undo' },
    })
  })

  it('erkennt "lösche letztes wort"', () => {
    expect(parseCommand('lösche letztes wort')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'delete-last-word' },
    })
  })

  it('erkennt "lösche letzten satz"', () => {
    expect(parseCommand('lösche letzten satz')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'delete-last-sentence' },
    })
  })

  it('erkennt "lösche absatz"', () => {
    expect(parseCommand('lösche absatz')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'delete-paragraph' },
    })
  })

  it('erkennt "lösche sektion" als delete-paragraph', () => {
    expect(parseCommand('lösche sektion')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'delete-paragraph' },
    })
  })

  it('parst "ersetze X durch Y" mit Originalcase', () => {
    const r = parseCommand('Ersetze Müller durch Meier')
    expect(r).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'replace', find: 'Müller', replace: 'Meier' },
    })
  })

  it('parst "ersetz" (ohne e am Ende)', () => {
    const r = parseCommand('Ersetz alt durch neu')
    expect(r).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'replace', find: 'alt', replace: 'neu' },
    })
  })

  it('parst "ersetze ... durch ..." mit abschließendem Punkt', () => {
    const r = parseCommand('Ersetze 5.000 durch 7.500.')
    expect(r).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'replace', find: '5.000', replace: '7.500' },
    })
  })

  it('mehrere Wörter werden korrekt erkannt', () => {
    const r = parseCommand('Ersetze Hans Müller durch Eva Meier')
    expect(r).toEqual({
      type: 'command',
      command: {
        category: 'edit',
        kind: 'replace',
        find: 'Hans Müller',
        replace: 'Eva Meier',
      },
    })
  })
})

describe('parseCommand — Navigation', () => {
  it.each(['nächste sektion', 'naechste sektion'])('erkennt "%s" als next-section', (s) => {
    expect(parseCommand(s)).toEqual({
      type: 'command',
      command: { category: 'navigation', kind: 'next-section' },
    })
  })

  it('erkennt "vorherige sektion" als prev-section', () => {
    expect(parseCommand('vorherige sektion')).toEqual({
      type: 'command',
      command: { category: 'navigation', kind: 'prev-section' },
    })
  })

  it('parst "springe zu rubrum"', () => {
    expect(parseCommand('Springe zu Rubrum')).toEqual({
      type: 'command',
      command: { category: 'navigation', kind: 'jump-section', target: 'rubrum' },
    })
  })

  it('parst "spring zu antrag" (ohne e)', () => {
    expect(parseCommand('Spring zu Antrag')).toEqual({
      type: 'command',
      command: { category: 'navigation', kind: 'jump-section', target: 'antrag' },
    })
  })

  it('parst "gehe zu sachverhalt"', () => {
    expect(parseCommand('Gehe zu Sachverhalt')).toEqual({
      type: 'command',
      command: { category: 'navigation', kind: 'jump-section', target: 'sachverhalt' },
    })
  })

  it('parst "zu beweise"', () => {
    expect(parseCommand('zu beweise')).toEqual({
      type: 'command',
      command: { category: 'navigation', kind: 'jump-section', target: 'beweise' },
    })
  })
})

describe('parseCommand — Template', () => {
  it.each([
    ['vorlage schriftsatz', 'schriftsatz'],
    ['vorlage klage', 'schriftsatz'],
    ['vorlage brief', 'kanzleibrief'],
    ['vorlage mandantenbrief', 'kanzleibrief'],
    ['vorlage kanzleibrief', 'kanzleibrief'],
    ['vorlage vermerk', 'vermerk'],
    ['vorlage aktenvermerk', 'vermerk'],
  ])('mappt "%s" auf templateId=%s', (input, expected) => {
    expect(parseCommand(input)).toEqual({
      type: 'command',
      command: { category: 'template', kind: 'set-template', templateId: expected },
    })
  })

  it('ignoriert unbekannte Vorlage und behandelt sie als Text', () => {
    const r = parseCommand('vorlage rechnung')
    expect(r.type).toBe('text')
  })

  it('parst „neuer Schriftsatz für Mandant Müller"', () => {
    const r = parseCommand('Neuer Schriftsatz für Mandant Müller')
    expect(r).toEqual({
      type: 'command',
      command: {
        category: 'template',
        kind: 'new-with-client',
        templateId: 'schriftsatz',
        clientQuery: 'Müller',
      },
    })
  })

  it('parst „neue Klage für Mandanten Hans Müller"', () => {
    const r = parseCommand('Neue Klage für Mandanten Hans Müller')
    expect(r).toEqual({
      type: 'command',
      command: {
        category: 'template',
        kind: 'new-with-client',
        templateId: 'schriftsatz',
        clientQuery: 'Hans Müller',
      },
    })
  })

  it('parst „neuer Brief für Eva Schulze" (ohne „Mandant")', () => {
    const r = parseCommand('Neuer Brief für Eva Schulze')
    expect(r).toEqual({
      type: 'command',
      command: {
        category: 'template',
        kind: 'new-with-client',
        templateId: 'kanzleibrief',
        clientQuery: 'Eva Schulze',
      },
    })
  })
})

describe('parseCommand — KI', () => {
  it.each(['formulieren', 'KI formulieren', 'schön formulieren'])(
    'erkennt "%s" als formulate',
    (s) => {
      expect(parseCommand(s)).toEqual({
        type: 'command',
        command: { category: 'ai', kind: 'formulate' },
      })
    },
  )

  it('erkennt "korrigiere ..." als ai-edit', () => {
    const r = parseCommand('Korrigiere im Antrag den Betrag von 5000 auf 7500')
    expect(r.type).toBe('command')
    if (r.type !== 'command') return
    expect(r.command.category).toBe('ai')
    expect(r.command.kind).toBe('edit')
    if (r.command.category === 'ai' && r.command.kind === 'edit') {
      expect(r.command.instruction).toContain('Korrigiere')
    }
  })

  it('erkennt "ändere ..." als ai-edit', () => {
    const r = parseCommand('Ändere die Adresse oben auf Hauptstraße 5')
    expect(r.type).toBe('command')
    if (r.type !== 'command') return
    expect(r.command).toMatchObject({ category: 'ai', kind: 'edit' })
  })

  it('erkennt "schreibe stattdessen ..." als ai-edit', () => {
    const r = parseCommand('Schreibe stattdessen Beklagter erkennt an')
    expect(r.type).toBe('command')
    if (r.type !== 'command') return
    expect(r.command).toMatchObject({ category: 'ai', kind: 'edit' })
  })

  it('erkennt "soll heißen" als ai-edit', () => {
    const r = parseCommand('Der Antrag soll heißen Klage abweisen')
    expect(r.type).toBe('command')
    if (r.type !== 'command') return
    expect(r.command).toMatchObject({ category: 'ai', kind: 'edit' })
  })

  it('erkennt "nicht ... sondern ..." als ai-edit', () => {
    const r = parseCommand('Das ist nicht Müller sondern Meier')
    expect(r.type).toBe('command')
    if (r.type !== 'command') return
    expect(r.command).toMatchObject({ category: 'ai', kind: 'edit' })
  })

  it('isAiEditIntent: leerer String → false', () => {
    expect(isAiEditIntent('')).toBe(false)
    expect(isAiEditIntent('   ')).toBe(false)
  })

  it('isAiEditIntent: normaler Diktat-Text → false', () => {
    expect(isAiEditIntent('Die Parteien streiten über die Wirksamkeit der Kündigung.')).toBe(false)
  })
})

describe('parseCommand — Edge Cases', () => {
  it('leerer String → empty', () => {
    expect(parseCommand('')).toEqual({ type: 'empty' })
    expect(parseCommand('   ')).toEqual({ type: 'empty' })
  })

  it('normaler Diktat-Text → text', () => {
    const r = parseCommand('Die Parteien streiten über die Wirksamkeit der Kündigung.')
    expect(r.type).toBe('text')
    if (r.type === 'text') {
      expect(r.text).toBe('Die Parteien streiten über die Wirksamkeit der Kündigung.')
    }
  })

  it('Punktierung am Ende wird für Befehl-Match abgeschnitten', () => {
    expect(parseCommand('Stopp.')).toEqual({
      type: 'command',
      command: { category: 'control', kind: 'stop' },
    })
    expect(parseCommand('rückgängig!')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'undo' },
    })
  })

  it('lokales "lösche absatz" hat Vorrang vor AI-Verb', () => {
    expect(parseCommand('lösche absatz')).toEqual({
      type: 'command',
      command: { category: 'edit', kind: 'delete-paragraph' },
    })
  })

  it('"ersetze X durch Y" matcht lokal, nicht als AI-Edit', () => {
    const r = parseCommand('ersetze alt durch neu')
    expect(r.type).toBe('command')
    if (r.type !== 'command') return
    expect(r.command.category).toBe('edit')
    expect(r.command.kind).toBe('replace')
  })

  it('"vorlage schriftsatz." mit Punkt am Ende', () => {
    expect(parseCommand('vorlage schriftsatz.')).toEqual({
      type: 'command',
      command: { category: 'template', kind: 'set-template', templateId: 'schriftsatz' },
    })
  })
})
