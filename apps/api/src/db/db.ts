import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

import * as schema from './schema'

export type AppDb = BetterSQLite3Database<typeof schema>

export interface DbHandle {
  readonly db: AppDb
  readonly raw: Database.Database
  readonly close: () => void
}

function resolveDbPath(url: string): string {
  if (url === ':memory:') return ':memory:'
  const stripped = url.replace(/^file:/, '')
  return path.isAbsolute(stripped) ? stripped : path.resolve(process.cwd(), stripped)
}

export function openDb(databaseUrl: string): DbHandle {
  const filePath = resolveDbPath(databaseUrl)
  if (filePath !== ':memory:') {
    const dir = path.dirname(filePath)
    fs.mkdirSync(dir, { recursive: true })
  }
  const raw = new Database(filePath)
  raw.pragma('journal_mode = WAL')
  raw.pragma('foreign_keys = ON')
  const db = drizzle(raw, { schema })
  return { db, raw, close: () => raw.close() }
}

/** Erzeugt das Schema in einer leeren DB. Reicht für Phase 1-3 ohne Migration-Files. */
export function applySchema(raw: Database.Database): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS requests_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      ip TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      user_id TEXT,
      org_id TEXT
    );
    CREATE INDEX IF NOT EXISTS requests_log_ip_ts ON requests_log(ip, ts);
    CREATE INDEX IF NOT EXISTS requests_log_path_ts ON requests_log(path, ts);

    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      created_by TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE(org_id, slug)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      template_id TEXT,
      title TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      created_by TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS documents_org_updated ON documents(org_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      payload_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS audit_log_org_created ON audit_log(org_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      name TEXT NOT NULL,
      address TEXT,
      az_prefix TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS clients_org_name ON clients(org_id, name);
  `)
}
