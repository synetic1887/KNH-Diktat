export { TEMPLATES, resolveSectionByAlias } from './templates'
export type { TemplateDefinition, SectionDefinition, SectionKind } from './templates'
export { useDocumentStore, isDocumentEmpty } from './documentSlice'
export type { SectionsMap, DocumentSnapshot } from './documentSlice'
export { DocumentPreview } from './document-preview'
export { BriefpapierPreview } from './briefpapier-preview'
export { exportKanzleibriefDocx, loadBriefpapierBytes } from './briefpapier'
export { ExportButton } from './export-button'
export {
  buildDocumentXml,
  buildDocxBlob,
  buildDocxBytes,
  downloadDocx,
  escapeXml,
  makeZip,
} from './export'
export type { BuildDocxInput, DownloadDocxInput } from './export'
export { requestAIEdit, requestAIFormulate, withAiBusy } from './aiCommands'
export type { AIEditResult, AIFormulateResult } from './aiCommands'
