#!/usr/bin/env bash
# deploy.sh — build Telfersnake and (re)start it on the box that runs your shared Caddy.
#
# Usage:   deploy/deploy.sh
# Config:  put your box's details in deploy/deploy.env (gitignored; copy deploy/deploy.env.example).
#          DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH, CADDY_NET.
#
# First time only, after DNS points at the box:  deploy/enable-site.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Real host/network live in deploy/deploy.env (gitignored) so they never reach the repo.
[ -f deploy/deploy.env ] && . deploy/deploy.env
DEPLOY_HOST="${DEPLOY_HOST:?set DEPLOY_HOST — see deploy/deploy.env.example}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/telfersnake}"
CADDY_NET="${CADDY_NET:?set CADDY_NET — see deploy/deploy.env.example}"
BOX="${DEPLOY_USER}@${DEPLOY_HOST}"

echo "→ building the game and the server…"
npm run build

echo "→ copying to ${BOX}:${DEPLOY_PATH}…"
ssh "$BOX" "mkdir -p '${DEPLOY_PATH}'"
rsync -az --delete --include='/dist/***' --include='/dist-server/***' --include='/deploy/***' \
  --include='/Dockerfile' --include='/.dockerignore' --exclude='*' ./ "${BOX}:${DEPLOY_PATH}/"

echo "→ rebuilding and restarting the container…"
ssh "$BOX" "cd '${DEPLOY_PATH}' && CADDY_NET='${CADDY_NET}' docker compose -f deploy/compose.yml up -d --build && docker image prune -f >/dev/null"

echo "→ waiting for it to report healthy…"
for _ in $(seq 1 20); do
  state="$(ssh "$BOX" "docker inspect -f '{{.State.Health.Status}}' telfersnake" 2>/dev/null || true)"
  [[ "$state" == "healthy" ]] && break
  sleep 2
done
echo "  container: ${state:-unknown}"
ssh "$BOX" "docker exec telfersnake wget -qO- http://127.0.0.1:8787/healthz" && echo
[[ "$state" == "healthy" ]] || { echo "✗ not healthy: ssh $BOX docker logs telfersnake"; exit 1; }
echo "✓ deployed — https://telfersnake.joans.cat  (anyone playing was dropped to the results screen)"
