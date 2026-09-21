#!/usr/bin/env bash
# enable-site.sh — ONE TIME: add the telfersnake.joans.cat vhost to the shared Caddy on the box.
# Safe to run again: it does nothing if the vhost is already there.
#
# It refuses to run until DNS points at the box, because Caddy asks Let's Encrypt for the
# certificate straight away and failed attempts are rate limited.
#
# The Caddyfile is a SINGLE-FILE bind mount into the caddy container: it must be edited in place
# (append with >>, never `sed -i`, which swaps the inode and leaves Caddy reading the old file).
set -euo pipefail
cd "$(dirname "$0")/.."

# Real host/paths live in deploy/deploy.env (gitignored) so they never reach the repo.
[ -f deploy/deploy.env ] && . deploy/deploy.env
DEPLOY_HOST="${DEPLOY_HOST:?set DEPLOY_HOST — see deploy/deploy.env.example}"
DEPLOY_USER="${DEPLOY_USER:-root}"
BOX="${DEPLOY_USER}@${DEPLOY_HOST}"
SITE="telfersnake.joans.cat"
CADDYFILE="${CADDYFILE:?set CADDYFILE — see deploy/deploy.env.example}"
CADDY="${CADDY:?set CADDY — see deploy/deploy.env.example}"

resolved="$(dig +short "$SITE" @1.1.1.1 | tail -1)"
if [[ "$resolved" != "$DEPLOY_HOST" ]]; then
  echo "✗ $SITE resolves to '${resolved:-nothing}', not $DEPLOY_HOST."
  echo "  Add this A record at your DNS host, wait a few minutes, and run me again:"
  echo "      A   telfersnake   $DEPLOY_HOST"
  exit 1
fi

if ssh "$BOX" "grep -q '^${SITE} {' '$CADDYFILE'"; then
  echo "✓ vhost already present"
else
  echo "→ backing up the Caddyfile and appending the vhost…"
  ssh "$BOX" "cp -p '$CADDYFILE' '${CADDYFILE}.before-telfersnake'"
  { echo; cat deploy/telfersnake.Caddyfile; } | ssh "$BOX" "cat >> '$CADDYFILE'"
fi

echo "→ validating…"
if ! ssh "$BOX" "docker exec $CADDY caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile" >/dev/null 2>&1; then
  echo "✗ Caddy rejected the config: restoring the backup. Nothing was reloaded, the other sites are untouched."
  ssh "$BOX" "cat '${CADDYFILE}.before-telfersnake' > '$CADDYFILE'"
  exit 1
fi
echo "→ reloading Caddy (no downtime for the other sites on the box)…"
ssh "$BOX" "docker exec $CADDY caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile"

echo "→ waiting for the certificate…"
for _ in $(seq 1 15); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "https://${SITE}/healthz" || true)"
  [[ "$code" == "200" ]] && break
  sleep 4
done
[[ "$code" == "200" ]] && echo "✓ live — https://${SITE}" || echo "… not answering yet (last status: ${code:-none}). Check: ssh $BOX docker logs --tail 50 $CADDY"
