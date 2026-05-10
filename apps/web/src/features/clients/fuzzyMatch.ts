import type { ServerClient } from './clientsClient'

/**
 * Levenshtein-Distanz, klassisch dynamisch programmiert.
 * Reicht für Mandantennamen (kurz, deutsche Phonetik macht hier wenig Sinn).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const m = a.length
  const n = b.length
  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

export interface FuzzyResult {
  readonly client: ServerClient
  readonly score: number
}

/**
 * Findet Mandanten zu einem Sprach-Query. Match in:
 *  - vollem Namen (höchste Priorität)
 *  - Anfangswort (z.B. „Mandant Müller" → token „Müller")
 *  - Aktenzeichen-Prefix
 *
 * Liefert max `limit` Treffer, sortiert nach Score (kleiner = besser).
 * `score === 0`: exakter Match nach Normalisierung.
 */
export function fuzzyFindClients(
  needle: string,
  haystack: readonly ServerClient[],
  limit = 5,
): FuzzyResult[] {
  const q = normalize(needle)
  if (!q) return []
  const results: FuzzyResult[] = []
  for (const c of haystack) {
    const candidates = [c.name, ...c.name.split(/\s+/), c.azPrefix ?? '']
      .map(normalize)
      .filter(Boolean)
    let best = Infinity
    for (const cand of candidates) {
      const d = levenshtein(q, cand)
      // bevorzugt: q in cand enthalten
      const containment = cand.includes(q) ? 0 : 1
      const score = d + containment
      if (score < best) best = score
    }
    if (Number.isFinite(best)) results.push({ client: c, score: best })
  }
  // Schwellwert: bis 3 Edits + Containment-Bonus
  return results
    .filter((r) => r.score <= 3)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
}
