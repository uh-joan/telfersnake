import type { Rng } from './rng';
import type { Snake } from './snake';

/**
 * Level-up cards, Megabonk style: fill the XP bar, pick one of three. Every effect lives in
 * the sim (as plain numbers on the Snake), so a server can run them for multiplayer.
 */

/** Offensive powers: unlocked with blue gems in the Tuck Shop, then they join your card pool. */
export const POWER_IDS = ['laser', 'stink', 'zap'] as const;
export type PowerId = (typeof POWER_IDS)[number];

export const UPGRADE_IDS = [
  'skates', 'belly', 'homework', 'magnet', 'tongue', 'helmet', 'wrap', 'spikes', 'dragon', 'bees', 'clover',
  'laser', 'stink', 'zap',
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];
/** What a card can be: a real upgrade, or the filler offered once everything else is maxed. */
export type CardId = UpgradeId | 'snack';

/** The upgrades that always roll; powers are added to a snake's pool only once unlocked. */
export const BASE_IDS: readonly UpgradeId[] = UPGRADE_IDS.filter((id) => !(POWER_IDS as readonly string[]).includes(id));
/** What each power costs in blue gems. */
export const POWER_PRICES: Record<PowerId, number> = { laser: 40, stink: 30, zap: 50 };

export type Rarity = 'common' | 'rare' | 'epic';

export interface UpgradeDef {
  name: string;
  icon: string;
  rarity: Rarity;
  max: number;
  /** What it does, in pictures: this is what the card shows. The players are too young to read. */
  hint: string;
  /** The same in words, for grown-ups and screen readers (used as the card's label, never displayed). */
  blurb: (level: number) => string;
}

export const SNACK_MASS = 15;

export const UPGRADES: Record<CardId, UpgradeDef> = {
  skates: { name: 'Roller Skates', icon: '🛼', rarity: 'common', max: 5, hint: '🐍💨', blurb: (l) => `Slither ${l * 8}% faster` },
  belly: { name: 'Stretchy Belly', icon: '🎈', rarity: 'common', max: 5, hint: '🍔➕', blurb: (l) => `Grow ${l * 12}% more from every bite` },
  homework: { name: 'Homework Book', icon: '📒', rarity: 'common', max: 5, hint: '⬆️⬆️', blurb: (l) => `Level up ${l * 15}% quicker` },
  wrap: { name: 'Bubble Wrap', icon: '🫧', rarity: 'common', max: 5, hint: '🪨🚫', blurb: (l) => (l >= 5 ? 'Rocks cannot shrink you at all' : `Rocks shrink you ${l * 20}% less`) },
  magnet: { name: 'Magnet Tail', icon: '🧲', rarity: 'rare', max: 5, hint: '🍎➡️🐍', blurb: () => 'Food nearby zooms to you. Bigger pull each level' },
  tongue: { name: 'Long Tongue', icon: '👅', rarity: 'rare', max: 5, hint: '👅↔️', blurb: () => 'Gulp things from further away' },
  helmet: { name: 'Bike Helmet', icon: '⛑️', rarity: 'rare', max: 3, hint: '💥🚫', blurb: (l) => `Shrugs off one bonk. Recharges in ${HELMET_RECHARGE[l]}s` },
  clover: { name: 'Four-leaf Clover', icon: '🍀', rarity: 'rare', max: 3, hint: '🌟🍔', blurb: () => 'More golden food, and luckier cards' },
  spikes: { name: 'Hedgehog Spikes', icon: '🦔', rarity: 'epic', max: 3, hint: '🐍🌵', blurb: () => 'Rivals bonk themselves on you from further off' },
  dragon: { name: 'Dragon Breath', icon: '🐲', rarity: 'epic', max: 5, hint: '🔥🐍💨', blurb: () => 'Scorches rivals smaller (like a rock!), toasts food for double points, dazzles animals' },
  bees: { name: 'Bee Buddies', icon: '🐝', rarity: 'epic', max: 3, hint: '🐝🍎', blurb: (l) => `${l} busy bee${l > 1 ? 's' : ''} fetching food around you` },
  laser: { name: 'Laser Eyes', icon: '👁️', rarity: 'epic', max: 5, hint: '👁️➡️🐍', blurb: () => 'Zaps the rival dead ahead smaller' },
  stink: { name: 'Stink Cloud', icon: '💨', rarity: 'epic', max: 3, hint: '💨🐍💨', blurb: () => 'Puffs a stink cloud behind you that shrinks chasers' },
  zap: { name: 'Zap Ring', icon: '⚡', rarity: 'epic', max: 3, hint: '⚡🔄', blurb: () => 'Shocks every rival close to you smaller' },
  snack: { name: 'Snack Pack', icon: '🥪', rarity: 'common', max: Infinity, hint: '🐍➕➕', blurb: () => 'A big lunchbox. Grow a lot, right now' },
};

const HELMET_RECHARGE = [0, 40, 30, 20];
const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, rare: 3, epic: 1 };
/** Each clover level makes rare and epic cards this much likelier. */
const LUCK_BONUS: Record<Rarity, number> = { common: 0, rare: 1, epic: 0.7 };

/**
 * XP needed to go from `level` to the next. Steep on purpose: the first card comes after about
 * twenty bites, and by level 8 each one is a good minute of careful eating.
 */
export function xpForLevel(level: number): number {
  return Math.round(20 + 14 * level + 2 * level * level);
}

/** Three different cards the snake can still use; Snack Packs fill any gaps. */
export function rollCards(rng: Rng, snake: Snake): CardId[] {
  // Base upgrades always; powers only once unlocked (a per-snake set).
  const pool = [...BASE_IDS, ...snake.powers].filter((id) => snake.levelOf(id) < UPGRADES[id].max);
  const cards: CardId[] = [];
  while (cards.length < 3 && pool.length > 0) {
    const weights = pool.map((id) => RARITY_WEIGHT[UPGRADES[id].rarity] + snake.luck * LUCK_BONUS[UPGRADES[id].rarity]);
    let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
    let pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      if (roll < weights[i]) { pick = i; break; }
      roll -= weights[i];
    }
    cards.push(pool[pick]);
    pool.splice(pick, 1);
  }
  while (cards.length < 3) cards.push('snack');
  return cards;
}

/** Recompute every upgrade-driven number on the snake from its upgrade levels. */
export function refreshStats(s: Snake): void {
  const lv = (id: UpgradeId) => s.levelOf(id);
  s.speedMul = s.baseSpeedMul * (1 + 0.08 * lv('skates'));
  s.growthMul = s.baseGrowthMul * (1 + 0.12 * lv('belly'));
  s.xpMul = 1 + 0.15 * lv('homework');
  s.rockGuard = Math.min(1, 0.2 * lv('wrap'));
  s.magnet = lv('magnet') > 0 ? 1.8 + 0.8 * lv('magnet') : 0;
  s.reachBonus = 0.35 * lv('tongue');
  s.luck = lv('clover');
  s.spikes = 0.25 * lv('spikes');
  s.bees = lv('bees');
  s.breathLevel = lv('dragon');
  const hadHelmet = s.helmetRecharge > 0;
  s.helmetRecharge = HELMET_RECHARGE[lv('helmet')];
  if (s.helmetRecharge > 0 && !hadHelmet) s.helmetReady = true;
  if (!s.helmetReady) s.helmetIn = Math.min(s.helmetIn, s.helmetRecharge);
}
