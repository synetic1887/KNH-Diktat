#!/usr/bin/env bash
# Deploy aus GitHub Actions: Build-Artefakte rsyncen, neuen Release-Ordner anlegen,
# Symlink umsetzen, Service neu starten — zero-downtime via Caddy + systemd-Reload.
#
# Erwartete ENVs:
#   DEPLOY_HOST  — z.B. server.example.de
#   DEPLOY_USER  — z.B. kdiktat
# Optional:
#   APP_DIR      — Default /opt/kanzlei-diktat
#   KEEP_RELEASES — wie viele alte Releases behalten (Default 5)

set -euo pipefail

: "${DEPLOY_HOST:?Setze DEPLOY_HOST}"
: "${DEPLOY_USER:?Setze DEPLOY_USER}"
APP_DIR="${APP_DIR:-/opt/kanzlei-diktat}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

RELEASE="$(date -u +%Y%m%d%H%M%S)"
REMOTE_RELEASE="${APP_DIR}/releases/${RELEASE}"

echo "==> Übertrage Build (${RELEASE})"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p ${REMOTE_RELEASE}/apps/web/dist ${REMOTE_RELEASE}/apps/api"

rsync -az --delete apps/web/dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_RELEASE}/apps/web/dist/"

# API: kompiliertes JS + node_modules deployen — wir nehmen den TS-Source via tsx im Service.
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.tsbuildinfo' \
  apps/api/src/ "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_RELEASE}/apps/api/src/"
rsync -az apps/api/package.json apps/api/tsconfig.json \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_RELEASE}/apps/api/"
rsync -az packages/shared/ "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_RELEASE}/packages/shared/"
rsync -az pnpm-workspace.yaml package.json pnpm-lock.yaml \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_RELEASE}/"

echo "==> Install Production-Dependencies auf Server"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${REMOTE_RELEASE} && pnpm install --frozen-lockfile --prod=false"

echo "==> Symlink umstellen"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "ln -sfn ${REMOTE_RELEASE} ${APP_DIR}/current"

echo "==> Migration"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${APP_DIR}/current && pnpm --filter api db:migrate"

echo "==> systemd-Reload + Caddy-Reload (zero-downtime)"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "sudo systemctl restart kanzlei-diktat.service && sudo systemctl reload caddy"

echo "==> Health-Check"
sleep 2
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "curl -fsS http://127.0.0.1:3000/api/health"

echo "==> Alte Releases bereinigen (behalte ${KEEP_RELEASES})"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "
  cd ${APP_DIR}/releases &&
  ls -1t | tail -n +$((KEEP_RELEASES+1)) | xargs -r rm -rf
"

echo "✓ Deploy ${RELEASE} abgeschlossen."
