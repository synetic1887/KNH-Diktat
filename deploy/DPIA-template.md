# DPIA — Datenschutz-Folgenabschätzung (Template)

> Pflicht nach Art. 35 DSGVO bei umfangreicher Verarbeitung besonderer Datenkategorien.
> Mandatsdaten in einer Anwaltskanzlei = besonders schutzbedürftig (Berufsgeheimnis, § 203 StGB).
> **Dies ist kein juristisches Gutachten.** Vor produktivem Einsatz mit echten Mandatsdaten
> durch eine/n Datenschutzbeauftragte/n prüfen lassen.

## 1. Beschreibung der Verarbeitung

| Aspekt                 | Antwort                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Verantwortliche Stelle | Kanzlei XY, Anschrift                                              |
| Zweck                  | Sprachgesteuerte Erstellung anwaltlicher Dokumente                 |
| Rechtsgrundlage        | Art. 6 Abs. 1 lit. b (Vertragserfüllung Mandant), § 43a BRAO       |
| Datenkategorien        | Mandantennamen, Anschriften, Sachverhalte, AZ, Schriftsatz-Inhalte |
| Betroffene             | Mandanten, Gegenparteien, Zeugen, Dritte                           |
| Empfänger              | Anthropic Inc. (USA) für KI-Verarbeitung — siehe AVV unten         |
| Speicherdauer          | Bis Mandatsende + Aufbewahrungsfristen nach §§ 50 BRAO, 257 HGB    |
| Löschkonzept           | Auto-Delete X Jahre nach Mandatsabschluss; manueller Export vorher |

## 2. Notwendigkeit + Verhältnismäßigkeit

- **Erforderlich**: Sprachsteuerung beschleunigt Diktatworkflow signifikant; Tastatureingabe wäre Alternative.
- **Verhältnismäßigkeit**: Pseudonymisierung (Mandantenkürzel statt Klarnamen) als Eingabevariante anbieten.
- **Datenminimierung**: Nur die zur Formulierung relevanten Sektion-Inhalte werden an die KI gesandt — keine Mandantenliste, keine Logs.

## 3. Risiken für Betroffene

| Risiko                                         | Wahrscheinlichkeit | Schaden   | Maßnahmen                                            |
| ---------------------------------------------- | ------------------ | --------- | ---------------------------------------------------- |
| Datenleck via API-Provider                     | gering             | sehr hoch | AVV, Zero-Retention bei Anthropic, Pseudonymisierung |
| Unbefugter Zugang Server                       | gering             | hoch      | Firewall, fail2ban, SSH-Key-only, Audit-Log          |
| Fehlerhafte KI-Ausgabe → falsche Korrespondenz | mittel             | mittel    | Anwalt prüft jede Ausgabe vor Versand                |
| Verlust der Daten                              | gering             | hoch      | Tägliches Backup, Restore-Drill quartalsweise        |
| Querschnittsleak zwischen Org-Mandaten         | sehr gering        | hoch      | Org-Filter in jeder Query (Drizzle-Helper), Tests    |

## 4. Technische + Organisatorische Maßnahmen (TOM)

- **Verschlüsselung**:
  - Transport: TLS 1.3 (Caddy + Let's Encrypt)
  - At-Rest: Hetzner Volume Disk-Encryption (Standard)
  - Application: ChaCha20-Poly1305 für Mandanten-Kernfelder, per-Org-Key
- **Zugriff**:
  - Eigenkonten pro Anwalt (Argon2id, MFA optional)
  - Org-Trennung in jeder Query
- **Protokollierung**:
  - Audit-Log für alle Schreibvorgänge (User, Zeit, Aktion)
  - PII-Maskierung in Anwendungs-Logs (E-Mails redacted, lange Inhalte abgeschnitten)
- **Backup**:
  - Tägliches verschlüsseltes Backup nach Hetzner Storage Box (EU)
  - 30-Tage-Retention
- **Notfall**:
  - Restore-Drill quartalsweise dokumentiert
  - Datenschutzvorfall: Meldepflicht 72h an Aufsichtsbehörde (Art. 33 DSGVO)

## 5. Drittlandtransfer (Anthropic)

- Anthropic Inc. ist US-Unternehmen.
- Aktuell: Standardvertragsklauseln (SCC) + EU-US Data Privacy Framework
- Vor Produktiveinsatz: AVV mit Anthropic abschließen (`https://www.anthropic.com/legal/dpa`)
- Alternative für höchste Sensibilität: lokales LLM (Mistral, Aleph Alpha, Llama selbst gehostet)

## 6. Ergebnis

- [ ] Restrisiko **akzeptabel**
- [ ] Konsultation der Aufsichtsbehörde nicht erforderlich
- [ ] Datenschutzbeauftragte/r involviert: Name, Datum
- [ ] Mandanten werden in Mandatsvereinbarung über KI-Einsatz informiert

---

Erstellt: ****\_\_\_\_****
Geprüft: ****\_\_\_\_****
Nächste Überprüfung: jährlich oder bei wesentlicher Änderung
