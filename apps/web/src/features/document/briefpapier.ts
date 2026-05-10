import JSZip from 'jszip'

const TEMPLATE_URL = '/templates/briefpapier.docx'

/** Unique Marker im Original-Text — werden im document.xml einmal eingesetzt
 *  und beim Live-Update gegen die State-Werte ausgetauscht. */
export const MARKERS = {
  empf1: '__KD_EMPF_1__',
  empf2: '__KD_EMPF_2__',
  empf3: '__KD_EMPF_3__',
  empf4: '__KD_EMPF_4__',
  inhalt: '__KD_INHALT__',
} as const

let cached: Promise<ArrayBuffer> | null = null
export function loadBriefpapierBytes(): Promise<ArrayBuffer> {
  if (!cached) {
    cached = fetch(TEMPLATE_URL).then(async (res) => {
      if (!res.ok) {
        cached = null
        throw new Error(`Briefpapier konnte nicht geladen werden: HTTP ${res.status}`)
      }
      return res.arrayBuffer()
    })
  }
  return cached
}

function escapeXml(s: string): string {
  return s.replace(/[&<>'"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === "'" ? '&apos;' : '&quot;',
  )
}

/**
 * Findet vor `before` die letzte Position eines öffnenden `<w:p>` oder `<w:p …>`.
 * Wichtig: `<w:pPr>`, `<w:pgSz>` etc. dürfen NICHT matchen.
 */
function lastParagraphOpenBefore(xml: string, before: number): number {
  const re = /<w:p(?=[\s>])/g
  let last = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    if (m.index >= before) break
    last = m.index
  }
  return last
}

/**
 * Ermittelt den XML-Bereich vom Absatz mit `startNeedle` bis zum Absatz mit
 * `endNeedle` (jeweils inklusive der umschließenden `<w:p>…</w:p>`-Tags).
 * Gibt `null` zurück, wenn nicht beide Anker gefunden werden.
 */
function findParagraphRange(
  xml: string,
  startNeedle: string,
  endNeedle: string,
): { start: number; end: number } | null {
  const sIdx = xml.indexOf(startNeedle)
  if (sIdx < 0) return null
  const eIdx = xml.indexOf(endNeedle, sIdx)
  if (eIdx < 0) return null
  const pOpen = lastParagraphOpenBefore(xml, sIdx)
  if (pOpen < 0) return null
  const pCloseTag = '</w:p>'
  const pClose = xml.indexOf(pCloseTag, eIdx)
  if (pClose < 0) return null
  return { start: pOpen, end: pClose + pCloseTag.length }
}

/**
 * Variante für die Live-Preview: setzt MARKER-Strings in die Slots ein.
 * Diese erscheinen nach dem Render als Text-Nodes im DOM und werden dann
 * imperativ ausgetauscht — kein Re-Render der gesamten DOCX bei jeder Eingabe.
 */
export function injectMarkers(xml: string): string {
  let out = xml
  let i = 0
  const empfaenger = [MARKERS.empf1, MARKERS.empf2, MARKERS.empf3, MARKERS.empf4]
  out = out.replace(/<w:t([^>]*)>…<\/w:t>/g, (match, attrs: string) => {
    if (i < 4) {
      const m = empfaenger[i++]
      const a = attrs.includes('xml:space') ? attrs : `${attrs} xml:space="preserve"`
      return `<w:t${a}>${m}</w:t>`
    }
    return match
  })
  // Inhaltsblock: kompletter Bereich von „Sehr geehrter …" über die Leerzeile bis
  // einschließlich „in vorbezeichneter Angelegenheit …" wird durch EINEN
  // Marker-Absatz ersetzt. Der User schreibt seine eigene Anrede mit.
  const range = findParagraphRange(out, 'Sehr geehrte', 'in vorbezeichneter Angelegenheit')
  if (range) {
    out =
      out.slice(0, range.start) +
      `<w:p><w:r><w:t xml:space="preserve">${MARKERS.inhalt}</w:t></w:r></w:p>` +
      out.slice(range.end)
  }
  return out
}

/**
 * Beim Export: gleiche Slot-Logik, aber statt Marker direkt die Inhalte.
 */
export function injectIntoDocumentXml(
  documentXml: string,
  empfaengerLines: readonly string[],
  inhalt: string,
): string {
  let xml = documentXml
  const lines = [
    empfaengerLines[0] ?? '',
    empfaengerLines[1] ?? '',
    empfaengerLines[2] ?? '',
    empfaengerLines[3] ?? '',
  ]
  let count = 0
  xml = xml.replace(/<w:t([^>]*)>…<\/w:t>/g, (match, attrs: string) => {
    if (count < 4) {
      const replacement = lines[count++]
      const a = attrs.includes('xml:space') ? attrs : `${attrs} xml:space="preserve"`
      return `<w:t${a}>${escapeXml(replacement)}</w:t>`
    }
    return match
  })

  const paragraphs = (inhalt || '').split(/\n\n+/).map((para) => {
    const lines2 = para.split('\n')
    const runs = lines2
      .map(
        (line, i) =>
          (i > 0 ? '<w:br/>' : '') + `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`,
      )
      .join('')
    return `<w:p><w:r>${runs}</w:r></w:p>`
  })
  const inhaltXml =
    paragraphs.length > 0
      ? paragraphs.join('')
      : '<w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>'

  // Ersetze gesamten Bereich Anrede → leere Zeile → „in vorbezeichneter …"
  // durch die diktierten Inhalt-Absätze.
  const range = findParagraphRange(xml, 'Sehr geehrte', 'in vorbezeichneter Angelegenheit')
  if (range) {
    xml = xml.slice(0, range.start) + inhaltXml + xml.slice(range.end)
  }
  return xml
}

export interface KanzleibriefExportInput {
  readonly empfaenger: string
  readonly inhalt: string
  readonly filename: string
}

export async function exportKanzleibriefDocx(input: KanzleibriefExportInput): Promise<void> {
  const bytes = await loadBriefpapierBytes()
  const zip = await JSZip.loadAsync(bytes.slice(0))
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('Briefpapier-Template defekt: word/document.xml fehlt.')
  const original = await docFile.async('string')
  const empfaengerLines = (input.empfaenger || '').split('\n')
  const next = injectIntoDocumentXml(original, empfaengerLines, input.inhalt)
  zip.file('word/document.xml', next)
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  const url = URL.createObjectURL(blob)
  const safeName =
    (input.filename || 'Brief').replace(/\s+/g, '_').replace(/[^\w.\-äöüÄÖÜß]/g, '') || 'Brief'
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Initial-Render: lädt das Briefpapier, injiziert MARKER und rendert via
 * docx-preview in den Container. Wird genau einmal pro Mount aufgerufen.
 */
export async function renderBriefpapierWithMarkers(container: HTMLElement): Promise<void> {
  const [{ renderAsync }, bytes] = await Promise.all([
    import('docx-preview'),
    loadBriefpapierBytes(),
  ])
  const zip = await JSZip.loadAsync(bytes.slice(0))
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('Briefpapier-Template defekt.')
  const original = await docFile.async('string')
  zip.file('word/document.xml', injectMarkers(original))
  const blob = await zip.generateAsync({ type: 'blob' })
  container.innerHTML = ''
  await renderAsync(blob, container, undefined, {
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    experimental: true,
    useBase64URL: true,
    className: 'kd-briefpapier',
  })
}

export interface SlotRefs {
  empf: (Text | null)[]
  inhalt: HTMLElement | null
}

/**
 * Findet im gerenderten DOM die Marker-Stellen und liefert Referenzen.
 *  - Empfänger: Text-Nodes, einer pro Slot (Single-Line je Zeile)
 *  - Inhalt: Paragraph-Element (Multi-Line via <br>)
 */
export function findSlots(container: HTMLElement): SlotRefs {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const refs: SlotRefs = { empf: [null, null, null, null], inhalt: null }
  const empfMarkers = [MARKERS.empf1, MARKERS.empf2, MARKERS.empf3, MARKERS.empf4]
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node as Text
    const text = t.textContent ?? ''
    for (let i = 0; i < 4; i++) {
      if (text === empfMarkers[i]) refs.empf[i] = t
    }
    if (text === MARKERS.inhalt) {
      let el: HTMLElement | null = t.parentElement
      while (el && el.tagName !== 'P') el = el.parentElement
      refs.inhalt = el ?? t.parentElement
    }
  }
  return refs
}

/** Schreibt die Empfänger-Slots (textContent), ohne irgendwo neu zu rendern. */
export function updateEmpfaengerSlots(refs: SlotRefs, empfaenger: string): void {
  const lines = empfaenger.split('\n')
  for (let i = 0; i < 4; i++) {
    const node = refs.empf[i]
    if (!node) continue
    // Bei leerer Zeile setzen wir einen Nbsp, damit die Zeilenhöhe erhalten bleibt.
    const v = lines[i]
    node.textContent = v && v.length > 0 ? v : ' '
  }
}

/** Aktualisiert den Inhalts-Block (multi-line mit <br>) — kein Re-Render. */
export function updateInhaltSlot(refs: SlotRefs, inhalt: string): void {
  const p = refs.inhalt
  if (!p) return
  while (p.firstChild) p.removeChild(p.firstChild)
  const lines = (inhalt || '').split('\n')
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    p.appendChild(document.createTextNode(' '))
    return
  }
  lines.forEach((line, i) => {
    if (i > 0) p.appendChild(document.createElement('br'))
    p.appendChild(document.createTextNode(line.length > 0 ? line : ' '))
  })
}
