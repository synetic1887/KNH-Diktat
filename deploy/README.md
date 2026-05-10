# Deployment auf Hetzner Cloud

Skripte für eine Production-Installation auf einer Hetzner CX22 (Falkenstein/Nürnberg, EU).

## Topologie

```
Browser ──► Caddy (TLS, statisches Frontend, Reverse-Proxy) ──► Node API (3000) ──► SQLite
```

- **TLS** via Caddy mit Let's-Encrypt-Auto-Issue
- **Frontend** (`apps/web/dist/`) wird direkt aus Caddy ausgeliefert
- **API** läuft als systemd-Unit unter dem User `kdiktat`
- **Backups** täglich nach Hetzner Storage Box

## Erstinstallation auf dem Server

```bash
ssh root@<server-ip>
DOMAIN=kanzlei-diktat.example.de bash deploy/setup.sh
```

Das Skript ist idempotent. Danach:

1. `/opt/kanzlei-diktat/.env` ausfüllen — siehe Vorlage in der Datei
2. Encryption-Key generieren: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` und in `KD_ENCRYPTION_KEYS=org-default:<HEX>` einsetzen
3. SSH-Key des Deploy-Users (`kdiktat`) in GitHub-Secrets `DEPLOY_SSH_KEY` hinterlegen
4. `DEPLOY_HOST` und `DEPLOY_USER` (`kdiktat`) als GitHub-Secrets setzen
5. Erste Pipeline anstoßen: Tag `v0.1.0` pushen oder GitHub-Actions → Deploy → Run workflow

## CI/CD

- **CI** (.github/workflows/ci.yml) läuft auf jedem PR + push: lint + typecheck + test + build
- **Deploy** (.github/workflows/deploy.yml) läuft per Tag oder manuell: build + rsync + symlink + service-restart

## Backup + Restore

Backup als cron unter `kdiktat`:

```cron
0 3 * * * /opt/kanzlei-diktat/current/deploy/backup.sh >> /var/log/kanzlei-diktat-backup.log 2>&1
```

Restore-Drill:

```bash
# Auf neuem Server (oder zur Übung auf Staging):
scp <storage-host>:backups/kanzlei-diktat/snapshot-LATEST.tar.gz /tmp/restore/
sudo deploy/restore.sh snapshot-LATEST.tar.gz
```

Mindestens **einmal pro Quartal** durchführen und im Audit-Log dokumentieren.

## Was nicht hier liegt

Diese Skripte sind die Grundlage. Manuell zu erledigen:

- DNS-A-Record auf die Server-IP
- DNS-AAAA-Record (IPv6) wenn nötig
- AVV mit Anthropic abschließen, vor Produktiveinsatz mit echten Mandatsdaten
- Datenschutzerklärung an Domain hängen
- DPIA (Datenschutz-Folgenabschätzung) durchführen — Template: `deploy/DPIA-template.md`
- Storage-Box bei Hetzner buchen, Public-Key des Servers hinterlegen
