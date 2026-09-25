import { COMMON } from './commonLayout';
import { SCHOOL } from './layout';
import type { Stage, StageId } from './stage';

/**
 * Every place you can play, by id. The school stands in for any unknown id, so an old client or a
 * bad message can never land nowhere.
 */
export const STAGES: Record<StageId, Stage> = {
  school: SCHOOL,
  common: COMMON,
};

export const stageFor = (id: StageId): Stage => STAGES[id] ?? SCHOOL;
