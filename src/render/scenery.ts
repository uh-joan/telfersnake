import * as THREE from 'three';
import type { StageId } from '../sim/stage';
import { makeCommon } from './common';
import { makeGround } from './ground';
import { makeSchool, type School } from './school';

/**
 * The ground + fixed scenery for a stage, as one swappable group with a `reveal` for the buildings
 * that occlude the snake. The school keeps its ground and scenery as two pieces; the Common bundles
 * its own. Same `School` shape either way, so the renderer treats them alike.
 */
export function makeStageScene(id: StageId, maxAnisotropy: number): School {
  if (id === 'common') return makeCommon(maxAnisotropy);
  const s = makeSchool();
  const group = new THREE.Group();
  group.add(makeGround(maxAnisotropy), s.group);
  return { group, reveal: s.reveal };
}
