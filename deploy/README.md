# Deploying Telfersnake → https://telfersnake.joans.cat

One container on a box that already runs a shared Caddy. The container is a single Node process
that serves the built game **and** runs the playgrounds (WebSocket at `/play`). The only thing it
keeps is **anonymous aggregate counts** — how many games are played, how far players get, what's
bought — in a small data volume; never anything about *who* played (no names, no ids, no cookies,
no IP). Rooms live in memory and vanish when empty. See [Checking the numbers](#checking-the-numbers).

Your box's details — host, SSH user, paths, the Caddy network — live in `deploy/deploy.env`, which
is **gitignored and never committed**. Copy `deploy/deploy.env.example` to `deploy/deploy.env` and
fill it in before deploying.

```
phone ──HTTPS/WSS──▶ shared Caddy (:443) ──▶ telfersnake:8787   (shared docker network)
```

## Routine deploy

```bash
deploy/deploy.sh
```

Builds the game and the server bundle, rsyncs `dist/`, `dist-server/`, `Dockerfile` and `deploy/`
to `$DEPLOY_PATH`, rebuilds the image, restarts the container and waits for it to report healthy.
Takes about 20 seconds. **Anyone playing at that moment loses their connection** and lands on the
results screen with their stars kept; they tap Again and are back in.

## What was set up once

1. **DNS**: an `A` record `telfersnake → <your box>`.
2. **Container**: `deploy/deploy.sh` (above).
3. **Vhost**: `deploy/enable-site.sh` appends [`telfersnake.Caddyfile`](telfersnake.Caddyfile) to
   your shared Caddyfile (`$CADDYFILE`), validates it, and reloads Caddy. It backs the Caddyfile up
   first, is safe to run again (does nothing if the vhost is present), and refuses to run until DNS
   points at the box.

⚠️ If that Caddyfile lives inside another project's git checkout, a `git pull` of that project on
the box can drop the block. If the site stops answering after such an update, run
`deploy/enable-site.sh` again. It is also a single-file bind mount: append with `>>` or `tee -a`,
never `sed -i`.

## Limits and safety

- Container: 256 MB memory, one CPU, read-only filesystem (bar the small `telfersnake-data` volume
  for the anonymous stats), all capabilities dropped, no published ports. At idle it uses about 15 MB
  and 1% CPU.
- Server: at most 20 playgrounds (120 players) and 200 sockets; messages over 512 bytes or faster
  than 90 a second close the socket; a phone that stops answering pings loses its seat within
  30 seconds; sockets are only accepted from pages served by `https://telfersnake.joans.cat`
  (`ALLOWED_ORIGINS` in [`compose.yml`](compose.yml)); one failing playground is closed without
  touching the others.
- Headers (Caddy): strict Content-Security-Policy (own files and own socket only), HSTS, no
  framing, and a Permissions-Policy that asks the device for nothing.

## Checking on it

```bash
curl -s https://telfersnake.joans.cat/healthz          # {"ok":true,"rooms":1,"players":3}
# with deploy/deploy.env sourced (set -a; . deploy/deploy.env; set +a):
ssh "$DEPLOY_USER@$DEPLOY_HOST" docker logs --tail 50 telfersnake
ssh "$DEPLOY_USER@$DEPLOY_HOST" docker stats --no-stream telfersnake
```

## Checking the numbers

The game keeps **anonymous aggregate counts** — sessions, runs (by stage, difficulty and how they
ended), score/length/duration averages, size tiers reached, gems and stars earned, and shop buys and
sells by item. Nothing per-person: no names, ids, cookies or IP. Read them as JSON, guarded by the
secret `STATS_TOKEN` you set in `deploy/deploy.env` (empty token = the endpoint stays hidden, 404):

```bash
# with deploy/deploy.env sourced (set -a; . deploy/deploy.env; set +a):
curl -s "https://telfersnake.joans.cat/stats?k=$STATS_TOKEN" | python3 -m json.tool
```

The counts live in the `telfersnake-data` volume, so they survive restarts and redeploys. To reset
them, remove the volume while the stack is down: `docker volume rm deploy_telfersnake-data`.

## Taking it down

```bash
ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH && CADDY_NET=$CADDY_NET docker compose -f deploy/compose.yml down"
```

Caddy then answers 502 for the site; remove the `telfersnake.joans.cat { … }` block from the
Caddyfile (in place, see the warning above) and reload to retire the hostname completely.
