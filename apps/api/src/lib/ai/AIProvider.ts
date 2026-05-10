import type { TemplateId } from 'shared'

export type FormulateMode = 'formulate' | 'proofread'

export interface FormulateInput {
  readonly sectionContent: string
  readonly sectionLabel: string
  readonly templateTitle: string
  /** 'formulate' (Default) = juristischer Stil; 'proofread' = nur Rechtschreibung/Grammatik/Satzbau. */
  readonly mode?: FormulateMode
}

export interface FormulateOutput {
  readonly formulated: string
}

export type Edit =
  | { readonly sectionId: string; readonly find: string; readonly replace: string }
  | { readonly sectionId: string; readonly newText: string }

export interface EditInput {
  readonly document: ReadonlyArray<{ readonly id: string; readonly content: string }>
  readonly activeSectionId: string
  readonly instruction: string
  readonly templateId: TemplateId
}

export interface EditOutput {
  readonly edits: readonly Edit[]
  readonly explanation: string
}

export interface AIProvider {
  formulate(input: FormulateInput): Promise<FormulateOutput>
  formulateStream(input: FormulateInput, onDelta: (chunk: string) => void): Promise<FormulateOutput>
  edit(input: EditInput): Promise<EditOutput>
}
