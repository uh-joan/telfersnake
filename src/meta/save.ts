/**
 * What the game remembers between runs. Lives in this browser only: no account, no server,
 * nothing personal. Storage can be missing or blocked (private windows), so every access is
 * guarded and the game plays fine without it.
 */

import { asMode, godUnlocked, type Mode } from '../sim/modes';
import { asStage, type StageId } from '../sim/stage';
import { cleanName, randomName } from './names';

export type AudioMode = 'all' | 'sfx' | 'off';

export interface Save {
  stars: number;
  /** Ids of everything bought in the Tuck Shop. */
  owned: string[];
  skin: string;
  hat: string;
  trail: string;
  /** Built from the word lists in names.ts; never free text. */
  name: string;
  bestScore: number;
  bestLength: number;
  runs: number;
  /** Blue gems, earned by shrinking/bonking rivals; spent one at a time to pick power cards. */
  gems: number;
  audio: AudioMode;
  /** Difficulty. 'god' only sticks once it is unlocked (see readDisk). */
  mode: Mode;
  /** Where to play: the school, or the Common / London once unlocked. */
  stage: StageId;
  /** Paid the 100-gem ticket to the Common (Level 2). Sticky. */
  commonUnlocked: boolean;
  /** Reached the top size tier (MEGA Telfersnake) in a Normal game: God mode's proof-of-skill. */
  mega: boolean;
  /** God mode's one-time "you've unlocked it" flourish has been shown. */
  godRevealed: boolean;
  /** Has ever dashed: until then the dash button teaches itself. */
  dashed: boolean;
  /** The one-time "Welcome to the Common!" flourish has been shown. */
  commonSeen: boolean;
  // London (Level 3). Stored under its own key (see LONDON_KEY), merged in here.
  /** Paid the ⭐600 Golden Ticket to London. Sticky. */
  londonUnlocked: boolean;
  /** The one-time London welcome has been shown. */
  londonSeen: boolean;
  /** Landmark stamps collected. */
  stamps: string[];
  /** Postcards kept for ever (the album). */
  postcards: string[];
}

const KEY = 'telfersnake.save.v1';
/**
 * London's progress lives under its own key. A tab still running a pre-London bundle rebuilds and
 * rewrites the main save from the fields it knows, so anything London kept there would be wiped by
 * that tab's next save; old code never touches this key.
 */
const LONDON_KEY = 'telfersnake.london.v1';
const LONDON_FIELDS = ['londonUnlocked', 'londonSeen', 'stamps', 'postcards'] as const;

const FRESH: Save = {
  stars: 0,
  owned: ['telfer', 'no-hat', 'no-trail'],
  skin: 'telfer',
  hat: 'no-hat',
  trail: 'no-trail',
  name: '',
  bestScore: 0,
  bestLength: 0,
  runs: 0,
  gems: 0,
  audio: 'all',
  mode: 'easy', // new players start gently; the choice is remembered once they change it
  stage: 'school',
  commonUnlocked: false,
  mega: false,
  godRevealed: false,
  dashed: false,
  commonSeen: false,
  londonUnlocked: false,
  londonSeen: false,
  stamps: [],
  postcards: [],
};

const AUDIO_MODES: readonly AudioMode[] = ['all', 'sfx', 'off'];
const count = (value: unknown) => Math.min(9_999_999, Math.max(0, Math.floor(Number(value) || 0)));
const text = (value: unknown, otherwise: string) => (typeof value === 'string' ? value : otherwise);
const ids = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : []);
const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])];

/** A stored object exactly as it is, or {} if there is none (or it is unreadable). */
function readRaw(key: string): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type London = Pick<Save, (typeof LONDON_FIELDS)[number]>;

/** London's own record, trusting none of it. */
function readLondon(): London {
  const d = readRaw(LONDON_KEY);
  return { londonUnlocked: d.unlocked === true, londonSeen: d.seen === true, stamps: ids(d.stamps), postcards: ids(d.postcards) };
}

/** Read what is stored, trusting none of it: it may be hand-edited, stale or from a newer version. */
function readDisk(): Save {
  try {
    const data = readRaw(KEY) as Partial<Save>;
    const london = readLondon();
    const bought = Array.isArray(data.owned) ? data.owned.filter((id) => typeof id === 'string') : [];
    const owned = [...new Set([...FRESH.owned, ...bought])];
    // You can only wear what you own.
    const worn = (value: unknown, otherwise: string) => (owned.includes(text(value, '')) ? (value as string) : otherwise);
    // No stored choice yet → the gentle default (Easy). A remembered one is kept; garbage falls
    // back to Normal. God is secret: a hand-edited save can't force it without both owning its
    // items and having gone MEGA in a Normal game.
    const mega = data.mega === true;
    const wanted = asMode(data.mode ?? FRESH.mode);
    const mode = wanted === 'god' && !godUnlocked(owned, mega) ? 'normal' : wanted;
    // The Common and London are paid tickets: a hand-edited save can't pick one without having bought it.
    const commonUnlocked = data.commonUnlocked === true;
    const wantedStage = asStage(data.stage);
    const locked = (wantedStage === 'common' && !commonUnlocked) || (wantedStage === 'london' && !london.londonUnlocked);
    const stage = locked ? 'school' : wantedStage;
    return {
      stars: count(data.stars),
      owned,
      skin: worn(data.skin, FRESH.skin),
      hat: worn(data.hat, FRESH.hat),
      trail: worn(data.trail, FRESH.trail),
      name: cleanName(data.name) ?? randomName(),
      bestScore: count(data.bestScore),
      bestLength: count(data.bestLength),
      runs: count(data.runs),
      gems: count(data.gems),
      audio: AUDIO_MODES.includes(data.audio as AudioMode) ? (data.audio as AudioMode) : FRESH.audio,
      mode,
      stage,
      commonUnlocked,
      mega,
      godRevealed: data.godRevealed === true,
      dashed: data.dashed === true,
      commonSeen: data.commonSeen === true,
      ...london,
    };
  } catch {
    return { ...FRESH, owned: [...FRESH.owned], stamps: [], postcards: [], name: randomName() };
  }
}

/** Stars, gems and owned items as of the last time this tab and the disk agreed; the rest is this tab's doing. */
let syncedStars = 0;
let syncedGems = 0;
let syncedOwned: string[] = [];

export function loadSave(): Save {
  const save = readDisk();
  syncedStars = save.stars;
  syncedGems = save.gems;
  syncedOwned = [...save.owned];
  return save;
}

/**
 * Save without clobbering another tab: a second tab on the same tablet holds an older snapshot,
 * and writing it back whole would silently undo a child's stars and purchases. So only this
 * tab's changes are applied on top of whatever is on disk now.
 */
export function writeSave(save: Save): void {
  try {
    const disk = readDisk();
    // Owned as a delta, like stars/gems: keep whatever another tab added, apply this tab's own
    // buys and sell-backs. Without this, a removal would be undone by unioning with the disk.
    const added = save.owned.filter((id) => !syncedOwned.includes(id));
    const removed = syncedOwned.filter((id) => !save.owned.includes(id));
    const owned = [...new Set([...disk.owned, ...added])].filter((id) => !removed.includes(id));
    const merged: Save = {
      ...save,
      stars: Math.max(0, disk.stars + (save.stars - syncedStars)),
      gems: Math.max(0, disk.gems + (save.gems - syncedGems)),
      owned,
      bestScore: Math.max(save.bestScore, disk.bestScore),
      bestLength: Math.max(save.bestLength, disk.bestLength),
      runs: Math.max(save.runs, disk.runs),
      // The MEGA-in-Normal proof and the God reveal are sticky: once earned in any tab, they stay.
      mega: save.mega || disk.mega,
      commonUnlocked: save.commonUnlocked || disk.commonUnlocked,
      godRevealed: save.godRevealed || disk.godRevealed,
      commonSeen: save.commonSeen || disk.commonSeen,
      dashed: save.dashed || disk.dashed,
      // London's flags are sticky and its collections only ever grow, whichever tab earned them.
      londonUnlocked: save.londonUnlocked || disk.londonUnlocked,
      londonSeen: save.londonSeen || disk.londonSeen,
      stamps: union(disk.stamps, save.stamps),
      postcards: union(disk.postcards, save.postcards),
    };
    // Whatever else is stored (fields from a newer version) is kept: ours are written over the top.
    // London's fields go to their own key, never into the main one.
    const main: Record<string, unknown> = { ...readRaw(KEY), ...merged };
    for (const f of LONDON_FIELDS) delete main[f];
    localStorage.setItem(KEY, JSON.stringify(main));
    const london = { unlocked: merged.londonUnlocked, seen: merged.londonSeen, stamps: merged.stamps, postcards: merged.postcards };
    localStorage.setItem(LONDON_KEY, JSON.stringify({ ...readRaw(LONDON_KEY), ...london }));
    // Only once it is safely on disk does this tab adopt the merged picture.
    Object.assign(save, merged);
    syncedStars = merged.stars;
    syncedGems = merged.gems;
    syncedOwned = [...merged.owned];
  } catch {
    // Storage full or blocked: carry on, the run still works.
  }
}
