import { SCHOOL } from './layout';
import type { Stage, StageId } from './stage';

/**
 * Every place you can play, by id. The school stands in for any stage not built yet, so an old
 * client or a bad message can never land nowhere.
 */
export const STAGES: Record<StageId, Stage> = {
  school: SCHOOL,
  common: SCHOOL, // Level 2: replaced in Phase 1.
};

export const stageFor = (id: StageId): Stage => STAGES[id] ?? SCHOOL;
