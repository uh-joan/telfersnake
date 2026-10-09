import * as THREE from 'three';
import type { StageId } from '../sim/stage';
import { makeCommon } from './common';
import { makeGround } from './ground';
import { makeLondon } from './london/london';
import { makeSchool, type School } from './school';

/**
 * The ground + fixed scenery for a stage, as one swappable group with a `reveal` for the buildings
 * that occlude the snake. The school keeps its ground and scenery as two pieces; the Common and
 * London bundle their own. Same `School` shape either way, so the renderer treats them alike.
 */
export function makeStageScene(id: StageId, maxAnisotropy: number, maxTextureSize = 4096): School {
  if (id === 'common') return makeCommon(maxAnisotropy);
  if (id === 'london') return makeLondon(maxAnisotropy, maxTextureSize);
  const s = makeSchool();
  const group = new THREE.Group();
  group.add(makeGround(maxAnisotropy), s.group);
  return { group, reveal: s.reveal };
}
