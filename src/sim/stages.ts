import { COMMON } from './commonLayout';
import { SCHOOL } from './layout';
import { LONDON } from './londonLayout';
import type { Stage, StageId } from './stage';

/**
 * Every place you can play, by id. The school stands in for any unknown id, so an old client or a
 * bad message can never land nowhere.
 */
export const STAGES: Record<StageId, Stage> = {
  school: SCHOOL,
  common: COMMON,
  london: LONDON,
};

export const stageFor = (id: StageId): Stage => STAGES[id] ?? SCHOOL;
