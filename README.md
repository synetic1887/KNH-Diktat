# Kanzlei-Diktat

Sprachgesteuerte Dokumentenerstellung für Anwaltskanzleien mit KI-Formulierung und natürlich-sprachlicher Korrektur. Web-basiert, mehrbenutzerfähig, DSGVO-bewusst.

## Status

- [x] **Browser-MVP** als Single-File-HTML (siehe `reference/mvp.html`) — funktioniert und dient Claude Code als lebende Spezifikation
- [x] **Phase 1** — Sauberes React-Frontend mit gleichem Funktionsumfang (Diktat, Sprachbefehle, Vorlagen, Live-Preview, .docx-Export)
- [x] **Phase 2** — Hono-Backend mit Anthropic-Proxy + Rate-Limit + PII-Masking (Key bleibt serverseitig)
- [x] **Phase 3** — Mehrbenutzer-Auth (Argon2id, Session-Cookies), Org-Trennung, Templates/Documents-Persistenz, Audit-Log
- [x] **Phase 4 — Code** — Mandantenstamm + Voice-Fuzzy-Match, Application-Level-Encryption, GitHub-Actions, Hetzner-Setup-Script, Backup/Restore, DPIA-Template
- [ ] **Phase 4 — Server** — manuell: DNS, AVV mit Anthropic, Storage-Box, Restore-Drill auf echtem Server

Details in `ROADMAP.md`.

## Dev-Setup

```bash
# Einmalig
corepack enable
corepack prepare pnpm@9.12.0 --activate

# Im Projektroot
pnpm install
pnpm dev          # Frontend (5173) + API (3000) parallel
pnpm dev:web      # nur Frontend
pnpm dev:api      # nur API

# DB-Schema initialisieren (einmal lokal)
pnpm db:migrate

# Tests / Lint / Typecheck
pnpm test         # Web + API
pnpm lint
pnpm typecheck

# Build
pnpm build
```

Workspace-Struktur:

```
.
├── apps/
│   ├── web/         # React 18 + Vite + Tailwind + shadcn/ui
│   └── api/         # Hono + Drizzle + better-sqlite3 + Anthropic-SDK
├── packages/
│   └── shared/      # Geteilte TS-Typen Frontend ↔ Backend
├── deploy/          # Hetzner-Setup, GH-Actions-Deploy, Backup, DPIA-Template
├── .github/
│   └── workflows/   # ci.yml + deploy.yml
└── reference/
    └── mvp.html     # Funktionierender Single-File-MVP (nicht modifizieren)
```

## Test-Konten lokal

```bash
# 1. API starten (legt Default-Org + Seed-Templates an)
pnpm dev:api

# 2. Im zweiten Terminal Frontend starten
pnpm dev:web

# 3. Im Browser http://localhost:5173 öffnen, Konto registrieren
#    Erstes Konto pro Org bekommt automatisch Admin-Rolle.
```

Optional für Phase-2-Smoke ohne Login: API mit `KD_AI_OPEN=1` starten (öffnet `/api/ai/*` auch ohne Session — nur Dev).

## Voraussetzungen

```bash
# 1. Node 20+ und pnpm
brew install node pnpm        # macOS
# oder: https://nodejs.org

# 2. Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 3. Git
brew install git              # falls noch nicht vorhanden
```

## So fängst du an

```bash
# 1. Projekt klonen / kopieren
cd ~/code
cp -r /pfad/zum/kit kanzlei-diktat
cd kanzlei-diktat
git init && git add . && git commit -m "Setup-Kit"

# 2. Anthropic API-Key bereithalten
cp .env.example .env
# .env editieren: ANTHROPIC_API_KEY=sk-ant-...

# 3. Claude Code starten
claude

# 4. Im Claude-Code-Prompt Phase 1 starten:
#    Inhalt aus PROMPTS.md → "Prompt 1: Bootstrap" rein-pasten und Enter
```

## Was Claude Code beim Start liest

`claude` liest beim Start automatisch `CLAUDE.md` und kennt damit:

- Tech-Stack (festgelegt, keine Diskussion)
- Coding-Conventions
- Test-/Lint-/Build-Commands
- DSGVO-Regeln (z.B. "API-Key niemals client-seitig")
- Verweis auf `SPEC.md` und `reference/mvp.html`

Du musst Claude Code also kein 500-Wörter-Briefing geben — sag einfach "lies CLAUDE.md, dann arbeite Prompt 1 aus PROMPTS.md ab".

## Dateien im Kit

| Datei                | Zweck                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| `CLAUDE.md`          | Projekt-Regeln, Tech-Stack, Conventions — Claude Code liest das automatisch     |
| `SPEC.md`            | Was die App tut — Funktionen, Vorlagen, Sprachbefehle, KI-Verhalten             |
| `ARCHITECTURE.md`    | Tech-Entscheidungen mit Begründung                                              |
| `ROADMAP.md`         | Phasen mit Akzeptanzkriterien                                                   |
| `PROMPTS.md`         | Vorbereitete Prompts zum Reinkopieren in Claude Code                            |
| `.env.example`       | Vorlage für Umgebungsvariablen                                                  |
| `.gitignore`         | Standard für Node + Vite + Editor-Files                                         |
| `reference/mvp.html` | **Funktionierender MVP** — Claude Code studiert den Code und portiert die Logik |

## Tipps für die Arbeit mit Claude Code

- Pro Sitzung **eine Phase**, nicht mehrere — saubere Commits, klare Reviews.
- Nach jedem größeren Schritt: `git add -A && git commit -m "..."`. Claude Code kann das selbst machen, wenn du es bittest.
- Bei Fehlern: Logs reinkopieren, **nicht** "es funktioniert nicht" sagen.
- Wenn Claude Code sich verläuft: `/clear` und neu starten mit präziserem Prompt.
- Für längere Sessions: `claude --resume` setzt fort.

## DSGVO und Berufsrecht

Das ist **keine Rechtsberatung**, aber als Hinweis für eure interne Prüfung:

- API-Key gehört auf den Server, nie ins Frontend.
- Anthropic-Daten fließen aktuell über USA — vor produktivem Einsatz mit Mandatsdaten DPA mit Anthropic abschließen und Mandanten informieren oder auf EU-residentes Modell wechseln (Mistral, Aleph Alpha, selbst-gehostetes Llama).
- Audit-Log ab Phase 4: Wer hat wann welches Dokument bearbeitet?
- Mandatsdaten verschlüsselt at-rest (Postgres-Disk-Encryption + Application-Level-Encryption für besonders sensible Felder).

Siehe `ARCHITECTURE.md` § Datenschutz für die geplanten Maßnahmen.
