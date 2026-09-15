#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   npm run deploy:vps
# Optional env vars:
#   DEPLOY_DIR=/var/www/iceberg-web
#   OWNER=www-data:www-data
#   MODE=755
#   USE_SUDO=1

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/iceberg-web}"
OWNER="${OWNER:-www-data:www-data}"
MODE="${MODE:-755}"
USE_SUDO="${USE_SUDO:-1}"

if [[ ! -f "package.json" ]]; then
  echo "package.json not found. Run this script from web project root."
  exit 1
fi

if [[ "${USE_SUDO}" == "1" ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

echo "==> Building web app..."
npm run build

if [[ ! -d "dist" ]]; then
  echo "dist directory was not created."
  exit 1
fi

echo "==> Syncing dist to ${DEPLOY_DIR}..."
${SUDO} mkdir -p "${DEPLOY_DIR}"
${SUDO} rsync -av --delete "dist/" "${DEPLOY_DIR}/"

echo "==> Setting ownership and permissions..."
${SUDO} chown -R "${OWNER}" "${DEPLOY_DIR}"
${SUDO} chmod -R "${MODE}" "${DEPLOY_DIR}"

echo "==> Deploy finished."
