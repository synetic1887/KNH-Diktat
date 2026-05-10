import type { AppDb } from '../../db/db'
import { auditLog } from '../../db/schema'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'ai-formulate'
  | 'ai-edit'
  | 'login'
  | 'logout'

export interface AuditEntry {
  readonly orgId: string
  readonly userId: string | null
  readonly action: AuditAction
  readonly targetType: string
  readonly targetId?: string | null
  readonly payload?: unknown
}

/** Schreibt einen Audit-Eintrag. Bewusst non-throwing — ein verlorener Audit-Eintrag darf den Request nicht killen. */
export async function logAudit(db: AppDb, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      orgId: entry.orgId,
      userId: entry.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      payloadJson: entry.payload === undefined ? null : JSON.stringify(entry.payload),
    })
  } catch {
    /* swallow — Audit-Failure soll nicht Request abbrechen, wird in Logs sichtbar. */
  }
}
