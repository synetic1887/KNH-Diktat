export type TemplateId = 'kanzleibrief' | 'freitext' | 'schriftsatz' | 'brief' | 'vermerk'

export interface SectionDefinition {
  readonly id: string
  readonly label: string
  readonly kind: 'meta' | 'prose'
  readonly aliases: readonly string[]
}

export interface TemplateDefinition {
  readonly id: TemplateId
  readonly title: string
  readonly sections: readonly SectionDefinition[]
}

export interface FormulateRequest {
  readonly sectionContent: string
  readonly sectionLabel: string
  readonly templateTitle: string
}

export interface FormulateResponse {
  readonly formulated: string
}

export type Edit =
  | { readonly sectionId: string; readonly find: string; readonly replace: string }
  | { readonly sectionId: string; readonly newText: string }

export interface EditRequest {
  readonly document: ReadonlyArray<{ readonly id: string; readonly content: string }>
  readonly activeSectionId: string
  readonly instruction: string
  readonly templateId: TemplateId
}

export interface EditResponse {
  readonly edits: readonly Edit[]
  readonly explanation: string
}

export interface ApiError {
  readonly error: { readonly code: string; readonly message: string }
}

export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly orgId: string
  readonly role: 'admin' | 'member'
}

export interface DocumentDto {
  readonly id: string
  readonly templateId: string | null
  readonly title: string
  readonly sections: Record<string, string>
  readonly updatedAt: number
}

export interface ClientDto {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly azPrefix: string | null
  readonly notes: string | null
  readonly createdAt: number
}
