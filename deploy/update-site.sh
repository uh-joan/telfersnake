#!/usr/bin/env bash
# update-site.sh — replace the telfersnake.joans.cat vhost in the shared Caddyfile with the one in
# deploy/telfersnake.Caddyfile (enable-site.sh only adds it once). Run it after changing that block.
#
# The Caddyfile is a SINGLE-FILE bind mount into the caddy container: it is rewritten in place with
# `cat >` (never `sed -i` or `mv`, which swap the inode and leave Caddy reading the old file).
# Backed up first; if Caddy rejects the result the backup goes back and nothing is reloaded.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f deploy/deploy.env ] && . deploy/deploy.env
DEPLOY_HOST="${DEPLOY_HOST:?set DEPLOY_HOST — see deploy/deploy.env.example}"
DEPLOY_USER="${DEPLOY_USER:-root}"
BOX="${DEPLOY_USER}@${DEPLOY_HOST}"
SITE="telfersnake.joans.cat"
CADDYFILE="${CADDYFILE:?set CADDYFILE — see deploy/deploy.env.example}"
CADDY="${CADDY:?set CADDY — see deploy/deploy.env.example}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "→ fetching the shared Caddyfile…"
ssh "$BOX" "cat '$CADDYFILE'" > "$work/current"
grep -q "^${SITE} {" "$work/current" || { echo "✗ no ${SITE} block there yet: run deploy/enable-site.sh"; exit 1; }

# Our block: from the site line to the closing brace at the start of a line.
awk -v site="$SITE" '$0 == site " {" { on = 1 } on { print } on && $0 == "}" { exit }' \
  deploy/telfersnake.Caddyfile > "$work/block"
grep -q '^}$' "$work/block" || { echo "✗ could not find the ${SITE} block in deploy/telfersnake.Caddyfile"; exit 1; }

# Swap the live block for ours, leaving every other site exactly as it was.
awk -v site="$SITE" -v block="$work/block" '
  $0 == site " {" { while ((getline line < block) > 0) print line; skip = 1; next }
  skip && $0 == "}" { skip = 0; next }
  !skip { print }
' "$work/current" > "$work/next"

if cmp -s "$work/current" "$work/next"; then
  echo "✓ the live block already matches"
  exit 0
fi
diff -u "$work/current" "$work/next" | sed -n '1,80p' || true

echo "→ backing up and writing the new block…"
ssh "$BOX" "cp -p '$CADDYFILE' '${CADDYFILE}.before-update'"
ssh "$BOX" "cat > '$CADDYFILE'" < "$work/next"

echo "→ validating…"
if ! ssh "$BOX" "docker exec $CADDY caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile" >/dev/null 2>&1; then
  echo "✗ Caddy rejected the config: restoring the backup. Nothing was reloaded, the other sites are untouched."
  ssh "$BOX" "cat '${CADDYFILE}.before-update' > '$CADDYFILE'"
  exit 1
fi
echo "→ reloading Caddy (no downtime for the other sites on the box)…"
ssh "$BOX" "docker exec $CADDY caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile"

echo "→ checking /hd/…"
csp="$(curl -sI "https://${SITE}/hd/" | tr -d '\r' | grep -i '^content-security-policy:' || true)"
code="$(curl -s -o /dev/null -w '%{http_code}' "https://${SITE}/hd/" || true)"
if [[ "$code" == "200" && "$csp" == *wasm-unsafe-eval* ]]; then
  echo "✓ live — https://${SITE}/hd/"
else
  echo "… /hd/ answered ${code:-nothing}; CSP: ${csp:-none}. Deployed the build yet? (deploy/deploy.sh)"
fi
