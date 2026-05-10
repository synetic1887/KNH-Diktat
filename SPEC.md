# SPEC.md — Funktionale Spezifikation

## Vision

Eine Web-App, in die Anwälte ihre Dokumente diktieren wie zu einer aufmerksamen Sekretärin. Die Sekretärin kennt die Standardvorlagen der Kanzlei, hört zu, sortiert das Gesagte in die richtigen Sektionen und formuliert auf Wunsch in juristischen Stil um. Korrekturen funktionieren in natürlicher Sprache („korrigiere den Namen am Anfang von Müller zu Meier"), ohne dass der Anwalt zur Tastatur greifen muss.

## Personen

**Anwalt** — Hauptnutzer. Diktiert Schriftsätze, Briefe, Vermerke. Klickt selten, spricht viel. Will nichts wissen über Tokens oder Modelle.

**Kanzleimitarbeiter** — Sekretariat. Pflegt Vorlagen, formatiert Dokumente nach, exportiert in das Kanzlei-DMS.

**Admin** — Partner oder IT. Verwaltet Nutzer, Vorlagen-Bibliothek, Mandantenstamm, prüft Audit-Log.

## Top-Use-Cases

### UC-1 — Schriftsatz diktieren

1. Anwalt öffnet die App, wählt Vorlage „Klage".
2. Klickt „Diktat starten" und beginnt: „Neue Klage für Mandant Müller gegen Schulze, Az. 12 O 345…"
3. Sagt „Springe zu Anträge", diktiert Anträge, dann „Springe zu Sachverhalt", diktiert Tatbestand.
4. Merkt einen Fehler im Antrag, sagt: „Korrigiere im Antrag den Betrag von 5.000 auf 7.500".
5. Sagt „Formuliere Sachverhalt" — KI poliert den Rohtext.
6. Sagt „Stopp", klickt „Export .docx", Dokument landet im Download-Ordner.

### UC-2 — Mandantenbrief

Wie UC-1, aber Vorlage „Brief", mit Empfänger-Adresse aus dem Mandantenstamm (Phase 4) und automatisch eingefügtem Briefkopf.

### UC-3 — Aktenvermerk nach Telefonat

Anwalt drückt Hotkey nach Telefonat, App öffnet leeren Vermerk mit Datum/Uhrzeit/Mandant vorausgefüllt. Anwalt diktiert kurz Inhalt und Maßnahmen.

### UC-4 — Vorlage anpassen (Admin)

Admin geht in „Vorlagen", erstellt neue Vorlage „Mahnung" mit Sektionen Empfänger, Forderungsdatum, Hauptforderung, Verzugskosten, Fristsetzung.

## Funktions-Inventar (Phase 1+2)

### Diktat

- Web Speech API, de-DE, continuous, interim results
- Pre-Flight Mikro-Check
- Visuelles Feedback: pulsierender Aufnahme-Indikator, Live-Interim-Text neben dem Cursor
- Auto-Pausierung bei Stille mit klarem Hinweis
- Robust gegen `aborted`/`no-speech` Errors (siehe Reference-MVP)

### Vorlagen (initial drei, erweiterbar)

- **Schriftsatz**: Rubrum (Kläger, Beklagter, AZ, Gericht), Anträge, Sachverhalt, Rechtliche Würdigung, Beweise, Schluss
- **Mandantenbrief**: Empfänger, Datum, Unser AZ, Betreff, Anrede, Text, Grußformel
- **Aktenvermerk**: Datum/Uhrzeit, Mandant/AZ, Anlass, Inhalt, Ergebnis/Maßnahmen

Datenmodell pro Vorlage: Liste benannter Sektionen mit `kind: "meta" | "prose"`, Aliases für Sprachbefehle.

### Sprachbefehle (im Diktat-Modus)

**Editing-Hilfen** (lokal, keine KI):

- `neuer absatz` / `absatz` → `\n\n`
- `neue zeile` → `\n`
- `punkt`, `komma`, `doppelpunkt`, `semikolon`, `fragezeichen`, `ausrufezeichen`, `anführungszeichen` → entsprechendes Zeichen

**Navigation**:

- `springe zu <sektion>` (mit Aliases: rubrum, antrag, sachverhalt, beweise, …)
- `nächste sektion` / `vorherige sektion`

**Korrekturen** (lokal):

- `ersetze X durch Y` (case-insensitive Treffer in aktiver Sektion)
- `lösche letztes wort` / `lösche letzten satz` / `lösche absatz`
- `rückgängig`

**KI** (Backend):

- `formulieren` → aktive Sektion wird durch KI in juristischen Stil überarbeitet
- Frei-Text-Anweisungen → Intent-Erkennung (siehe unten)

**Sonstige**:

- `vorlage schriftsatz` / `vorlage brief` / `vorlage vermerk` → wechselt Template (mit Bestätigung wenn nicht-leerer Inhalt vorhanden)
- `stopp` / `diktat beenden`

### KI-Korrektur (Intent-Erkennung)

Wenn der diktierte Satz mit Verben wie _korrigiere, ändere, streiche, ersetze, tausche, schreibe stattdessen, mache aus, anstelle von_ beginnt — oder Muster wie _„soll heißen"_ / _„nicht … sondern …"_ enthält — wird er **nicht** als Diktat-Inhalt eingefügt, sondern als Anweisung an die KI weitergeleitet.

**Backend-Endpunkt**: `POST /api/ai/edit`

- Request: `{ document: Section[], activeSectionId: string, instruction: string, templateId: string }`
- Response: `{ edits: Edit[], explanation: string }`
- `Edit = { sectionId: string, find: string, replace: string }` oder `{ sectionId: string, newText: string }`

Die KI bekommt einen System-Prompt der streng JSON nach Schema zurückliefert (siehe `reference/mvp.html` → `callAiEdit`).

### Formulieren

`POST /api/ai/formulate`

- Request: `{ sectionContent: string, sectionLabel: string, templateTitle: string }`
- Response: `{ formulated: string }`

System-Prompt: "Du bist juristischer Schreib-Assistent für deutsche Anwaltskanzlei. Bringe Rohtext in knappen, präzisen, sachlichen juristischen Stil. Bewahre Tatsachen und Zitate. Antworte nur mit dem überarbeiteten Text."

### Export

- `.docx` (initial): client-seitig per minimal-DOCX-Builder oder serverseitig per `docx`-Library
- `.pdf` (Phase 3): serverseitig per `pdfkit` oder `puppeteer`

### Auth (Phase 3)

- E-Mail + Passwort, Argon2-Hash
- Session-Cookies (HttpOnly, Secure, SameSite=strict)
- Rolle: `member` (Standard) oder `admin`
- Org-Konzept: jeder User gehört zu einer Kanzlei, sieht nur deren Vorlagen/Dokumente/Mandanten

### Mandantenstamm (Phase 4)

- Name, Anschrift, AZ-Präfix, Notizen
- Im Diktat: „neuer Schriftsatz für Mandant Müller" zieht automatisch Daten ins Rubrum

## Akzeptanzkriterien Phase 1 (Frontend ohne Backend)

- [ ] Vite-Setup mit TypeScript-strict, ESLint-clean, alle Tests grün.
- [ ] App startet mit `pnpm dev`, läuft auf `http://localhost:5173`.
- [ ] Drei Vorlagen klickbar, Sektionen werden korrekt gerendert.
- [ ] Diktat-Button startet Web Speech API, Live-Preview aktualisiert sich.
- [ ] Alle Sprachbefehle aus Liste oben funktionieren (lokal, ohne Backend).
- [ ] `formulieren` und Korrektur-Intent öffnen einen Modal mit Hinweis „Backend nicht konfiguriert" (statt Fehler).
- [ ] .docx-Export erzeugt valides Dokument (mit `unzip -l` + Word/LibreOffice geprüft).
- [ ] Pre-Flight zeigt klaren Hinweis bei `file://` und fehlender Mikro-Berechtigung.
- [ ] Mindestens 80% Test-Coverage auf Voice-Command-Parser.

## Akzeptanzkriterien Phase 2 (Backend mit KI)

- [ ] Hono-Backend läuft auf `:3000`, Health-Check OK.
- [ ] `POST /api/ai/formulate` und `/edit` funktionieren mit echtem Anthropic-Key.
- [ ] Frontend ruft Backend an, KI-Antworten landen korrekt im Dokument.
- [ ] Rate-Limit pro IP/User aktiv.
- [ ] Logger maskiert Mandatsdaten.
- [ ] Integrationstests gegen mock-Anthropic.

## Akzeptanzkriterien Phase 3 (Auth + Multi-User)

- [ ] Sign-up, Login, Logout funktionieren, Cookies sicher gesetzt.
- [ ] Org-Trennung: User-A der Org-X sieht keine Dokumente von User-B der Org-Y.
- [ ] Vorlagen-Bibliothek pro Org, Admin kann CRUD.
- [ ] Audit-Log schreibt jede Änderung mit User-ID + Timestamp.
- [ ] E2E-Test: Zwei Orgs, Daten-Isolation verifiziert.

## Out-of-Scope (zumindest fürs Erste)

- iOS/Android-App
- Direkte DMS-Integrationen (DATEV, RA-Micro, Advoware)
- Kalender/Fristenmanagement
- Offline-Modus
- Mehrsprachigkeit (UI initial nur Deutsch)
- Custom-LLM-Training auf Kanzlei-Daten
