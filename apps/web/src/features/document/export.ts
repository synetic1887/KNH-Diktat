import type { TemplateId } from '@/store/appStore'

import type { SectionsMap } from './documentSlice'
import { TEMPLATES } from './templates'

export function escapeXml(s: string): string {
  return s.replace(/[&<>'"]/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case "'":
        return '&apos;'
      case '"':
        return '&quot;'
      default:
        return c
    }
  })
}

interface ZipEntry {
  readonly name: string
  readonly data: string
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Erzeugt ein minimales ZIP (Stored, ohne Kompression) aus UTF-8-Strings.
 * Reicht für den .docx-Container, den Word/LibreOffice akzeptiert.
 * Port der `makeZip`-Logik aus reference/mvp.html in TS.
 */
export function makeZip(files: readonly ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  let offset = 0
  type CD = { name: Uint8Array; crc: number; size: number; offset: number }
  const central: CD[] = []

  for (const f of files) {
    const nameBuf = enc.encode(f.name)
    const dataBuf = enc.encode(f.data)
    const crc = crc32(dataBuf)
    const local = new Uint8Array(30 + nameBuf.length + dataBuf.length)
    const dv = new DataView(local.buffer)
    dv.setUint32(0, 0x04034b50, true) // local file header signature
    dv.setUint16(4, 20, true) // version needed
    dv.setUint16(6, 0, true) // flags
    dv.setUint16(8, 0, true) // compression (stored)
    dv.setUint16(10, 0, true) // mod time
    dv.setUint16(12, 0, true) // mod date
    dv.setUint32(14, crc, true)
    dv.setUint32(18, dataBuf.length, true) // compressed size
    dv.setUint32(22, dataBuf.length, true) // uncompressed size
    dv.setUint16(26, nameBuf.length, true)
    dv.setUint16(28, 0, true) // extra
    local.set(nameBuf, 30)
    local.set(dataBuf, 30 + nameBuf.length)
    chunks.push(local)
    central.push({ name: nameBuf, crc, size: dataBuf.length, offset })
    offset += local.length
  }

  let cdir = new Uint8Array(0)
  let cdirSize = 0
  for (const c of central) {
    const rec = new Uint8Array(46 + c.name.length)
    const dv = new DataView(rec.buffer)
    dv.setUint32(0, 0x02014b50, true) // central dir signature
    dv.setUint16(4, 20, true) // version made by
    dv.setUint16(6, 20, true) // version needed
    dv.setUint16(8, 0, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, 0, true)
    dv.setUint16(14, 0, true)
    dv.setUint32(16, c.crc, true)
    dv.setUint32(20, c.size, true)
    dv.setUint32(24, c.size, true)
    dv.setUint16(28, c.name.length, true)
    dv.setUint16(30, 0, true)
    dv.setUint16(32, 0, true)
    dv.setUint16(34, 0, true)
    dv.setUint16(36, 0, true)
    dv.setUint32(38, 0, true)
    dv.setUint32(42, c.offset, true)
    rec.set(c.name, 46)
    const merged = new Uint8Array(cdir.length + rec.length)
    merged.set(cdir, 0)
    merged.set(rec, cdir.length)
    cdir = merged
    cdirSize += rec.length
  }

  const end = new Uint8Array(22)
  const endDv = new DataView(end.buffer)
  endDv.setUint32(0, 0x06054b50, true) // EOCD signature
  endDv.setUint16(8, central.length, true)
  endDv.setUint16(10, central.length, true)
  endDv.setUint32(12, cdirSize, true)
  endDv.setUint32(16, offset, true)

  const total = offset + cdirSize + 22
  const out = new Uint8Array(total)
  let p = 0
  for (const c of chunks) {
    out.set(c, p)
    p += c.length
  }
  out.set(cdir, p)
  p += cdir.length
  out.set(end, p)
  return out
}

/**
 * Baut die `word/document.xml`. Pro Sektion: Heading2 + Absätze.
 * Mehrere Absätze entstehen durch `\n\n`, einfache Zeilenumbrüche durch `<w:br/>`.
 */
export function buildDocumentXml(templateId: TemplateId, sections: SectionsMap): string {
  const t = TEMPLATES[templateId]
  const parts: string[] = []
  parts.push(
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(t.title)}</w:t></w:r></w:p>`,
  )
  for (const s of t.sections) {
    parts.push(
      `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(s.label)}</w:t></w:r></w:p>`,
    )
    const txt = (sections[s.id] ?? '').trim()
    const paragraphs = txt ? txt.split(/\n\n+/) : ['']
    for (const para of paragraphs) {
      const lines = para.split('\n')
      const runs = lines
        .map((ln, i) => (i ? '<w:br/>' : '') + `<w:t xml:space="preserve">${escapeXml(ln)}</w:t>`)
        .join('')
      parts.push(`<w:p><w:r>${runs}</w:r></w:p>`)
    }
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${parts.join('')}<w:sectPr/></w:body></w:document>`
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

export interface BuildDocxInput {
  readonly templateId: TemplateId
  readonly sections: SectionsMap
}

export function buildDocxBytes({ templateId, sections }: BuildDocxInput): Uint8Array {
  const documentXml = buildDocumentXml(templateId, sections)
  return makeZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES_XML },
    { name: '_rels/.rels', data: RELS_XML },
    { name: 'word/document.xml', data: documentXml },
  ])
}

export function buildDocxBlob(input: BuildDocxInput): Blob {
  const bytes = buildDocxBytes(input)
  // TS 5.9 strict: Uint8Array<ArrayBufferLike> ist kein BlobPart, wenn der Buffer SAB sein könnte.
  // Wir kopieren in einen frischen ArrayBuffer und füttern den.
  const ab = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(ab).set(bytes)
  return new Blob([ab], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

export interface DownloadDocxInput extends BuildDocxInput {
  /** Dateiname ohne `.docx`-Endung. */
  readonly filename: string
}

/** Triggert einen Download im Browser. */
export function downloadDocx(input: DownloadDocxInput): void {
  const blob = buildDocxBlob(input)
  const url = URL.createObjectURL(blob)
  const safeName = input.filename.replace(/\s+/g, '_').replace(/[^\w.\-äöüÄÖÜß]/g, '') || 'dokument'
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
