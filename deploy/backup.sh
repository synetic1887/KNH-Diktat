#!/usr/bin/env bash
# Tägliches Backup auf Hetzner Storage Box. Lege als systemd-Timer oder cron an:
#
#   crontab -u kdiktat -e
#   0 3 * * * /opt/kanzlei-diktat/current/deploy/backup.sh >> /var/log/kanzlei-diktat-backup.log 2>&1
#
# Voraussetzung in /opt/kanzlei-diktat/.env:
#   STORAGE_HOST   — z.B. uXXXXX.your-storagebox.de
#   STORAGE_USER   — z.B. uXXXXX
#   STORAGE_DIR    — z.B. backups/kanzlei-diktat
#   BACKUP_RETENTION_DAYS  — Default 30

set -euo pipefail

# Lade ENV
APP_DIR="${APP_DIR:-/opt/kanzlei-diktat}"
if [[ -f "${APP_DIR}/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "${APP_DIR}/.env" | xargs)
fi

: "${STORAGE_HOST:?Setze STORAGE_HOST in .env}"
: "${STORAGE_USER:?Setze STORAGE_USER in .env}"
STORAGE_DIR="${STORAGE_DIR:-backups/kanzlei-diktat}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"

DB_PATH="${APP_DIR}/data/app.db"
TS="$(date -u +%Y%m%d-%H%M%S)"
TMP="/tmp/kdiktat-backup-${TS}"
mkdir -p "${TMP}"

echo "==> Backup ${TS}"

# SQLite konsistenter Snapshot via .backup-Befehl (online, ohne Locks).
sqlite3 "${DB_PATH}" ".backup '${TMP}/app.db'"

# Tarball mit DB + .env (Achtung: .env enthält Secrets — auf Storage Box ist das tolerierbar,
# aber DENK an verschlüsselte Storage Box oder vorher GPG, wenn du paranoid bist).
tar -czf "${TMP}/snapshot.tar.gz" -C "${APP_DIR}" data .env

# Auf Storage Box hochladen via scp
scp -p -o StrictHostKeyChecking=accept-new \
  "${TMP}/snapshot.tar.gz" \
  "${STORAGE_USER}@${STORAGE_HOST}:${STORAGE_DIR}/snapshot-${TS}.tar.gz"

# Lokale Tmp-Files löschen
rm -rf "${TMP}"

# Retention auf Remote
ssh -o StrictHostKeyChecking=accept-new "${STORAGE_USER}@${STORAGE_HOST}" \
  "find ${STORAGE_DIR} -name 'snapshot-*.tar.gz' -mtime +${RETENTION} -delete" || true

echo "✓ Backup hochgeladen, Retention ${RETENTION} Tage angewandt."
