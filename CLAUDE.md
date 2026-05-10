# CLAUDE.md — Projektregeln für Claude Code

Diese Datei liest Claude Code beim Start automatisch. Sie definiert verbindlich, **wie** in diesem Projekt gearbeitet wird. Inhaltliche Spec steht in `SPEC.md`, Phasenplan in `ROADMAP.md`.

## Was wir bauen

Web-App für deutsche Anwaltskanzleien zur sprachgesteuerten Dokumentenerstellung mit KI-Unterstützung. Mehrbenutzerfähig, dreigeteilte Architektur (Frontend, Backend, Datenbank). Funktional vollständig spezifiziert in `SPEC.md`. Lebende Referenz: `reference/mvp.html` — ein funktionierender Single-File-Prototyp, dessen Logik portiert und sauber strukturiert wird.

## Tech-Stack — entschieden, nicht diskutieren

**Frontend** (`apps/web`):

- React 18 + TypeScript (strict mode)
- Vite als Build-Tool
- Tailwind CSS + shadcn/ui für Components
- Zustand für State-Management (kein Redux)
- TanStack Query für Server-State
- React Router v6 für Routing

**Backend** (`apps/api`):

- Node 20 + TypeScript
- Hono als Web-Framework (nicht Express, nicht Fastify)
- Better-SQLite3 für DB (Migration zu Postgres erst in Phase 4)
- Drizzle ORM
- Zod für Schema-Validierung an allen API-Grenzen
- @anthropic-ai/sdk für KI-Calls

**Shared** (`packages/shared`):

- TypeScript-Typen, die Frontend und Backend teilen
- Zod-Schemas für Request/Response

**Tooling**:

- pnpm Workspaces (kein npm, kein yarn)
- ESLint + Prettier — Configs liegen im Root, nicht pro Package duplizieren
- Vitest für Unit-Tests, Playwright für E2E ab Phase 3
- Husky + lint-staged für pre-commit

**Was wir NICHT verwenden**:

- Next.js (Overhead unnötig, kein SSR-Bedarf)
- Express (Hono ist moderner)
- Prisma (Drizzle ist schneller, weniger Magic)
- Material UI / Chakra (shadcn ist Standard)
- Redux / MobX
- jQuery, Bootstrap, Lodash

## Projektstruktur

```
kanzlei-diktat/
├── apps/
│   ├── web/              # React-Frontend
│   │   ├── src/
│   │   │   ├── components/     # shadcn + eigene UI-Komponenten
│   │   │   ├── features/       # Feature-orientierte Module (dictation/, document/, ai/)
│   │   │   ├── lib/            # Helpers, API-Client
│   │   │   ├── routes/         # Page-Components
│   │   │   └── App.tsx
│   │   └── ...
│   └── api/              # Hono-Backend
│       ├── src/
│       │   ├── routes/         # /ai, /documents, /auth, /templates
│       │   ├── db/             # Drizzle schema + migrations
│       │   ├── lib/
│       │   └── index.ts
│       └── ...
├── packages/
│   └── shared/           # Geteilte Types + Schemas
├── reference/            # MVP zum Studieren — nicht modifizieren
└── ...
```

Feature-Ordner enthalten alles für ein Feature: Components, Hooks, Logic, Tests. Keine künstliche Aufteilung in `components/`, `hooks/`, `utils/` Top-Level.

## Coding-Standards

- **TypeScript strict** — `any` nur mit Begründung im Kommentar.
- **Funktionale Komponenten** mit Hooks. Keine Class Components.
- **Named exports** bevorzugen, default nur für Page-Routes.
- **Imports**: absolut über `@/` (alias auf `src/`), keine `../../../`-Ketten.
- **Validierung**: jede HTTP-Boundary (Frontend → Backend, Backend → DB) durch Zod.
- **Fehlerbehandlung**: `Result<T, E>`-Pattern oder explizite try/catch mit getypten Errors. Niemals stille Fehler.
- **Kommentare**: nur wenn das _Warum_ nicht aus dem Code hervorgeht. Kein `// increment counter`.
- **Dateinamen**: `kebab-case.tsx` für Components, `camelCase.ts` für Module ohne JSX.
- **CSS**: ausschließlich Tailwind-Utility-Classes oder shadcn-Tokens. Kein eigenes CSS-Modules.

## Commands

| Was          | Wo       | Befehl                         |
| ------------ | -------- | ------------------------------ |
| Install      | Root     | `pnpm install`                 |
| Dev (alles)  | Root     | `pnpm dev`                     |
| Dev Frontend | apps/web | `pnpm --filter web dev`        |
| Dev Backend  | apps/api | `pnpm --filter api dev`        |
| Lint         | Root     | `pnpm lint`                    |
| Format       | Root     | `pnpm format`                  |
| Test         | Root     | `pnpm test`                    |
| Build        | Root     | `pnpm build`                   |
| DB-Migrate   | apps/api | `pnpm --filter api db:migrate` |

Vor dem Commit immer `pnpm lint && pnpm test`. Husky macht das automatisch.

## DSGVO / Berufsrecht — harte Regeln

Diese Regeln sind nicht verhandelbar:

1. **API-Keys** (Anthropic, etc.) gehören in `.env` auf dem Backend. **Niemals** ins Frontend, auch nicht in localStorage.
2. **Mandatsdaten** werden niemals in Logs/Telemetrie/Crash-Reports gesendet. Logger müssen PII-Felder maskieren.
3. **Kein** automatisches Senden von Mandatsdaten an externe Services außer dem konfigurierten KI-Provider.
4. **Audit-Trail**: ab Phase 3 protokolliert das Backend Wer/Wann/Was bei jeder Schreiboperation auf Dokumenten.
5. **Verschlüsselung**: ab Phase 4 sind besonders sensible Felder (Mandantenname, Sachverhalt) application-level mit per-Org-Key verschlüsselt at-rest.
6. **Sessions**: HttpOnly-SameSite-Strict-Cookies, kein Token in localStorage.
7. **CORS**: Backend akzeptiert nur konfigurierte Origins, kein `*`.
8. **Rate-Limit**: Auf KI-Routen pro User, damit ein gestohlener Token nicht das Konto leerräumt.

## Was Claude Code tun und nicht tun soll

**Bitte:**

- Studiere `reference/mvp.html` bevor du Features implementierst — die Logik ist dort schon erprobt (Sprachbefehl-Parser, Voice-Command-Erkennung, JSON-Edit-Schema).
- Schreibe Tests für nicht-triviale Logik (Voice-Command-Parser, AI-Edit-Anwender, Reducer).
- Halte Commits klein und benenne sie sprechend (`feat(dictation): add voice command parser`).
- Frage zurück, wenn `SPEC.md` mehrdeutig ist — nicht erfinden.

**Bitte nicht:**

- Eigenmächtig Dependencies hinzufügen, die nicht im Stack stehen. Bei Bedarf vorher fragen.
- Bestehende Architekturentscheidungen umwerfen ("ich finde Express besser") — siehe Tech-Stack.
- TypeScript-Errors mit `// @ts-ignore` unterdrücken.
- Tests skippen mit `.skip` ohne Issue-Verweis.
- Den Inhalt von `reference/` modifizieren.

## Reference-MVP

`reference/mvp.html` ist eine ~1000-Zeilen Single-File-HTML-App, die das Konzept beweist:

- Web Speech API für Diktat (de-DE, continuous, interim results)
- Drei Vorlagen: Schriftsatz, Mandantenbrief, Aktenvermerk
- Sprachbefehle: "neuer absatz", "springe zu rubrum", "ersetze X durch Y", "lösche letzten satz", "rückgängig", "formulieren", "vorlage schriftsatz/brief/vermerk", "stopp"
- KI-Korrektur-Intent-Erkennung ("korrigiere", "ändere", "streiche", "schreibe stattdessen")
- AI-Edit-API: Backend bekommt Dokument als JSON + Anweisung, gibt strukturierte Edits zurück
- .docx-Export via in-Browser ZIP-Builder
- Pre-Flight Mikrofon-Check, robuste Auto-Restart-Logik

Wenn unklar wie ein Feature funktionieren soll: erst dort schauen.

## Wenn du nicht weiterkommst

Nicht raten. Schreib in den Terminal-Output:

> **Frage an Manuel:** [konkrete Frage mit Optionen]

Dann warte auf Antwort.
