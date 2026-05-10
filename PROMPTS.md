# PROMPTS.md — Vorbereitete Prompts für Claude Code

Eine Sitzung pro Phase. Vor jedem Prompt: prüfen ob die vorherige Phase laut `ROADMAP.md` "Definition of Done" erfüllt — andernfalls erst nacharbeiten.

So benutzt du diese Datei: kompletten Block zwischen den horizontalen Linien kopieren und in das Claude-Code-Terminal einfügen, dann Enter.

---

## Prompt 0 — Kennenlernen

```
Lies die Dateien CLAUDE.md, SPEC.md, ARCHITECTURE.md und ROADMAP.md in diesem Repository. Schau dir auch reference/mvp.html oberflächlich an — das ist der funktionierende Prototyp, dessen Logik wir portieren.

Beantworte mir dann in unter 200 Wörtern:
1. Was bauen wir genau, in deinen eigenen Worten?
2. Welche zwei Dinge in der Spec hältst du für die größten technischen Risiken?
3. Welche Frage hättest du am liebsten beantwortet, bevor du Phase 1 anfängst?

Schreibe noch keinen Code.
```

---

## Prompt 1 — Phase 1 Bootstrap

```
Initialisiere Phase 1 laut ROADMAP.md. Beachte CLAUDE.md strikt — Tech-Stack ist festgelegt.

Konkrete Schritte:
1. Lege pnpm-Workspace an mit `apps/web` und `packages/shared`. apps/api kommt erst in Phase 2.
2. Scaffolde apps/web mit Vite + React + TypeScript-strict.
3. Konfiguriere Tailwind und shadcn/ui (Theme: warmes Off-White Background, Bordeaux #7a1f1f als Akzent — wie im reference/mvp.html).
4. Richte ESLint + Prettier ein (Configs im Root, in apps/web nur Extends).
5. Husky + lint-staged für pre-commit.
6. Vitest aufsetzen, ein Smoke-Test der vorbeigeht.
7. Erste Routes: `/` (Diktat-Seite, leer), `/settings` (leer).
8. Ein Zustand-Store-Skelett mit `currentDocument`, `recordingStatus`.
9. README im Root erweitern um Dev-Setup-Sektion.

Akzeptanzkriterium für diesen Prompt: `pnpm install && pnpm dev` zeigt eine leere App, `pnpm test` ist grün, `pnpm lint` clean, alle Files sind committet in einem klaren git-history.

Wenn du Entscheidungen treffen musst, die nicht in den Docs stehen: triff sie pragmatisch und dokumentiere sie kurz im jeweiligen README. Komm zurück mit einer Zusammenfassung was du angelegt hast.
```

---

## Prompt 2 — Phase 1 Diktat-Feature portieren

```
Phase 1 Bootstrap ist fertig. Jetzt portieren wir die Diktat-Logik aus reference/mvp.html.

Schritte:
1. Lege apps/web/src/features/dictation/ an mit:
   - useDictation.ts — React-Hook, der Web Speech API kapselt. Übernimm die robusten Patterns aus dem MVP: preflight (file://-Check + getUserMedia), Generation-Counter zum Invalidieren alter Handler, 400ms-Cooldown beim Auto-Restart, Doppelklick-Schutz, fatale vs. weiche Fehler unterscheiden, ERR_HINTS auf Deutsch.
   - voiceCommands.ts — reine Funktion `parseCommand(raw: string, ctx): CommandResult`. Ports alle Commands aus tryCommand() im MVP außer KI-Aufrufen. Strenge TypeScript-Typen, getrennt nach Command-Kategorie (Punctuation, Navigation, Edit, Template).
   - DictationButton.tsx — Aufnahme-Toggle mit pulsierendem Indikator.
   - DictationDiagnostics.tsx — die "Mikro testen" und "Diagnose"-Buttons aus dem MVP.
2. voiceCommands.ts bekommt eine erschöpfende Vitest-Suite (>= 80% Coverage). Nimm als Test-Cases die Beispiele aus SPEC.md.
3. useDictation.ts bekommt einen Test mit gemockter SpeechRecognition.

Akzeptanz: in Chrome auf http://localhost:5173 startet das Diktat, alle nicht-KI-Sprachbefehle aus SPEC.md "Sprachbefehle" funktionieren, Tests grün.

Schau dir vor dem Schreiben zuerst tryCommand() und startRecognition() im MVP an. Halte dich an deren Logik, aber bringe sie in saubere TS-Strukturen.
```

---

## Prompt 3 — Phase 1 Document-Modell, Vorlagen, Live-Preview

```
Diktat-Hook steht. Jetzt das Dokumenten-Modell und die Live-Preview.

Schritte:
1. apps/web/src/features/document/:
   - templates.ts — die drei Vorlagen aus SPEC.md (Schriftsatz, Brief, Vermerk) mit allen Sektionen, Aliases. Strenge Typen, exportiert als const.
   - documentSlice.ts (Zustand) — `setActiveSection`, `appendToActive`, `replaceInActive`, `deleteLastWord/Sentence/Paragraph`, `undo`, `setTemplate` (mit Bestätigungs-Hook bei nicht-leerem Inhalt), `loadDocument`, `getDocument`. Snapshot-Stack für Undo (max 50).
   - DocumentPreview.tsx — formatiert, mit aktiver Sektion farblich hervorgehoben (Bordeaux-Soft-Background), Klick auf Sektion ruft setActiveSection.
   - aiCommands.ts — Helper, der Korrektur-Intents erkennt (gleiche Regex wie isAiEditIntent im MVP). Vorerst mit Stub-Funktion `requestAIEdit()`, die nur einen Toast zeigt: "Backend nicht konfiguriert".
2. Verbinde DictationButton + DocumentPreview auf der `/`-Route.
3. parseCommand() ruft die documentSlice-Actions korrekt auf — keine direkten Store-Mutationen aus dem Hook.
4. Tests:
   - templates.ts: Snapshot des Vorlagen-Modells.
   - documentSlice.ts: Reducer-Tests für alle Actions, Undo-Stack.
   - DocumentPreview: render-Test mit verschiedenen Vorlagen.

Akzeptanz: ich kann diktieren, alle drei Vorlagen wechseln, alle Sprachbefehle aus SPEC funktionieren end-to-end im Browser. Tests grün.
```

---

## Prompt 4 — Phase 1 .docx-Export

```
Document-Modell + Preview stehen. Jetzt der Export.

Schritte:
1. apps/web/src/features/document/export.ts — portiere makeZip + escapeXml + die Document-XML-Generierung aus dem MVP. Saubere TS-Strukturen, keine globalen Variablen.
2. Vitest-Test, der ein .docx erzeugt und mit "fflate" o.ä. wieder entpackt, dann den XML-Inhalt prüft (mind. Vorlagentitel, alle Sektion-Labels, alle Inhalte). Achtung: das ist der wichtigste Test, weil ein kaputtes .docx Word zum Crash bringt.
3. ExportButton-Component, eingebunden in die Toolbar.

Optional, wenn Zeit: zweiter Test, der LibreOffice (falls vorhanden) per CLI das File öffnet und in PDF konvertiert. CI-Skip wenn lo nicht installiert.

Akzeptanz: Export erzeugt eine valide .docx, die in MS Word und LibreOffice ohne Reparaturhinweis öffnet. Tests grün.

Phase 1 ist damit fertig — markiere alle Akzeptanzkriterien aus ROADMAP.md ab und committe einen Tag `phase-1-done`.
```

---

## Prompt 5 — Phase 2 Backend Bootstrap

```
Phase 1 ist getaggt phase-1-done und alle Akzeptanzkriterien sind erfüllt. Phase 2 baut das Backend.

Schritte:
1. apps/api/ als pnpm-Package mit Hono, TypeScript-strict, dotenv, pino, vitest.
2. Drizzle-ORM mit better-sqlite3, SQLite-Datei `data/app.db` (Pfad aus env überschreibbar). Migrations-Setup mit drizzle-kit.
3. Tabellen für diese Phase: `requests_log` (für Rate-Limit + Debug). User-Tabellen kommen erst in Phase 3.
4. Routes-Skelett:
   - GET /api/health — gibt {status:"ok", version} zurück
   - POST /api/ai/formulate — Zod-validierter Input/Output, vorerst Echo-Stub
   - POST /api/ai/edit — Zod-validierter Input/Output, vorerst Echo-Stub
5. CORS-Middleware, lockerer in Dev (localhost:5173), strikter in Prod.
6. Pino-Logger mit Custom-Serializer, der bestimmte Felder maskiert (Inhalte > 60 Zeichen, alles was wie E-Mail aussieht).
7. Skript pnpm dev im Root, das parallel apps/web und apps/api startet (mit `concurrently` oder turbo).

Tests:
- Unit: Zod-Schemas
- Integration: Hono-Test-Client gegen Health- und Stub-Routes

Akzeptanz: pnpm dev startet beides, curl auf /api/health gibt 200, Frontend kann zumindest auf /api/health pingen.
```

---

## Prompt 6 — Phase 2 Anthropic-Provider

```
Backend-Skelett steht. Jetzt die echte Anthropic-Anbindung.

Schritte:
1. apps/api/src/lib/ai/AIProvider.ts — Interface mit zwei Methoden: formulate, edit.
2. AnthropicProvider.ts — Implementierung mit @anthropic-ai/sdk. Lese ANTHROPIC_API_KEY aus env. Modell aus env (Default: claude-sonnet-4-6).
3. Übernimm die System-Prompts aus reference/mvp.html (callAI für formulate, callAiEdit für edit). Edit-Prompt fordert striktes JSON-Schema mit edits und explanation.
4. Robustes JSON-Parsing für edit: Markdown-Fences strippen, JSON-Block extrahieren, Zod-validieren. Bei Parse-Fehler: 502 mit klarem error.code.
5. Anthropic-Provider verdrahten in /api/ai/formulate und /api/ai/edit, Stubs entfernen.
6. Rate-Limit-Middleware (Token-Bucket): pro IP 30/Minute, pro IP+Endpoint 10/Minute. Bei Limit: 429 mit Retry-After.
7. Frontend-AIClient (apps/web/src/features/ai/aiClient.ts) ruft die echten Endpunkte auf, der Stub-Toast wird ersetzt.
8. UI: ein "KI denkt"-Indikator (siehe MVP), Fehler-Toasts mit verständlichen Texten.

Tests:
- Unit: AnthropicProvider mit gemocktem SDK, JSON-Parsing-Robustheit (verschiedene fehlerhafte Antworten).
- Integration: Hono-Routes mit Mock-Provider (kein echter API-Call in CI).
- Manuell: einen Schriftsatz mit echtem Key durchspielen, formulieren + 3 freie Korrekturen.

Akzeptanz: end-to-end mit echtem Key funktioniert. Logs zeigen keine Mandantendaten im Klartext. Rate-Limit greifbar mit kleinem Skript.
```

---

## Prompt 7 — Phase 3 Auth (gestaffelt)

```
Phase 2 grün, getaggt phase-2-done.

Wir bauen Auth in zwei Schritten:
A) Schema, Backend-Routes, einfacher Frontend-Login. KEIN Multi-Org noch.
B) Org-Konzept, Templates/Documents-Persistenz, Audit-Log.

Mach erst nur A:
1. Drizzle-Schema: orgs (eine fest "Default-Org" via Seed), users, sessions.
2. Backend: /auth/signup (Argon2id, Cookie), /auth/login, /auth/logout, /auth/me. Sessions in DB.
3. Frontend: Login-Page (/login), ProtectedRoute, useAuth-Hook, Auto-Redirect bei 401.
4. Tests: Hono-Routes (signup, login, falsches Passwort, /me ohne Cookie).

Akzeptanz A: ich kann mich registrieren, anmelden, abmelden. /api/ai/* erfordern jetzt Auth.

Wenn A grün: melde dich, dann Prompt 8 für B.
```

---

## Prompt 8 — Phase 3 Multi-Org, Templates & Documents persistieren

```
Auth-A ist fertig. Jetzt Org-Konzept und Persistenz.

Schritte:
1. orgs.id-FK in users, templates, documents, audit_log. Sessions kennen org_id.
2. Drizzle-Helper `withOrg(orgId)`, der jede Query automatisch filtert. Pflicht in jeder Domain-Route.
3. Templates-CRUD: GET /templates, POST/PUT/DELETE (Admin only). Default-Templates per Seed pro neuer Org.
4. Documents-CRUD: GET /documents (List), GET /documents/:id, POST (create), PUT (update — Sektionen-JSON), DELETE.
5. Audit-Log-Schreibschicht: jeder Schreibvorgang erzeugt audit_log-Eintrag mit user_id, action, target_type/id, payload (Diff oder Snapshot).
6. Frontend:
   - Templates-Editor (/admin/templates), nur für role='admin'.
   - Documents-Liste auf /, "Neu"-Button öffnet Vorlagen-Wahl.
   - Auto-Save alle 5s (debounced) bei Änderungen.
   - Dokument-Titel oben editierbar.
7. E2E-Test mit Playwright: zwei Orgs (Seed), zwei Browser-Sessions, gegenseitige Daten-Isolation verifiziert.

Akzeptanz: zwei Anwälte verschiedener Orgs sehen sich nicht. Audit-Log zeigt korrekte Aktionen. Phase-3-Akzeptanz aus ROADMAP komplett.
```

---

## Prompt 9 — Phase 4 Mandantenstamm

```
Phase 3 grün. Jetzt der Mandantenstamm + smarter Diktat-Workflow.

Schritte:
1. clients-Tabelle: id, org_id, name, address, az_prefix, notes, created_at.
2. Sekretariats-UI (/admin/clients) für CRUD.
3. Diktat-Erweiterung: Sprachbefehl "neuer Schriftsatz für Mandant <Name>" — Frontend sucht in eigener Org (Fuzzy-Match), bietet Auswahl bei Mehrdeutigkeit, füllt Rubrum-Felder aus.
4. AI-Edit-Endpoint kennt jetzt auch clients (read-only-Snapshot im Prompt-Kontext, optional), damit "ändere Adresse oben auf die aktuelle Adresse von Müller" funktioniert.
5. Tests: Fuzzy-Match-Algorithmus, Sicherheit dass keine Cross-Org-Treffer entstehen.

Akzeptanz: ich kann per Sprache einen Mandanten ins Rubrum holen, KI kann auf Mandantendaten zugreifen, aber nur innerhalb der eigenen Org.
```

---

## Prompt 10 — Phase 4 Hardening + Deployment

```
Mandantenstamm ist drin. Jetzt produktionsreif machen.

Schritte:
1. Application-Level-Encryption: libsodium-secretbox für Felder document.sections_json (oder gezielt sensible Felder), Per-Org-Master-Key in env (zukünftig KMS).
2. Migration SQLite → Postgres: drizzle-kit generate für Postgres, separate Drizzle-Config, Test-Migration.
3. Hetzner CX22 Setup-Script (deploy/setup.sh): user anlegen, Caddy installieren, systemd-Unit, fail2ban.
4. Deployment-Pipeline: GitHub Actions, lint+test+build, dann SSH-Deploy mit zero-downtime via reload.
5. Backup-Script: täglicher pg_dump nach Hetzner Storage Box, 30 Tage Retention.
6. Restore-Drill: dokumentiere und führe einmal durch.
7. Monitoring: einfacher Status-Check via Uptime-Kuma oder Health-Endpoint-Pingdown.
8. DSGVO-Doku: DPIA-Template, Datenschutzerklärung, AVV-Checkliste mit Anthropic.

Akzeptanz: Live unter eigener Domain, TLS gültig, Backup-Restore erfolgreich getestet, drei reale Anwälte testen 1 Woche Datenstand.
```

---

## Tipps für die Sitzung

- Vor jeder neuen Phase: `git status` muss clean sein, vorheriger Phase-Tag gesetzt.
- Wenn Claude Code abbricht: `claude --resume` setzt fort.
- Bei großen Diffs: `claude --review` für Code-Review-Modus.
- Bei merkwürdigem Verhalten: `/clear` und Prompt erneut, oft hilft das.
- Fragen-Pingpong: Claude Code stellt Fragen — beantworte sie konkret, dann läuft der Build sauber durch.

Viel Erfolg.
