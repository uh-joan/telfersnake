import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import { type ClientMessage, PROTOCOL, type ServerMessage } from '../src/net/protocol';
import { asMode, type Mode } from '../src/sim/modes';
import { STEP } from '../src/sim/world';
import { Room } from './room';

/**
 * The Telfersnake game server. One Node process: it serves the built game and runs every room.
 * No accounts, no database, nothing stored: a room lives in memory and is gone when it empties.
 */

const PORT = Number(process.env.PORT) || 8787;
const MAX_ROOMS = 20; // six seats each: 120 players, far more than one small box should be asked to run
const MAX_SOCKETS = 200;
/** Per address. A whole class shares one school address, so this is generous; it stops one machine taking every seat. */
const MAX_SOCKETS_PER_ADDRESS = 40;
const MAX_MESSAGE = 512; // bytes; a thumb position is tiny, anything bigger is not from our game
const MAX_MESSAGES_PER_SECOND = 90; // the game sends 30; anything near this is not our client
const HEARTBEAT = 15_000; // ms between pings; a phone that misses one has gone (asleep, tunnel, flat battery)
const EMPTY_ROOM_LIFE = 5_000; // ms a room outlives its last player
/**
 * When set (production), only pages served from these origins may open a game socket, so the
 * server cannot be borrowed by some other website. Comma separated. Unset in development.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const rooms = new Map<string, Room>();
const whereIs = new Map<WebSocket, Room>();

let roomsOpened = 0;

/** Rooms are only ever opened because a player needs a seat, so nobody can fill the table with empty ones. */
function openRoom(mode: Mode): Room | null {
  if (rooms.size >= MAX_ROOMS) return null;
  const room = new Room(`room-${++roomsOpened}`, true, mode);
  rooms.set(room.code, room);
  return room;
}

const reply = (socket: WebSocket, message: ServerMessage) => socket.send(JSON.stringify(message));

function hello(socket: WebSocket, m: Extract<ClientMessage, { t: 'hello' }>): void {
  if (whereIs.has(socket)) return;
  if (m.v !== PROTOCOL) return reply(socket, { t: 'sorry', why: 'old' });

  // One way in per difficulty: any playground of the wanted mode with a free seat, or a new one.
  // (Private rooms with codes were tried and dropped; if they return they need per-address limits.)
  const mode = asMode(m.mode);
  const room = [...rooms.values()].find((r) => r.mode === mode && r.hasSpace) ?? openRoom(mode);
  if (!room) return reply(socket, { t: 'sorry', why: 'busy' });
  if (!room.join(socket, m, m.buy === 1)) return reply(socket, { t: 'sorry', why: 'full' });
  whereIs.set(socket, room);
}

const server = createServer((req, res) => {
  try {
    serve(req, res);
  } catch (error) {
    console.error('request failed:', error instanceof Error ? error.message : error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

function serve(req: IncomingMessage, res: import('node:http').ServerResponse): void {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: whereIs.size }));
    return;
  }
  // Serve the built game, so one deploy is the whole thing.
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end('Build the game first: npm run build');
    return;
  }
  // Vite's bundles carry a content hash in their name, so they can be kept for ever; the page itself
  // must be re-checked on every open or a phone's home-screen copy pins an old build.
  const hashed = /[/\\]assets[/\\]/.test(file);
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  // A deploy can replace the file between the check above and the read: never leave the response hanging.
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

const sockets = new WebSocketServer({
  server, path: '/play', maxPayload: MAX_MESSAGE,
  verifyClient: ({ origin }: { origin: string }) => ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin),
});

/** Per socket: is it still answering pings, and how chatty has it been this second. */
const health = new WeakMap<WebSocket, { alive: boolean; messages: number }>();

/** Behind Caddy every socket comes from the proxy, so the player's address is in the forwarded header. */
const addressOf = (req: IncomingMessage) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
const perAddress = new Map<string, number>();

sockets.on('connection', (socket, req) => {
  const address = addressOf(req);
  const mineHere = (perAddress.get(address) ?? 0) + 1;
  if (sockets.clients.size > MAX_SOCKETS || mineHere > MAX_SOCKETS_PER_ADDRESS) {
    socket.close(1013, 'busy');
    return;
  }
  perAddress.set(address, mineHere);
  socket.once('close', () => {
    const left = (perAddress.get(address) ?? 1) - 1;
    if (left <= 0) perAddress.delete(address);
    else perAddress.set(address, left);
  });
  const mine = { alive: true, messages: 0 };
  health.set(socket, mine);
  socket.on('pong', () => (mine.alive = true));

  socket.on('message', (data) => {
    if (++mine.messages > MAX_MESSAGES_PER_SECOND) return socket.terminate();
    // Nothing a phone sends may ever take the server down for everybody else.
    try {
      const message = JSON.parse(String(data)) as ClientMessage;
      if (!message || typeof message !== 'object') return;
      if (message.t === 'hello') hello(socket, message);
      else whereIs.get(socket)?.receive(socket, message);
    } catch (error) {
      console.error('bad message dropped:', error instanceof Error ? error.message : error);
    }
  });
  const gone = () => {
    whereIs.get(socket)?.leave(socket);
    whereIs.delete(socket);
  };
  socket.on('close', gone);
  socket.on('error', gone);
});

// A phone that has gone to sleep never says goodbye: without this it would hold its seat for ever.
setInterval(() => {
  for (const socket of sockets.clients) {
    const h = health.get(socket);
    if (!h) continue;
    h.messages = 0;
    if (!h.alive) socket.terminate();
    else {
      h.alive = false;
      socket.ping();
    }
  }
}, HEARTBEAT);
setInterval(() => {
  for (const socket of sockets.clients) {
    const h = health.get(socket);
    if (h) h.messages = 0;
  }
}, 1000);

// One clock for every room. Timers drift, so count real time and catch up in whole ticks.
let last = performance.now();
let owed = 0;
setInterval(() => {
  const now = performance.now();
  owed = Math.min(owed + (now - last) / 1000, 0.25);
  last = now;
  while (owed >= STEP) {
    owed -= STEP;
    for (const [code, room] of rooms) {
      try {
        room.tick();
      } catch (error) {
        // One broken playground must not stop the others: close it and let its players rejoin.
        console.error(`room ${code} failed and was closed:`, error);
        for (const socket of room.players.keys()) socket.close(1011, 'room closed');
        rooms.delete(code);
      }
    }
  }
  for (const [code, room] of rooms) {
    if (room.emptySince !== null && Date.now() - room.emptySince > EMPTY_ROOM_LIFE) rooms.delete(code);
  }
}, 1000 / 60);

// Anything that gets this far has left the process in an unknown state. Say so and stop: Docker
// restarts it in a second, which is far kinder than limping on half-broken. (A bad message and
// a failing room are both caught above and never reach here.)
process.on('uncaughtException', (error) => {
  console.error('uncaught, exiting:', error);
  process.exit(1);
});

server.listen(PORT, () => console.log(`Telfersnake server on http://localhost:${PORT}  (WebSocket at /play)`));
