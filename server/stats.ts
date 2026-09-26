/**
 * Anonymous, aggregate analytics. The game posts tiny beacons ("a game started", "a run ended with
 * this score/size", "the Common was unlocked") to `/a`; this tallies them into counts and averages
 * only. Nothing here identifies a child: no names, no ids, no IP, nothing per-person — just totals.
 *
 * Kept in memory, and (when STATS_FILE points at a writable path, e.g. a data volume in production)
 * mirrored to a small JSON file so the totals survive a restart. If that path is not writable the
 * counts simply live for the life of the process. Read back through the token-guarded GET /stats.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FILE = (process.env.STATS_FILE ?? '').trim();
const MAX_DAYS = 120; // a rolling window for the per-day series
const MAX_ITEMS = 200; // guard against a flood of made-up cosmetic ids

const clampInt = (v: unknown, lo: number, hi: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0;
};
const clampStr = (v: unknown, max = 24): string => (typeof v === 'string' ? v.slice(0, max).replace(/[^\w-]/g, '') : '');

interface Tally { sum: number; count: number; max: number }
const tally = (): Tally => ({ sum: 0, count: 0, max: 0 });
const add = (b: Tally, v: number): void => {
  b.sum += v;
  b.count++;
  if (v > b.max) b.max = v;
};
const bump = (m: Record<string, number>, k: string, by = 1): void => {
  if (k) m[k] = (m[k] ?? 0) + by;
};

interface Stats {
  since: number;
  updated: number;
  sessions: number;
  returning: number;
  runs: number;
  byStage: Record<string, number>;
  byMode: Record<string, number>;
  byEnd: Record<string, number>;
  tierReached: Record<string, number>;
  score: Tally;
  length: Tally;
  duration: Tally;
  gulps: number;
  bonks: number;
  gemsEarned: number;
  starsBanked: number;
  unlocks: number;
  buys: { count: number; starSpent: number; gemSpent: number; byItem: Record<string, number> };
  sells: { count: number; starRefund: number; gemRefund: number; byItem: Record<string, number> };
  daily: Record<string, { sessions: number; runs: number }>;
}

function fresh(): Stats {
  return {
    since: Date.now(), updated: Date.now(),
    sessions: 0, returning: 0,
    runs: 0, byStage: {}, byMode: {}, byEnd: {}, tierReached: {},
    score: tally(), length: tally(), duration: tally(),
    gulps: 0, bonks: 0, gemsEarned: 0, starsBanked: 0,
    unlocks: 0,
    buys: { count: 0, starSpent: 0, gemSpent: 0, byItem: {} },
    sells: { count: 0, starRefund: 0, gemRefund: 0, byItem: {} },
    daily: {},
  };
}

function load(): Stats {
  if (FILE) {
    try {
      if (existsSync(FILE)) return { ...fresh(), ...JSON.parse(readFileSync(FILE, 'utf8')) };
    } catch {
      /* missing or corrupt: start fresh */
    }
  }
  return fresh();
}

let stats: Stats = load();
let dirty = false;

const today = (): string => new Date().toISOString().slice(0, 10);
function day(): { sessions: number; runs: number } {
  const k = today();
  if (!stats.daily[k]) {
    stats.daily[k] = { sessions: 0, runs: 0 };
    const keys = Object.keys(stats.daily).sort();
    while (keys.length > MAX_DAYS) delete stats.daily[keys.shift() as string];
  }
  return stats.daily[k];
}
function bumpItem(m: Record<string, number>, id: string): void {
  if (m[id] === undefined && Object.keys(m).length >= MAX_ITEMS) return;
  bump(m, id);
}

/** Fold one anonymous beacon into the totals. Everything is coerced and clamped; junk is ignored. */
export function record(ev: Record<string, unknown>): void {
  switch (ev.t) {
    case 'app':
      stats.sessions++;
      if (clampInt(ev.r, 0, 1)) stats.returning++;
      day().sessions++;
      break;
    case 'run':
      stats.runs++;
      day().runs++;
      bump(stats.byStage, clampStr(ev.stage));
      bump(stats.byMode, clampStr(ev.mode));
      bump(stats.byEnd, clampStr(ev.end));
      bump(stats.tierReached, String(clampInt(ev.tier, 0, 9)));
      add(stats.score, clampInt(ev.score, 0, 1e6));
      add(stats.length, clampInt(ev.len, 0, 1e4));
      add(stats.duration, clampInt(ev.dur, 0, 86_400));
      stats.gulps += clampInt(ev.gulps, 0, 1e4);
      stats.bonks += clampInt(ev.bonks, 0, 1e4);
      stats.gemsEarned += clampInt(ev.gems, 0, 1e4);
      stats.starsBanked += clampInt(ev.banked, 0, 1e6);
      break;
    case 'unlock':
      stats.unlocks++;
      break;
    case 'buy': {
      const price = clampInt(ev.price, 0, 1e5);
      stats.buys.count++;
      if (clampStr(ev.coin) === 'g') stats.buys.gemSpent += price;
      else stats.buys.starSpent += price;
      bumpItem(stats.buys.byItem, clampStr(ev.id, 32));
      break;
    }
    case 'sell': {
      const refund = clampInt(ev.refund, 0, 1e5);
      stats.sells.count++;
      if (clampStr(ev.coin) === 'g') stats.sells.gemRefund += refund;
      else stats.sells.starRefund += refund;
      bumpItem(stats.sells.byItem, clampStr(ev.id, 32));
      break;
    }
    default:
      return; // unknown event: ignore
  }
  stats.updated = Date.now();
  dirty = true;
}

/** The whole aggregate, with a couple of handy averages worked out. */
export function snapshot(): unknown {
  const avg = (b: Tally): number => (b.count ? Math.round(b.sum / b.count) : 0);
  return {
    ...stats,
    avgScore: avg(stats.score),
    avgLength: avg(stats.length),
    avgDurationSec: avg(stats.duration),
  };
}

function flush(): void {
  if (!dirty || !FILE) return;
  try {
    writeFileSync(FILE, JSON.stringify(stats));
    dirty = false;
  } catch {
    /* read-only filesystem (e.g. dev): the counts stay in memory */
  }
}
setInterval(flush, 20_000).unref();
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    flush();
    process.exit(0);
  });
}
