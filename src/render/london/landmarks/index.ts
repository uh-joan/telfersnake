import { build as bigben } from './bigben';
import { build as eye } from './eye';
import { build as gherkin } from './gherkin';
import { build as globe } from './globe';
import type { LandmarkBuilder, LandmarkId } from './kit';
import { build as museum } from './museum';
import { build as palace } from './palace';
import { build as piccadilly } from './piccadilly';
import { build as shard } from './shard';
import { build as stpauls } from './stpauls';
import { build as tower } from './tower';
import { build as towerbridge } from './towerbridge';
import { build as trafalgar } from './trafalgar';

export type { LandmarkBuild, LandmarkBuilder, LandmarkId } from './kit';

/** The twelve sights, one builder each (landmarks/<id>.ts). london.ts places each at its LANDMARKS `at`. */
export const LANDMARK_BUILDERS: Record<LandmarkId, LandmarkBuilder> = {
  bigben, eye, palace, trafalgar, stpauls, tower, towerbridge, shard, gherkin, globe, piccadilly, museum,
};
