import * as THREE from 'three';
import { GLOBE } from '../../../sim/londonLayout';
import { box, cyl, inked, lathe, merge, PALETTE, toonMesh, type LandmarkBuild } from './kit';

/**
 * Shakespeare's Globe: the round (twenty-sided) wooden O. White plaster walls criss-crossed with dark
 * timber, a thick golden thatch ring on top, and open to the sky in the middle: from the chase camera
 * you look down into the yard and see the little stage with its red canopy. Alive: a flag on a pole
 * above the stage house flutters in the wind.
 */

const SIDES = 20;
const R = GLOBE.r; // 4: the outer wall sits on the footprint
const R_IN = 2.55; // the yard's edge
const WALL = 4.0; // three galleries
const FLOORS = 3;
const POLE = 2.4; // the flagpole on the stage house

const PLASTER = 0xfbf7ec;
const TIMBER = 0x6e4a2f;
const THATCH = 0xdcae55;
const THATCH_DARK = 0x9c7536;
const YARD = 0xc9ac78;
const RED = 0xc8302a;

/** A thin timber beam `len` long and `thick` wide, centred on (x, y, z), tilted `tilt` in its wall's plane, on a wall facing `phi`. */
function beam(len: number, thick: number, x: number, y: number, z: number, phi: number, tilt = 0): THREE.BufferGeometry {
  const g = box(thick, len, 0.1, TIMBER);
  g.translate(0, -len / 2, 0);
  if (tilt) g.rotateZ(tilt);
  g.rotateY(phi);
  g.translate(x, y, z);
  return g;
}

export function build(): LandmarkBuild {
  const parts: THREE.BufferGeometry[] = [];
  const timber: THREE.BufferGeometry[] = []; // drawn without ink: thin dark lines on the plaster
  const step = (Math.PI * 2) / SIDES;
  // Lathe vertices sit at angles k·step; the flat faces between them face (k + ½)·step.
  const ring = lathe([[R, 0], [R, WALL], [R_IN, WALL], [R_IN, 0], [R, 0]], PLASTER, 0, 0, 0, SIDES);
  parts.push(ring);

  // Timber framing on the outside: corner posts, a beam under each gallery, an X in every panel.
  const apo = R * Math.cos(step / 2) + 0.05; // a face's distance from the centre
  const faceW = 2 * R * Math.sin(step / 2);
  const floorH = WALL / FLOORS;
  for (let k = 0; k < SIDES; k++) {
    const corner = k * step;
    const phi = (k + 0.5) * step;
    const fx = Math.sin(phi) * apo;
    const fz = Math.cos(phi) * apo;
    timber.push(beam(WALL, 0.15, Math.sin(corner) * (R + 0.05), WALL / 2, Math.cos(corner) * (R + 0.05), corner));
    for (let f = 0; f <= FLOORS; f++) {
      const y = Math.min(WALL - 0.08, Math.max(0.08, f * floorH));
      timber.push(beam(faceW, 0.12, fx, y, fz, phi, Math.PI / 2));
    }
    // One diagonal brace per panel, leaning alternately, on every other floor: half-timbering.
    const diag = Math.atan2(faceW * 0.9, floorH * 0.9);
    const len = Math.hypot(faceW * 0.9, floorH * 0.9);
    for (let f = 0; f < FLOORS; f++) {
      if ((k + f) % 2) continue;
      timber.push(beam(len, 0.09, fx, f * floorH + floorH / 2, fz, phi, (k % 4 < 2 ? 1 : -1) * diag));
    }
    // The yard side: plain posts between the gallery openings, and a dark gallery band per floor.
    timber.push(beam(WALL, 0.18, Math.sin(corner) * (R_IN - 0.05), WALL / 2, Math.cos(corner) * (R_IN - 0.05), corner + Math.PI));
    for (let f = 0; f < FLOORS; f++) {
      const ia = R_IN * Math.cos(step / 2) - 0.05;
      timber.push(beam(faceW * 0.8, floorH * 0.45, Math.sin(phi) * ia, f * floorH + floorH * 0.55, Math.cos(phi) * ia, phi + Math.PI, Math.PI / 2));
    }
  }

  // The thatch: a thick, rounded straw ring that overhangs both walls, with a darker drip edge.
  parts.push(lathe([
    [R + 0.3, WALL - 0.1], [R + 0.38, WALL + 0.3], [R + 0.1, WALL + 0.9], [R - 0.5, WALL + 1.45],
    [R - 0.9, WALL + 1.5], [R_IN + 0.3, WALL + 1.05], [R_IN - 0.25, WALL + 0.3], [R_IN - 0.25, WALL - 0.1],
    [R + 0.3, WALL - 0.1],
  ], THATCH, 0, 0, 0, SIDES * 2));
  parts.push(lathe([[R + 0.36, WALL - 0.2], [R + 0.4, WALL + 0.02], [R_IN - 0.3, WALL + 0.02], [R_IN - 0.3, WALL - 0.2], [R + 0.36, WALL - 0.2]], THATCH_DARK, 0, 0, 0, SIDES));

  // The yard (the groundlings' standing room) and the stage on the north side, facing the camera.
  parts.push(cyl(R_IN, R_IN, 0.06, YARD, 0, 0, 0, SIDES));
  const sz = -R_IN + 0.75;
  parts.push(box(2.6, 0.7, 1.5, TIMBER, 0, 0, sz)); // the stage
  parts.push(box(2.6, 0.08, 1.5, 0xd8b27a, 0, 0.7, sz)); // its boards
  parts.push(box(3.0, 2.7, 0.3, RED, 0, 0, -R_IN + 0.05)); // the painted back wall
  for (const dx of [-0.95, 0.95]) {
    parts.push(box(0.6, 1.2, 0.08, 0x3a2416, dx, 0.7, -R_IN + 0.22)); // the two doors
    parts.push(cyl(0.1, 0.12, 1.9, 0xf0e2c0, dx, 0.7, sz + 0.55, 8)); // the pillars
  }
  // The red canopy ("the heavens") with a gold crest, and the stage house behind.
  parts.push(box(3.0, 0.1, 2.0, PALETTE.gold, 0, 2.5, sz - 0.1)); // gold trim
  parts.push(box(2.9, 0.25, 1.9, RED, 0, 2.6, sz - 0.1));
  parts.push(box(1.2, 0.5, 0.9, PALETTE.gold, 0, 2.85, sz - 0.1)); // a gilded crest on top
  parts.push(box(2.6, 1.9, 1.8, PLASTER, 0, WALL + 0.6, -R + 0.9)); // the stage house (the "hut")
  parts.push(box(2.9, 0.4, 2.1, THATCH, 0, WALL + 2.5, -R + 0.9));
  // The flagpole on the hut.
  const poleY = WALL + 2.9;
  const poleZ = -R + 0.9;
  parts.push(cyl(0.07, 0.09, POLE, 0x6b4a2e, 0, poleY, poleZ, 6));

  const group = new THREE.Group();
  group.add(inked(parts, 0.08));
  group.add(toonMesh(merge(timber)));

  // The flag: a little cloth grid that ripples. Red and white, the theatre's own pennant.
  const FW = 1.9, FH = 1.1, NX = 10, NY = 4;
  const flagGeo = new THREE.PlaneGeometry(FW, FH, NX, NY).toNonIndexed();
  flagGeo.translate(FW / 2, 0, 0);
  flagGeo.deleteAttribute('uv');
  const fpos = flagGeo.getAttribute('position');
  const fcol = new Float32Array(fpos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < fpos.count; i += 3) {
    const cy = (fpos.getY(i) + fpos.getY(i + 1) + fpos.getY(i + 2)) / 3;
    const cx = (fpos.getX(i) + fpos.getX(i + 1) + fpos.getX(i + 2)) / 3;
    // A white flag with a red cross.
    const cross = Math.abs(cy) < FH * 0.14 || Math.abs(cx - FW * 0.4) < FW * 0.08;
    c.setHex(cross ? 0xd62d20 : 0xffffff);
    for (let k = 0; k < 3; k++) fcol.set([c.r, c.g, c.b], (i + k) * 3);
  }
  flagGeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const flag = toonMesh(flagGeo, { castShadow: false });
  (flag.material as THREE.Material).side = THREE.DoubleSide;
  flag.position.set(0.08, poleY + POLE - FH / 2 - 0.05, poleZ);
  flag.rotation.y = -0.35; // streaming east, angled a touch toward the camera
  group.add(flag);
  const rest = Float32Array.from(fpos.array as Float32Array);

  return {
    group,
    tall: false,
    labelY: WALL + 7,
    animate: (t) => {
      const arr = fpos.array as Float32Array;
      for (let i = 0; i < fpos.count; i++) {
        const x = rest[i * 3];
        const y = rest[i * 3 + 1];
        const k = x / FW; // the free end flaps most
        arr[i * 3 + 2] = Math.sin(x * 3.2 - t * 7) * 0.22 * k;
        arr[i * 3 + 1] = y + Math.sin(x * 2.4 - t * 5) * 0.06 * k;
      }
      fpos.needsUpdate = true;
      flagGeo.computeVertexNormals();
    },
  };
}
