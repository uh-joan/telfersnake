import { RIVALS, SOLO_RIVALS, type Personality } from './bot';
import type { CardId } from './upgrades';

/**
 * The three ways to play. A mode is nothing but a small bundle of numbers handed to the World:
 * which rival personalities fill the seats, how much food there is, and whether the rival snakes
 * are allowed the level-up cards that are normally the player's own edge.
 *
 *   easy   — small, slow, timid, oblivious rivals: a five-year-old is soon the biggest in the yard.
 *   normal — exactly as the game has always been. Challenging.
 *   god    — fast, greedy, clever rivals that ALSO take upgrades (they breathe fire back at you).
 *            The secret one: it exists only once you own the two priciest things in the Tuck Shop.
 */

export type Mode = 'easy' | 'normal' | 'god';
export const MODES: readonly Mode[] = ['easy', 'normal', 'god'];
export const DEFAULT_MODE: Mode = 'normal';

/** God mode unlocks only when both of these are owned: the Golden Snake and the Wizard Hat. */
export const GOD_ITEMS = ['gold', 'wizard'] as const;
export const godUnlocked = (owned: readonly string[]): boolean => GOD_ITEMS.every((id) => owned.includes(id));

export interface Rules {
  mode: Mode;
  foodCount: number;
  /** God mode only: bots take level-up cards too, so the upgrades stop being the player's edge. */
  botsGetUpgrades: boolean;
  /** Six rival personalities for a shared room; the four met when playing alone. */
  rivals: Personality[];
  soloRivals: Personality[];
}

// Easy: shrink them, slow them, turn off the hunting, and let them blunder into their own rocks.
const easify = (p: Personality): Personality => ({
  ...p,
  startMass: 0,
  massCap: Math.max(40, Math.round(p.massCap * 0.5)),
  speedMul: Math.min(p.speedMul, 0.8),
  growthMul: p.growthMul * 0.7,
  caution: p.caution * 0.5, // notices obstacles less — bonks itself, easy to dodge
  aggression: 0, // never tries to cut you off
  dashy: 0, // never chases you down
  timid: true, // runs from anything bigger, i.e. you
});

// God: faster than a fresh player, greedier, and cannier. Paired with botsGetUpgrades below.
const deify = (p: Personality): Personality => ({
  ...p,
  startMass: p.startMass + 6,
  massCap: Math.round(p.massCap * 1.3),
  speedMul: Math.min(1.15, p.speedMul + 0.2),
  growthMul: p.growthMul * 1.15,
  caution: Math.min(1, p.caution + 0.15),
  aggression: Math.min(1, p.aggression + 0.35),
  dashy: Math.min(1, p.dashy + 0.4),
});

export const RULES: Record<Mode, Rules> = {
  easy: { mode: 'easy', foodCount: 55, botsGetUpgrades: false, rivals: RIVALS.map(easify), soloRivals: SOLO_RIVALS.map(easify) },
  normal: { mode: 'normal', foodCount: 42, botsGetUpgrades: false, rivals: RIVALS, soloRivals: SOLO_RIVALS },
  god: { mode: 'god', foodCount: 42, botsGetUpgrades: true, rivals: RIVALS.map(deify), soloRivals: SOLO_RIVALS.map(deify) },
};

export const rulesFor = (mode: Mode): Rules => RULES[mode] ?? RULES.normal;
export const asMode = (value: unknown): Mode => (MODES.includes(value as Mode) ? (value as Mode) : DEFAULT_MODE);

/**
 * A bot doesn't sit and deliberate over its three cards: it grabs the scariest thing on offer,
 * top of this list first. Returns the index into `cards` to take.
 */
const BOT_PREF: readonly CardId[] = ['dragon', 'spikes', 'skates', 'magnet', 'bees', 'belly', 'tongue', 'clover', 'homework', 'helmet', 'wrap', 'snack'];
export function botCardChoice(cards: readonly CardId[]): number {
  let best = 0;
  let bestRank = Infinity;
  cards.forEach((card, i) => {
    const rank = BOT_PREF.indexOf(card);
    const r = rank < 0 ? 99 : rank;
    if (r < bestRank) {
      bestRank = r;
      best = i;
    }
  });
  return best;
}
