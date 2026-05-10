# ARCHITECTURE.md

Kompakte Begründung der wichtigsten Tech-Entscheidungen. Ergänzt `CLAUDE.md`, das den Stack auflistet.

## Topologie

```
            ┌────────────────┐                ┌────────────────┐
Browser ──▶ │  Vite/React    │ ── HTTPS ───▶  │  Hono Backend  │
            │  apps/web      │                │  apps/api      │
            └────────────────┘                └────────┬───────┘
                                                       │
                                  ┌────────────────────┼────────────────────┐
                                  ▼                    ▼                    ▼
                          ┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐
                          │  SQLite      │   │  Anthropic API   │   │  Object Storage │
                          │  (Phase 1-3) │   │  (Claude Sonnet) │   │  (Phase 4)      │
                          │  → Postgres  │   └──────────────────┘   └─────────────────┘
                          │  (Phase 4)   │
                          └──────────────┘
```

Die Web Speech API läuft **im Browser** beim Anwalt, kein Audio fließt zum Server. Nur fertige Texte gehen ans Backend.

## Frontend-Wahl

**React + Vite** statt Next.js: Wir brauchen kein SSR, kein Routing-Magic, kein Image-Optimization-Pipeline. Vite ist schneller im Dev-Mode und der Stack hat weniger Overhead. Wenn später ein Marketing-Site dazukommt, baut man die separat.

**Tailwind + shadcn/ui** statt Material/Chakra: shadcn-Components sind keine Library, sondern Code, den man committet — komplett anpassbar und ohne Bundle-Bloat. Tailwind passt zur shadcn-Philosophie und wird von Claude Code besonders gut beherrscht.

**Zustand** statt Redux: Globaler State ist hier minimal (aktuelles Dokument, Recording-Status, Auth-User). Zustand reicht und ist ohne Boilerplate.

**TanStack Query** für Backend-State: Caching, Refetching, Optimistic Updates — sauber abgegrenzt vom UI-State.

## Backend-Wahl

**Hono** statt Express/Fastify: Modernste API, native TypeScript, Web-Standards-Request/Response, läuft auch in Edge-Runtimes (falls wir später migrieren wollen). Routing-Middleware-System ist klarer als Express-Middleware-Ketten.

**Better-SQLite3** initial: Synchrones API, atemberaubend schnell, eine Datei. Solo-Anwalt oder Kleinkanzlei-Deployment ohne separaten DB-Server möglich. Migrationsweg zu Postgres ist mit Drizzle trivial — Schema bleibt identisch.

**Drizzle** statt Prisma: Schema in TypeScript, keine Code-Gen-Pipeline, kein eigener Query-Layer. Type-Safety ohne Magic.

**Zod** an allen Grenzen: jedes API-Endpoint hat ein Zod-Schema für Request-Body und Response. Damit ist die OpenAPI-Doku quasi automatisch (über `hono-openapi` oder `zod-to-openapi`).

## KI-Integration

**Anthropic SDK serverseitig**: API-Key liegt in `.env` auf dem Server. Frontend ruft nur `/api/ai/*`-Endpoints. Dadurch lässt sich Rate-Limit, Logging-mit-Maskierung und Fallback-Strategien zentral umsetzen.

**Strukturierte Outputs**: Für `/api/ai/edit` zwingen wir Claude per System-Prompt in JSON-Schema (siehe Reference-MVP). Robust gegen Markdown-Fences, Vor- und Nachreden.

**Abstraktions-Layer**: `AIProvider`-Interface mit `formulate(...)` und `edit(...)`. Erste Implementierung Anthropic, Tests gegen Mock. Spätere Migration auf Mistral oder selbst-gehostetes Modell ändert nur die Implementierung.

```ts
interface AIProvider {
  formulate(input: FormulateInput): Promise<FormulateOutput>
  edit(input: EditInput): Promise<EditOutput>
}
```

## Datenmodell (Drizzle, Auszug Phase 3)

```ts
orgs           ( id, name, created_at )
users          ( id, org_id, email, password_hash, role, created_at )
templates      ( id, org_id, slug, title, sections_json, created_by, updated_at )
documents      ( id, org_id, template_id, title, sections_json, created_by, updated_at )
audit_log      ( id, org_id, user_id, action, target_type, target_id, payload, created_at )
clients        ( id, org_id, name, address, az_prefix, notes, created_at )   -- Phase 4
```

`sections_json` speichert das Dokument-Snapshot als JSONB. Versionierung über `audit_log` mit `payload` = Diff. Vermeidet komplexes Schema, behält Flexibilität für neue Sektions-Typen.

## Auth-Strategie

Phase 3: Klassisch. Sessions in DB-Tabelle, Cookie mit `__Host-`-Präfix, HttpOnly, Secure, SameSite=Strict. Argon2id für Passwort-Hashing. Magic-Link als 2FA-Alternative später optional.

Kein OAuth/Social-Login initial — Kanzleien wollen lokale Konten kontrollieren.

## Deployment (Phase 4)

**Hetzner Cloud (CX22 in Falkenstein/Nürnberg)**: ~5€/Monat, EU-DSGVO-konform, AVV abrufbar.

Stack auf der Maschine:

- Caddy für TLS + Reverse-Proxy
- Node-Backend als systemd-Service
- SQLite-Datei mit täglichem Backup nach Hetzner Storage Box
- Migrationspfad zu Postgres über Drizzle-Migrate, sobald >5 Anwälte gleichzeitig schreiben

CI/CD über GitHub Actions: lint+test+build → SSH-Deploy. Erst-Setup manuell, später automatisierbar.

## Datenschutz-Maßnahmen (Stufenweise)

| Phase | Maßnahme                                                               |
| ----- | ---------------------------------------------------------------------- |
| 1     | API-Key-Hinweis im Browser-MVP, kein produktiver Einsatz               |
| 2     | Key serverseitig in `.env`, nie im Frontend                            |
| 2     | Rate-Limit pro IP/User auf KI-Routen                                   |
| 2     | PII-Masking-Logger (Pino mit Custom-Serializer)                        |
| 3     | Audit-Log für alle Schreiboperationen                                  |
| 3     | Org-Mandantentrennung in jeder Query (Drizzle-Helper)                  |
| 4     | Disk-Encryption auf Hetzner-Volume                                     |
| 4     | Application-Level-Encryption sensibler Felder (libsodium, per-Org-Key) |
| 4     | DPIA (Datenschutz-Folgenabschätzung) abgeschlossen, AVV mit Anthropic  |
| 4     | Backup-Restore-Drill dokumentiert                                      |

## Performance-Targets

- Erste Renderzeit der Diktat-Seite: < 1s auf 4G
- Final-Recognition-Result bis Anzeige im Preview: < 200ms
- KI-Formulieren-Round-Trip: < 4s (95% mit Claude Sonnet)
- KI-Edit-Round-Trip: < 3s (95%)
- Bundle-Size Frontend: < 250 kB gzipped initial, Routes lazy-loaded

## Test-Strategie

- **Unit (Vitest)**: Voice-Command-Parser, Edit-Anwender, Reducer, Zod-Schemas. Ziel ≥ 80%.
- **Integration (Vitest + msw)**: Frontend-Components mit gemocktem Backend.
- **API (Vitest + Hono-Test-Client)**: Backend-Routes, Auth-Flow, Rate-Limit.
- **E2E (Playwright, ab Phase 3)**: Login → Dokument anlegen → diktieren (mocked) → exportieren.
- **Manuell**: Echtes Diktat in Chrome, Edge, mind. einmal pro Phase.
