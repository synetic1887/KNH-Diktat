#!/usr/bin/env bash
# Hetzner CX22 Erstinstallation. Auf dem Server als root einmalig ausführen.
# Voraussetzung: Ubuntu 24.04 LTS, frischer Server, DNS zeigt auf die Server-IP.
#
# Nutzung:
#   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/deploy/setup.sh | DOMAIN=kanzlei-diktat.example.de sudo -E bash
# oder lokal nach dem Klonen:
#   sudo DOMAIN=kanzlei-diktat.example.de bash deploy/setup.sh

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bitte als root oder mit sudo ausführen." >&2
  exit 1
fi
: "${DOMAIN:?Setze DOMAIN=…}"

APP_USER="kdiktat"
APP_DIR="/opt/kanzlei-diktat"
NODE_VERSION="20"

echo "==> System-Update + Basics"
apt-get update -y
apt-get install -y \
  ca-certificates curl git ufw fail2ban unattended-upgrades \
  build-essential pkg-config libssl-dev sqlite3

echo "==> Node ${NODE_VERSION} via NodeSource"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@9.12.0 --activate

echo "==> App-User"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "${APP_USER}"
fi
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> Caddy als Reverse-Proxy + automatisches TLS"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

cat >/etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "microphone=(self)"
    }
    @api path /api/*
    handle @api {
        reverse_proxy 127.0.0.1:3000
    }
    handle {
        root * ${APP_DIR}/current/apps/web/dist
        try_files {path} /index.html
        file_server
    }
}
EOF
systemctl enable --now caddy
systemctl reload caddy || true

echo "==> systemd-Unit für API"
cat >/etc/systemd/system/kanzlei-diktat.service <<EOF
[Unit]
Description=Kanzlei-Diktat API
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/current/apps/api
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node --enable-source-maps src/index.js
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/data
ProtectHome=true
PrivateTmp=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
mkdir -p "${APP_DIR}/data"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/data"

# Default-ENV — der Operator muss ${APP_DIR}/.env mit Werten füllen.
if [[ ! -f "${APP_DIR}/.env" ]]; then
  cat >"${APP_DIR}/.env" <<'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/opt/kanzlei-diktat/data/app.db
ANTHROPIC_API_KEY=__BITTE_SETZEN__
ANTHROPIC_MODEL=claude-sonnet-4-6
CORS_ORIGINS_PROD=https://__BITTE_DOMAIN_SETZEN__
KD_ENCRYPTION_KEYS=org-default:__64HEX_DURCH_node-e_ersetzen__
EOF
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  echo "WARN: ${APP_DIR}/.env mit Defaults erstellt — bitte editieren!"
fi
systemctl daemon-reload
systemctl enable kanzlei-diktat.service

echo "==> Firewall (UFW)"
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo "==> fail2ban — sshd-Filter ist Default"
systemctl enable --now fail2ban

echo "==> Unattended-Upgrades"
dpkg-reconfigure --priority=low unattended-upgrades || true

echo
echo "Setup fertig. Nächste Schritte:"
echo "  1. ${APP_DIR}/.env editieren (Anthropic-Key, Domain, KD_ENCRYPTION_KEYS)"
echo "  2. SSH-Key des Deploy-Users (kdiktat) zu deinem GitHub-Secret DEPLOY_SSH_KEY hinzufügen"
echo "  3. Erste Deploy-Pipeline anstoßen (push tag v0.1.0 oder Workflow_dispatch)"
