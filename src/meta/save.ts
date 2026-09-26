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
  /** Where to play: the school, or the Common once it is unlocked. */
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
}

const KEY = 'telfersnake.save.v1';

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
};

const AUDIO_MODES: readonly AudioMode[] = ['all', 'sfx', 'off'];
const count = (value: unknown) => Math.min(9_999_999, Math.max(0, Math.floor(Number(value) || 0)));
const text = (value: unknown, otherwise: string) => (typeof value === 'string' ? value : otherwise);

/** Read what is stored, trusting none of it: it may be hand-edited, stale or from a newer version. */
function readDisk(): Save {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
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
    // The Common is a paid ticket: a hand-edited save can't pick it without having bought it.
    const commonUnlocked = data.commonUnlocked === true;
    const stage = asStage(data.stage) === 'common' && !commonUnlocked ? 'school' : asStage(data.stage);
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
    };
  } catch {
    return { ...FRESH, owned: [...FRESH.owned], name: randomName() };
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
    };
    localStorage.setItem(KEY, JSON.stringify(merged));
    // Only once it is safely on disk does this tab adopt the merged picture.
    Object.assign(save, merged);
    syncedStars = merged.stars;
    syncedGems = merged.gems;
    syncedOwned = [...merged.owned];
  } catch {
    // Storage full or blocked: carry on, the run still works.
  }
}
