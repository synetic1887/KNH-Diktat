# ROADMAP.md

Vier Phasen, jede mit klaren Akzeptanzkriterien. Nicht Phase 2 anfangen, bevor Phase 1 grün ist.

---

## Phase 1 — Frontend portieren (Woche 1)

**Ziel:** Den Reference-MVP in einen sauberen Vite-React-TypeScript-Codebase überführen, ohne Funktionalität zu verlieren. Noch kein Backend, KI-Calls liefern Stub-Antworten.

**Aufgaben:**

1. Workspace-Setup mit pnpm, Vite, TypeScript-strict, ESLint, Prettier, Vitest, Husky.
2. Tailwind + shadcn/ui einrichten, Basis-Tokens (Bordeaux-Akzent wie im MVP).
3. Routing: `/` (Diktat) und `/settings` (KI-Konfig).
4. State: Zustand-Store für `currentDocument`, `recordingStatus`, `aiBusy`.
5. Module portieren:
   - `features/dictation/` — Web Speech API Wrapper als Hook (`useDictation`), inkl. Pre-Flight + Auto-Restart-Härtung.
   - `features/dictation/voiceCommands.ts` — Parser-Logik aus MVP, mit Vitest-Suite.
   - `features/document/` — Vorlagen-Definition, Document-Reducer, Live-Preview-Component.
   - `features/document/export.ts` — DOCX-Builder portiert, Tests gegen entpacktes ZIP.
   - `features/ai/` — `AIClient`-Interface (vorerst Stub-Implementierung).
6. Settings-Seite mit Provider-Wahl (vorerst nur Anzeige).
7. README erweitern um Dev-Setup-Schritte.

**Definition of Done:**

- `pnpm dev` startet App auf `:5173`, alle drei Vorlagen klickbar.
- `pnpm test` grün, ≥80% Coverage auf `voiceCommands.ts` und `export.ts`.
- `pnpm lint` clean, kein `any` ohne Begründung.
- Diktat-Test in Chrome erfolgreich (Pre-Flight, mind. ein Schriftsatz mit allen Sprachbefehlen).
- Commit-History sauber: kleine, sprechende Commits.

---

## Phase 2 — Backend mit Anthropic-Proxy (Woche 2)

**Ziel:** KI-Calls über ein eigenes Backend, Anthropic-Key ausschließlich serverseitig.

**Aufgaben:**

1. `apps/api/` mit Hono, TypeScript, dotenv, pino-Logger.
2. Drizzle + better-sqlite3 Setup, erste Tabelle `requests_log` (für Rate-Limit + Audit).
3. Endpunkte:
   - `GET /api/health`
   - `POST /api/ai/formulate` (Schema: `{ sectionContent, sectionLabel, templateTitle }`)
   - `POST /api/ai/edit` (Schema: `{ document, activeSectionId, instruction, templateId }`)
4. `AIProvider`-Interface, Anthropic-Implementierung mit `@anthropic-ai/sdk`.
5. Strikte Zod-Validierung an Request- und Response-Boundary.
6. Rate-Limit-Middleware (Token-Bucket pro IP).
7. PII-Maskierung im Logger (E-Mails, längere Texte gekürzt).
8. CORS auf `localhost:5173` und konfigurierbare Production-Origin.
9. Frontend-`AIClient` schwenkt vom Stub auf echten Backend-Aufruf um.
10. Tests:
    - Unit: `AIProvider`-Mock, JSON-Parsing-Robustheit (Markdown-Fences, leere Edits, unbekannte Section-IDs).
    - Integration: Hono-Test-Client gegen mock-Anthropic.

**Definition of Done:**

- `pnpm dev` startet Frontend und Backend parallel.
- `formulieren` und freie KI-Korrektur funktionieren end-to-end mit echtem Key.
- Rate-Limit ausgelöst → klarer Fehlerstatus + Toast im Frontend.
- Logger zeigt nur maskierte Inhalte, kein Mandantenname im Log.
- Manuell durchgespielter Schriftsatz mit drei freien Korrekturen, alle erfolgreich angewendet.

---

## Phase 3 — Multi-User, Auth, Vorlagen-Bibliothek (Woche 3-4)

**Ziel:** Mehrere Anwälte einer Kanzlei können sich anmelden, eigene Dokumente bearbeiten, gemeinsame Vorlagen nutzen.

**Aufgaben:**

1. Schema-Erweiterung: `orgs`, `users`, `sessions`, `templates`, `documents`, `audit_log`.
2. Auth-Routes: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/me`. Argon2id, Cookies.
3. Org-Concept: User gehört zu Org, jede Query filtert nach `org_id` (Drizzle-Helper).
4. Frontend-Auth: Login-Page, ProtectedRoute-Wrapper, Auth-Store, Auto-Logout bei 401.
5. Templates-CRUD im Frontend (Admin-only): Liste, Editor (Sektionen hinzufügen/entfernen, Aliases), Speichern.
6. Documents persistieren: List, Open, Save (Auto-Save), Delete.
7. Audit-Log-Schreibschicht: jeder Document-Change erzeugt Eintrag.
8. Audit-Log-View für Admins.
9. E2E-Test mit Playwright: zwei Orgs, Daten-Isolation verifiziert.

**Definition of Done:**

- Zwei Browser-Sessions, zwei verschiedene Orgs, keiner sieht den anderen.
- Admin kann Vorlagen anlegen/bearbeiten, Member nicht.
- Audit-Log zeigt korrekte User-Aktionen.
- E2E-Test grün.
- Pen-Test-light: kein User kann mit gefakter `org_id` fremde Daten lesen.

---

## Phase 4 — Mandantenstamm, Hardening, Deployment (Woche 5-6)

**Ziel:** Produktionsreif für eine Kanzlei.

**Aufgaben:**

1. `clients`-Tabelle + CRUD-UI im Sekretariats-Bereich.
2. Im Diktat: „neuer Schriftsatz für Mandant XY" zieht Daten ins Rubrum.
3. Migration SQLite → Postgres mit Drizzle-Migrate.
4. Application-Level-Encryption für sensible Felder (libsodium-secretbox, Per-Org-Master-Key in KMS oder env).
5. Deployment auf Hetzner CX22:
   - Caddy + systemd-Service
   - Daily-Backup-Script nach Hetzner Storage Box
   - Restore-Drill dokumentiert
6. CI: GitHub Actions mit lint+test+build, dann SSH-Deploy.
7. Status-Page-light (Uptime-Pingdown).
8. DPIA-Template ausgefüllt, AVV mit Anthropic abgeschlossen, Datenschutzerklärung formuliert.

**Definition of Done:**

- Live unter eigener Domain mit gültigem TLS.
- Mandantenstamm in Diktat-Workflow eingebunden.
- Backup wiederhergestellt aus Snapshot, Daten konsistent.
- DSGVO-Doku komplett.
- Mindestens drei reale Anwälte testen 1 Woche, kein Daten-Verlust, kein KI-Fehlverhalten.

---

## Bewusst zurückgestellt (Phase 5+)

- iOS/Android-Diktat (PWA als Zwischenschritt)
- DATEV/RA-Micro/Advoware-Schnittstellen
- Custom-Whisper auf eigenem Server statt Web-Speech-API (für bessere de-DE-Erkennung mit Fachvokabular)
- Fristen-/Termin-Verwaltung
- KI-gestützter Tatbestand-Generator aus Klägervorbringen
- Verschwende keine Energie darauf, bevor Phase 4 echt im Einsatz ist.
