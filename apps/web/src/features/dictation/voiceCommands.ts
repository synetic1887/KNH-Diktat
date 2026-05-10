import type { TemplateId } from '@/store/appStore'

import type { Command, CommandResult, ParseContext } from './types'

const PUNCTUATION: Readonly<Record<string, string>> = {
  punkt: '.',
  komma: ',',
  doppelpunkt: ':',
  semikolon: ';',
  fragezeichen: '?',
  ausrufezeichen: '!',
  anführungszeichen: '"',
  anfuehrungszeichen: '"',
}

const TEMPLATE_ALIASES: Readonly<Record<string, TemplateId>> = {
  kanzleibrief: 'kanzleibrief',
  knh: 'kanzleibrief',
  freitext: 'freitext',
  text: 'freitext',
  schriftsatz: 'schriftsatz',
  klage: 'schriftsatz',
  brief: 'kanzleibrief',
  mandantenbrief: 'kanzleibrief',
  vermerk: 'vermerk',
  aktenvermerk: 'vermerk',
}

const STOP_PHRASES = new Set(['stopp', 'stop', 'diktat beenden'])
const UNDO_PHRASES = new Set(['rückgängig', 'rueckgaengig'])
const FORMULATE_PHRASES = new Set(['formulieren', 'ki formulieren', 'schön formulieren'])
const NEXT_SECTION = new Set(['nächste sektion', 'naechste sektion'])
const PREV_SECTION = new Set(['vorherige sektion'])
const PARAGRAPH = new Set(['neuer absatz', 'absatz'])
const NEWLINE = new Set(['neue zeile'])
const DELETE_LAST_WORD = new Set(['lösche letztes wort', 'loesche letztes wort'])
const DELETE_LAST_SENTENCE = new Set(['lösche letzten satz', 'loesche letzten satz'])
const DELETE_PARAGRAPH = new Set(['lösche absatz', 'loesche absatz', 'lösche sektion'])

const JUMP_PATTERN = /^(?:springe? zu|gehe zu|zu) (.+)$/
const TEMPLATE_PATTERN =
  /^vorlage (kanzleibrief|knh|freitext|text|schriftsatz|klage|brief|mandantenbrief|vermerk|aktenvermerk)$/
const REPLACE_PATTERN = /^ersetz[e]? (.+?) durch (.+?)\.?$/i
const NEW_WITH_CLIENT_PATTERN =
  /^neue[rsn]?\s+(kanzleibrief|knh|schriftsatz|klage|brief|mandantenbrief|vermerk|aktenvermerk)\s+(?:für|fuer)\s+(?:mandant(?:en)?\s+)?(.+)$/i

const AI_EDIT_VERB = new RegExp(
  '^(bitte\\s+)?(' +
    'korrigier|korrektur|' +
    'änder[ne]?|aende[rn]|' +
    'streiche|entferne|lösche\\s|loesche\\s|' +
    'tausche|ersetze|' +
    'füg(e)?\\s|fueg(e)?\\s|' +
    'schreibe\\s+stattdessen|' +
    'mache?\\s+aus|' +
    'anstelle\\s+von|' +
    'nimm\\s+(?:das|den|die)\\s|' +
    'setze' +
    ')',
)
const AI_EDIT_PHRASES: readonly RegExp[] = [
  /\bsoll(te)?\s+(heißen|heissen|sein|lauten|stehen)\b/,
  /\bnicht\b.*\bsondern\b/,
  /\bstattdessen\b/,
]

/**
 * Erkennt natürlich-sprachliche Korrektur-Anweisungen.
 * Spiegel des `isAiEditIntent`-Verhaltens aus reference/mvp.html.
 */
export function isAiEditIntent(raw: string): boolean {
  const t = raw.toLowerCase().trim()
  if (!t) return false
  if (AI_EDIT_VERB.test(t)) return true
  return AI_EDIT_PHRASES.some((p) => p.test(t))
}

function command(c: Command): CommandResult {
  return { type: 'command', command: c }
}

/**
 * Reine Parser-Funktion. Nimmt einen Spracherkennungs-Final-Text entgegen und liefert
 * entweder einen strukturierten Command, den Klartext (wenn nichts erkannt wurde)
 * oder `empty` (Whitespace).
 *
 * Keine Seiteneffekte, keine Store-Mutationen — die Anwendung des Befehls passiert beim
 * Konsumenten (Hook / Reducer).
 */
export function parseCommand(raw: string, _ctx?: ParseContext): CommandResult {
  if (!raw || !raw.trim()) return { type: 'empty' }

  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '')
  if (!text) return { type: 'empty' }

  // 1. Punctuation (when said in isolation)
  const punct = PUNCTUATION[text]
  if (punct !== undefined) {
    return command({ category: 'punctuation', kind: 'punct', char: punct })
  }

  // 2. Paragraph / newline
  if (PARAGRAPH.has(text)) {
    return command({ category: 'punctuation', kind: 'paragraph', char: '\n\n' })
  }
  if (NEWLINE.has(text)) {
    return command({ category: 'punctuation', kind: 'newline', char: '\n' })
  }

  // 3. Control
  if (STOP_PHRASES.has(text)) {
    return command({ category: 'control', kind: 'stop' })
  }

  // 4. Edit — undo / delete-* (must come BEFORE the AI-edit verb pattern,
  //    da "lösche " in beiden Welten matcht; lokale Phrasen sind exakte Matches.)
  if (UNDO_PHRASES.has(text)) {
    return command({ category: 'edit', kind: 'undo' })
  }
  if (DELETE_LAST_WORD.has(text)) {
    return command({ category: 'edit', kind: 'delete-last-word' })
  }
  if (DELETE_LAST_SENTENCE.has(text)) {
    return command({ category: 'edit', kind: 'delete-last-sentence' })
  }
  if (DELETE_PARAGRAPH.has(text)) {
    return command({ category: 'edit', kind: 'delete-paragraph' })
  }

  // 5. Navigation
  if (NEXT_SECTION.has(text)) {
    return command({ category: 'navigation', kind: 'next-section' })
  }
  if (PREV_SECTION.has(text)) {
    return command({ category: 'navigation', kind: 'prev-section' })
  }

  // 6a. „neuer Schriftsatz für Mandant Müller" — Vorlage + Mandanten-Suche
  const newWithClient = raw
    .trim()
    .replace(/[.!?]+$/, '')
    .match(NEW_WITH_CLIENT_PATTERN)
  if (newWithClient) {
    const tplKey = newWithClient[1].toLowerCase()
    const id = TEMPLATE_ALIASES[tplKey as keyof typeof TEMPLATE_ALIASES]
    const clientQuery = newWithClient[2].trim()
    if (id && clientQuery) {
      return command({
        category: 'template',
        kind: 'new-with-client',
        templateId: id,
        clientQuery,
      })
    }
  }

  // 6b. Template wechseln
  const tplMatch = text.match(TEMPLATE_PATTERN)
  if (tplMatch) {
    const id = TEMPLATE_ALIASES[tplMatch[1] as keyof typeof TEMPLATE_ALIASES]
    if (id) {
      return command({ category: 'template', kind: 'set-template', templateId: id })
    }
  }

  // 7. Springe zu Sektion
  const jumpMatch = text.match(JUMP_PATTERN)
  if (jumpMatch) {
    const target = jumpMatch[1].trim().toLowerCase()
    return command({ category: 'navigation', kind: 'jump-section', target })
  }

  // 8. Ersetze X durch Y — auf raw matchen, damit Groß-/Kleinschreibung erhalten bleibt
  const replaceMatch = raw
    .trim()
    .replace(/[.!?]+$/, '')
    .match(REPLACE_PATTERN)
  if (replaceMatch) {
    const find = replaceMatch[1].trim()
    const replace = replaceMatch[2].trim()
    if (find && replace) {
      return command({ category: 'edit', kind: 'replace', find, replace })
    }
  }

  // 9. KI: Formulieren
  if (FORMULATE_PHRASES.has(text)) {
    return command({ category: 'ai', kind: 'formulate' })
  }

  // 10. KI: natürlich-sprachliche Korrektur
  if (isAiEditIntent(raw)) {
    return command({ category: 'ai', kind: 'edit', instruction: raw.trim() })
  }

  // 11. Kein Befehl — als Diktat-Inhalt einfügen
  return { type: 'text', text: raw.trim() }
}
