import { beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from './documentSlice'

beforeEach(() => {
  useDocumentStore.getState().resetForTemplate('schriftsatz')
})

describe('documentSlice — Templates', () => {
  it('startet im Schriftsatz mit erster Sektion aktiv', () => {
    const s = useDocumentStore.getState()
    expect(s.templateId).toBe('schriftsatz')
    expect(s.activeSectionId).toBe('rubrum_klaeger')
    expect(Object.keys(s.sections)).toContain('antraege')
  })

  it('setTemplate wechselt Vorlage und resettet Sektionen', () => {
    useDocumentStore.getState().appendToActive('Test')
    useDocumentStore.getState().setTemplate('brief')
    const s = useDocumentStore.getState()
    expect(s.templateId).toBe('brief')
    expect(s.activeSectionId).toBe('empfaenger')
    expect(Object.values(s.sections).every((v) => v === '')).toBe(true)
  })
})

describe('documentSlice — Navigation', () => {
  it('jumpToSection per Alias', () => {
    expect(useDocumentStore.getState().jumpToSection('rubrum')).toBe(true)
    expect(useDocumentStore.getState().activeSectionId).toBe('rubrum_klaeger')

    expect(useDocumentStore.getState().jumpToSection('Antrag')).toBe(true)
    expect(useDocumentStore.getState().activeSectionId).toBe('antraege')

    expect(useDocumentStore.getState().jumpToSection('Sachverhalt')).toBe(true)
    expect(useDocumentStore.getState().activeSectionId).toBe('sachverhalt')
  })

  it('jumpToSection mit unbekanntem Alias gibt false', () => {
    expect(useDocumentStore.getState().jumpToSection('quatsch')).toBe(false)
  })

  it('nextSection und prevSection wandern korrekt', () => {
    useDocumentStore.getState().setActiveSection('antraege')
    useDocumentStore.getState().nextSection()
    expect(useDocumentStore.getState().activeSectionId).toBe('sachverhalt')
    useDocumentStore.getState().prevSection()
    expect(useDocumentStore.getState().activeSectionId).toBe('antraege')
  })

  it('nextSection am Ende bleibt stehen', () => {
    useDocumentStore.getState().setActiveSection('schluss')
    useDocumentStore.getState().nextSection()
    expect(useDocumentStore.getState().activeSectionId).toBe('schluss')
  })
})

describe('documentSlice — Append', () => {
  it('appendToActive setzt Leerzeichen zwischen Wörtern', () => {
    useDocumentStore.getState().appendToActive('Hans')
    useDocumentStore.getState().appendToActive('Müller')
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Hans Müller')
  })

  it('appendToActive setzt KEIN Leerzeichen vor Punkt', () => {
    useDocumentStore.getState().appendToActive('Hallo')
    useDocumentStore.getState().appendToActive('.')
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Hallo.')
  })

  it('appendRaw fügt Text wörtlich an', () => {
    useDocumentStore.getState().appendToActive('Zeile 1')
    useDocumentStore.getState().appendRaw('\n\n')
    useDocumentStore.getState().appendToActive('Zeile 2')
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Zeile 1\n\nZeile 2')
  })
})

describe('documentSlice — Replace', () => {
  it('replaceInActive findet (case-insensitive) und ersetzt mit Originalcase', () => {
    useDocumentStore.getState().appendToActive('Beklagter Müller wohnt in München')
    const ok = useDocumentStore.getState().replaceInActive('müller', 'Meier')
    expect(ok).toBe(true)
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe(
      'Beklagter Meier wohnt in München',
    )
  })

  it('replaceInActive: kein Treffer → false und Inhalt bleibt', () => {
    useDocumentStore.getState().appendToActive('Hallo Welt')
    const ok = useDocumentStore.getState().replaceInActive('Foo', 'Bar')
    expect(ok).toBe(false)
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Hallo Welt')
  })
})

describe('documentSlice — Löschen', () => {
  it('deleteLastWord entfernt das letzte Wort', () => {
    useDocumentStore.getState().appendToActive('Eins zwei drei')
    useDocumentStore.getState().deleteLastWord()
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Eins zwei ')
  })

  it('deleteLastSentence schneidet bis zum letzten Satzende', () => {
    useDocumentStore.getState().appendToActive('Erster Satz. Zweiter Satz!')
    useDocumentStore.getState().deleteLastSentence()
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Erster Satz.')
  })

  it('deleteParagraph leert die aktive Sektion', () => {
    useDocumentStore.getState().appendToActive('Inhalt')
    useDocumentStore.getState().deleteParagraph()
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('')
  })
})

describe('documentSlice — Undo', () => {
  it('undo nimmt letzte Mutation zurück', () => {
    useDocumentStore.getState().appendToActive('Erster')
    useDocumentStore.getState().appendToActive('Zweiter')
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Erster Zweiter')
    expect(useDocumentStore.getState().undo()).toBe(true)
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Erster')
  })

  it('undo bei leerer Historie → false', () => {
    expect(useDocumentStore.getState().undo()).toBe(false)
  })

  it('Undo-Stack ist auf 50 begrenzt', () => {
    for (let i = 0; i < 60; i++) useDocumentStore.getState().appendToActive(String(i))
    expect(useDocumentStore.getState().history.length).toBe(50)
  })
})

describe('documentSlice — Snapshot', () => {
  it('getSnapshot liefert ein eingefrorenes Abbild', () => {
    useDocumentStore.getState().appendToActive('Inhalt')
    const snap = useDocumentStore.getState().getSnapshot()
    useDocumentStore.getState().appendToActive('Mehr')
    expect(snap.sections['rubrum_klaeger']).toBe('Inhalt')
    expect(useDocumentStore.getState().sections['rubrum_klaeger']).toBe('Inhalt Mehr')
  })

  it('loadDocument setzt komplettes Dokument', () => {
    useDocumentStore.getState().loadDocument({
      templateId: 'brief',
      title: 'Test',
      sections: { empfaenger: 'Foo', text: 'Bar' },
      activeSectionId: 'text',
    })
    const s = useDocumentStore.getState()
    expect(s.templateId).toBe('brief')
    expect(s.activeSectionId).toBe('text')
    expect(s.sections['text']).toBe('Bar')
  })
})
