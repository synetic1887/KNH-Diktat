import type { TemplateId } from '@/store/appStore'

export type PunctuationCommand = {
  readonly category: 'punctuation'
  readonly kind: 'punct' | 'paragraph' | 'newline'
  /** the literal character(s) to append for `punct` and `paragraph`/`newline`. */
  readonly char: string
}

export type NavigationCommand =
  | { readonly category: 'navigation'; readonly kind: 'next-section' }
  | { readonly category: 'navigation'; readonly kind: 'prev-section' }
  | { readonly category: 'navigation'; readonly kind: 'jump-section'; readonly target: string }

export type EditCommand =
  | {
      readonly category: 'edit'
      readonly kind: 'replace'
      readonly find: string
      readonly replace: string
    }
  | { readonly category: 'edit'; readonly kind: 'delete-last-word' }
  | { readonly category: 'edit'; readonly kind: 'delete-last-sentence' }
  | { readonly category: 'edit'; readonly kind: 'delete-paragraph' }
  | { readonly category: 'edit'; readonly kind: 'undo' }

export type TemplateCommand =
  | {
      readonly category: 'template'
      readonly kind: 'set-template'
      readonly templateId: TemplateId
    }
  | {
      /** „neuer Schriftsatz für Mandant Müller" — wechselt Vorlage + sucht Mandant. */
      readonly category: 'template'
      readonly kind: 'new-with-client'
      readonly templateId: TemplateId
      readonly clientQuery: string
    }

export type ControlCommand = {
  readonly category: 'control'
  readonly kind: 'stop'
}

export type AICommand =
  | { readonly category: 'ai'; readonly kind: 'formulate' }
  | { readonly category: 'ai'; readonly kind: 'edit'; readonly instruction: string }

export type Command =
  | PunctuationCommand
  | NavigationCommand
  | EditCommand
  | TemplateCommand
  | ControlCommand
  | AICommand

export type CommandResult =
  | { readonly type: 'command'; readonly command: Command }
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'empty' }

export interface ParseContext {
  /**
   * Wenn gesetzt, ergänzen wir Diagnose-Info (z.B. Hinweis bei unbekannter Sektion).
   * Bleibt der Parser eine reine Funktion ohne Seiteneffekte.
   */
  readonly knownSectionIds?: readonly string[]
}
