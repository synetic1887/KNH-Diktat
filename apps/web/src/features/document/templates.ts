import type { TemplateId } from '@/store/appStore'

export type SectionKind = 'meta' | 'prose'

export interface SectionDefinition {
  readonly id: string
  readonly label: string
  readonly kind: SectionKind
  readonly placeholder: string
}

export interface TemplateDefinition {
  readonly id: TemplateId
  readonly title: string
  readonly sections: readonly SectionDefinition[]
  /** Sprachalias → sectionId, alle Schlüssel kleingeschrieben. */
  readonly aliases: Readonly<Record<string, string>>
  /** Sektion, die beim Öffnen aktiv sein soll. Default: erste Sektion. */
  readonly defaultSectionId?: string
}

export const TEMPLATES: Readonly<Record<TemplateId, TemplateDefinition>> = {
  kanzleibrief: {
    id: 'kanzleibrief',
    title: 'Kanzleibrief (KNH)',
    defaultSectionId: 'inhalt',
    sections: [
      {
        id: 'empfaenger',
        label: 'Empfänger',
        kind: 'meta',
        placeholder:
          'Anschrift des Empfängers (z.B. Frau Dr. Müller\\nMusterstraße 12\\n60311 Frankfurt am Main)',
      },
      {
        id: 'inhalt',
        label: 'Inhalt',
        kind: 'prose',
        placeholder:
          'In vorbezeichneter Angelegenheit … (einfach lossprechen, oben das Adressfeld kommt automatisch ins Anschriftenfeld)',
      },
    ],
    aliases: {
      empfänger: 'empfaenger',
      empfaenger: 'empfaenger',
      adresse: 'empfaenger',
      anschrift: 'empfaenger',
      inhalt: 'inhalt',
      text: 'inhalt',
      brief: 'inhalt',
    },
  },
  freitext: {
    id: 'freitext',
    title: 'Freitext',
    sections: [
      {
        id: 'inhalt',
        label: 'Inhalt',
        kind: 'prose',
        placeholder:
          'Sprich einfach drauf los. Beispiel: „Sehr geehrter Herr Geis, …" — KI-Korrekturen wirken live: „ändere Gies zu Geis".',
      },
    ],
    aliases: {
      inhalt: 'inhalt',
      text: 'inhalt',
      freitext: 'inhalt',
    },
  },
  schriftsatz: {
    id: 'schriftsatz',
    title: 'Schriftsatz',
    sections: [
      {
        id: 'rubrum_klaeger',
        label: 'Kläger',
        kind: 'meta',
        placeholder: 'Name, Anschrift des Klägers',
      },
      {
        id: 'rubrum_beklagter',
        label: 'Beklagter',
        kind: 'meta',
        placeholder: 'Name, Anschrift des Beklagten',
      },
      { id: 'rubrum_az', label: 'Aktenzeichen', kind: 'meta', placeholder: 'z.B. 12 O 345/26' },
      {
        id: 'rubrum_gericht',
        label: 'Gericht',
        kind: 'meta',
        placeholder: 'z.B. Landgericht Berlin',
      },
      { id: 'antraege', label: 'Anträge', kind: 'prose', placeholder: 'Wir beantragen, …' },
      {
        id: 'sachverhalt',
        label: 'Sachverhalt',
        kind: 'prose',
        placeholder: 'Die Parteien streiten über …',
      },
      {
        id: 'begruendung',
        label: 'Rechtliche Würdigung',
        kind: 'prose',
        placeholder: 'Der Anspruch ergibt sich aus …',
      },
      { id: 'beweise', label: 'Beweisangebote', kind: 'prose', placeholder: 'Beweis: Zeuge …' },
      {
        id: 'schluss',
        label: 'Schluss',
        kind: 'prose',
        placeholder: 'Wir bitten um Termin zur mündlichen Verhandlung.',
      },
    ],
    aliases: {
      rubrum: 'rubrum_klaeger',
      kläger: 'rubrum_klaeger',
      klaeger: 'rubrum_klaeger',
      beklagter: 'rubrum_beklagter',
      beklagten: 'rubrum_beklagter',
      aktenzeichen: 'rubrum_az',
      az: 'rubrum_az',
      gericht: 'rubrum_gericht',
      antrag: 'antraege',
      anträge: 'antraege',
      antraege: 'antraege',
      sachverhalt: 'sachverhalt',
      tatbestand: 'sachverhalt',
      begründung: 'begruendung',
      begruendung: 'begruendung',
      würdigung: 'begruendung',
      wuerdigung: 'begruendung',
      beweise: 'beweise',
      beweis: 'beweise',
      beweisangebot: 'beweise',
      beweisangebote: 'beweise',
      schluss: 'schluss',
      schlussformel: 'schluss',
    },
  },
  brief: {
    id: 'brief',
    title: 'Mandantenbrief',
    sections: [
      {
        id: 'empfaenger',
        label: 'Empfänger',
        kind: 'meta',
        placeholder: 'Anschrift des Empfängers',
      },
      { id: 'datum', label: 'Datum', kind: 'meta', placeholder: 'z.B. 10.05.2026' },
      { id: 'unser_az', label: 'Unser AZ', kind: 'meta', placeholder: 'interne Aktennummer' },
      { id: 'betreff', label: 'Betreff', kind: 'meta', placeholder: 'Mandat / Bezugnahme' },
      { id: 'anrede', label: 'Anrede', kind: 'meta', placeholder: 'Sehr geehrte/r …' },
      { id: 'text', label: 'Text', kind: 'prose', placeholder: 'Fließtext des Schreibens' },
      { id: 'gruss', label: 'Grußformel', kind: 'meta', placeholder: 'Mit freundlichen Grüßen' },
    ],
    aliases: {
      empfänger: 'empfaenger',
      empfaenger: 'empfaenger',
      adresse: 'empfaenger',
      datum: 'datum',
      aktenzeichen: 'unser_az',
      az: 'unser_az',
      betreff: 'betreff',
      anrede: 'anrede',
      text: 'text',
      fließtext: 'text',
      fliesstext: 'text',
      grußformel: 'gruss',
      gruss: 'gruss',
    },
  },
  vermerk: {
    id: 'vermerk',
    title: 'Aktenvermerk',
    sections: [
      {
        id: 'datum',
        label: 'Datum / Uhrzeit',
        kind: 'meta',
        placeholder: 'z.B. 10.05.2026, 14:30',
      },
      {
        id: 'mandant',
        label: 'Mandant / AZ',
        kind: 'meta',
        placeholder: 'Mandantenname, Aktenzeichen',
      },
      {
        id: 'anlass',
        label: 'Anlass',
        kind: 'meta',
        placeholder: 'Telefonat / Besprechung / Recherche',
      },
      {
        id: 'inhalt',
        label: 'Inhalt',
        kind: 'prose',
        placeholder: 'Gesprächs- bzw. Vermerkinhalt …',
      },
      {
        id: 'ergebnis',
        label: 'Ergebnis / Maßnahmen',
        kind: 'prose',
        placeholder: 'Nächste Schritte, Fristen, Verantwortliche',
      },
    ],
    aliases: {
      datum: 'datum',
      mandant: 'mandant',
      aktenzeichen: 'mandant',
      az: 'mandant',
      anlass: 'anlass',
      inhalt: 'inhalt',
      gesprächsinhalt: 'inhalt',
      ergebnis: 'ergebnis',
      maßnahmen: 'ergebnis',
      massnahmen: 'ergebnis',
    },
  },
}

export function resolveSectionByAlias(templateId: TemplateId, rawTarget: string): string | null {
  const t = TEMPLATES[templateId]
  if (!t) return null
  const target = rawTarget.trim().toLowerCase()
  if (target in t.aliases) return t.aliases[target]
  const direct = t.sections.find(
    (s) => s.label.toLowerCase() === target || s.id.toLowerCase() === target,
  )
  return direct ? direct.id : null
}
