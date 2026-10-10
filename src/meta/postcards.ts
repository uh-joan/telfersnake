/**
 * London's postcard album (docs/LEVEL3-LONDON.md §10). A postcard is kept for ever: the twelve
 * landmarks (each the first time it is ever stamped), and the rare ones for the stories kids brag
 * about. Ids are stable and shared with the HD build (docs/london-catalogue.md): they live in
 * `telfersnake.london.v1`'s `postcards`, next to `stamps` (every landmark ever stamped).
 */

import type { LandmarkId } from '../render/london/landmarks/kit';
import { track } from './analytics';
import type { Save } from './save';

export type RareId = 'guard' | 'eyeride' | 'launch' | 'dragon' | 'royal' | 'fireworks' | 'tube' | 'teatime' | 'whole';
export type PostcardId = LandmarkId | RareId;

export interface Postcard {
  id: PostcardId;
  /** The ribbon on the card: one or two short words. */
  name: string;
  rare: boolean;
}

/** The twelve sights, in the order of the album (the tour route, roughly west to east). */
export const LANDMARK_CARDS: readonly Postcard[] = [
  { id: 'bigben', name: 'BIG BEN', rare: false },
  { id: 'eye', name: 'LONDON EYE', rare: false },
  { id: 'palace', name: 'PALACE', rare: false },
  { id: 'museum', name: 'MUSEUM', rare: false },
  { id: 'piccadilly', name: 'PICCADILLY', rare: false },
  { id: 'trafalgar', name: 'TRAFALGAR', rare: false },
  { id: 'stpauls', name: "ST PAUL'S", rare: false },
  { id: 'globe', name: 'GLOBE', rare: false },
  { id: 'gherkin', name: 'GHERKIN', rare: false },
  { id: 'tower', name: 'TOWER', rare: false },
  { id: 'towerbridge', name: 'TOWER BRIDGE', rare: false },
  { id: 'shard', name: 'SHARD', rare: false },
];

/** The rare ones: moments, not places. */
export const RARE_CARDS: readonly Postcard[] = [
  { id: 'guard', name: 'SMILE!', rare: true },
  { id: 'eyeride', name: 'EYE RIDE', rare: true },
  { id: 'launch', name: 'WHEE!', rare: true },
  { id: 'dragon', name: 'DRAGON', rare: true },
  { id: 'royal', name: 'ROYAL!', rare: true },
  { id: 'fireworks', name: 'FIREWORKS', rare: true },
  { id: 'tube', name: 'TUBE', rare: true },
  { id: 'teatime', name: 'TEA TIME', rare: true },
  { id: 'whole', name: 'WHOLE LONDON', rare: true },
];

export const ALL_CARDS: readonly Postcard[] = [...LANDMARK_CARDS, ...RARE_CARDS];

/** Keep a postcard. True only the first time (that is when the fanfare plays). */
export function awardPostcard(save: Save, id: PostcardId): boolean {
  if (save.postcards.includes(id)) return false;
  save.postcards.push(id);
  track('postcard', { id, n: save.postcards.length });
  return true;
}
