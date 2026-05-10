#!/usr/bin/env bash
# Stellt ein Backup-Snapshot wieder her. Auf dem Server ausführen.
#
# Nutzung:
#   sudo deploy/restore.sh snapshot-20260510-030000.tar.gz
#
# Erwartet, dass das Snapshot bereits unter /tmp/restore/ liegt
# (z.B. via scp vom Storage-Box-Host).

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bitte als root oder mit sudo ausführen." >&2
  exit 1
fi

SNAPSHOT="${1:-}"
if [[ -z "${SNAPSHOT}" ]]; then
  echo "Nutzung: $0 <snapshot-NNN.tar.gz>" >&2
  exit 1
fi
APP_DIR="${APP_DIR:-/opt/kanzlei-diktat}"
APP_USER="${APP_USER:-kdiktat}"

if [[ ! -f "/tmp/restore/${SNAPSHOT}" ]]; then
  echo "Snapshot fehlt: /tmp/restore/${SNAPSHOT}" >&2
  exit 1
fi

echo "==> Stoppe Service"
systemctl stop kanzlei-diktat.service || true

echo "==> Sichere aktuellen Stand"
mv "${APP_DIR}/data" "${APP_DIR}/data.before-restore-$(date -u +%Y%m%d%H%M%S)" || true
mv "${APP_DIR}/.env" "${APP_DIR}/.env.before-restore-$(date -u +%Y%m%d%H%M%S)" || true

echo "==> Entpacken"
mkdir -p "${APP_DIR}/data"
tar -xzf "/tmp/restore/${SNAPSHOT}" -C "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/data" "${APP_DIR}/.env"
chmod 600 "${APP_DIR}/.env"

echo "==> Migration auf wiederhergestellter DB"
sudo -u "${APP_USER}" bash -c "cd ${APP_DIR}/current && pnpm --filter api db:migrate"

echo "==> Starte Service"
systemctl start kanzlei-diktat.service
sleep 2
curl -fsS http://127.0.0.1:3000/api/health

echo "✓ Restore abgeschlossen."
