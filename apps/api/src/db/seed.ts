import { eq } from 'drizzle-orm'

import type { AppDb } from './db'
import { orgs, templates } from './schema'
import { newId } from '../lib/security/ids'

const DEFAULT_ORG_ID = 'org-default'

const SEED_TEMPLATES = [
  {
    slug: 'schriftsatz',
    title: 'Schriftsatz',
    sections: [
      { id: 'rubrum_klaeger', label: 'Kläger', kind: 'meta' },
      { id: 'rubrum_beklagter', label: 'Beklagter', kind: 'meta' },
      { id: 'rubrum_az', label: 'Aktenzeichen', kind: 'meta' },
      { id: 'rubrum_gericht', label: 'Gericht', kind: 'meta' },
      { id: 'antraege', label: 'Anträge', kind: 'prose' },
      { id: 'sachverhalt', label: 'Sachverhalt', kind: 'prose' },
      { id: 'begruendung', label: 'Rechtliche Würdigung', kind: 'prose' },
      { id: 'beweise', label: 'Beweisangebote', kind: 'prose' },
      { id: 'schluss', label: 'Schluss', kind: 'prose' },
    ],
  },
  {
    slug: 'brief',
    title: 'Mandantenbrief',
    sections: [
      { id: 'empfaenger', label: 'Empfänger', kind: 'meta' },
      { id: 'datum', label: 'Datum', kind: 'meta' },
      { id: 'unser_az', label: 'Unser AZ', kind: 'meta' },
      { id: 'betreff', label: 'Betreff', kind: 'meta' },
      { id: 'anrede', label: 'Anrede', kind: 'meta' },
      { id: 'text', label: 'Text', kind: 'prose' },
      { id: 'gruss', label: 'Grußformel', kind: 'meta' },
    ],
  },
  {
    slug: 'vermerk',
    title: 'Aktenvermerk',
    sections: [
      { id: 'datum', label: 'Datum / Uhrzeit', kind: 'meta' },
      { id: 'mandant', label: 'Mandant / AZ', kind: 'meta' },
      { id: 'anlass', label: 'Anlass', kind: 'meta' },
      { id: 'inhalt', label: 'Inhalt', kind: 'prose' },
      { id: 'ergebnis', label: 'Ergebnis / Maßnahmen', kind: 'prose' },
    ],
  },
] as const

/** Erstellt Default-Org + Default-Templates, idempotent. */
export async function ensureSeed(db: AppDb): Promise<{ defaultOrgId: string }> {
  const existing = await db.select().from(orgs).where(eq(orgs.id, DEFAULT_ORG_ID)).limit(1)
  if (existing.length === 0) {
    await db.insert(orgs).values({ id: DEFAULT_ORG_ID, name: 'Default-Org' })
  }
  for (const t of SEED_TEMPLATES) {
    const has = await db
      .select({ id: templates.id })
      .from(templates)
      .where(eq(templates.slug, t.slug))
      .limit(1)
    if (has.length === 0) {
      await db.insert(templates).values({
        id: newId(),
        orgId: DEFAULT_ORG_ID,
        slug: t.slug,
        title: t.title,
        sectionsJson: JSON.stringify(t.sections),
      })
    }
  }
  return { defaultOrgId: DEFAULT_ORG_ID }
}

export { DEFAULT_ORG_ID }
