import * as THREE from 'three';
import { BIG_BEN, PARLIAMENT } from '../../../sim/londonLayout';
import { box, cone, cyl, extrude, inked, INK, merge, PALETTE, rel, sphere, toonMesh, windows, type LandmarkBuild } from './kit';

/**
 * Big Ben + the Houses of Parliament. The Elizabeth Tower is the star: a slender honey-gold shaft
 * ribbed with gothic piers, four big glowing white clock faces in gold frames (their black hands
 * really go round: the minute hand once a minute), an open belfry, and a steep slate spire with gold
 * pinnacles. West of it the long Parliament: buttresses and pinnacles all along the roofline, rows of
 * arched windows, a slate roof, the little Central Tower spire and Victoria Tower at the far end.
 *
 * Draw calls: stone body + ink hull, the glowing dials, the instanced hands (4).
 */

const HONEY_DARK = 0xc4973f;
const WINDOW = 0x3c3a52;
const SPIRE = 0x434a57;

const T = rel('bigben', BIG_BEN.x, BIG_BEN.z);
const P = rel('bigben', PARLIAMENT.x, PARLIAMENT.z);

/** Each face of the tower: 0 faces south (the camera), then east, north, west. */
const FACES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/** Build one face's parts facing +z round the tower's own axis, then copy them onto all four faces. */
function allFaces(out: THREE.BufferGeometry[], make: () => THREE.BufferGeometry[]): void {
  for (const yaw of FACES) for (const g of make()) out.push(g.rotateY(yaw).translate(T.x, 0, T.z));
}

/** A square pyramid of half-width hw standing on y (a cone with its corners turned to the box's corners). */
const pyramid = (hw: number, h: number, color: number, x: number, y: number, z: number) =>
  cone(hw * Math.SQRT2, h, color, 0, 0, 0, 4).rotateY(Math.PI / 4).translate(x, y, z);

const DIAL_Y = 16.1;
const DIAL_R = 1.85;
const STAGE = 2.5; // the clock stage's half-width (it overhangs the 4 m shaft)

export function build(): LandmarkBuild {
  const stone: THREE.BufferGeometry[] = [];
  const dials: THREE.BufferGeometry[] = [];

  // ---- the Elizabeth Tower
  const S = BIG_BEN.w / 2; // 2
  const SHAFT = 13.6;
  stone.push(
    box(BIG_BEN.w + 0.4, 1.0, BIG_BEN.d + 0.4, HONEY_DARK, T.x, 0, T.z),
    box(BIG_BEN.w, SHAFT, BIG_BEN.d, PALETTE.honey, T.x, 0, T.z),
    box(BIG_BEN.w + 0.3, 0.22, BIG_BEN.d + 0.3, PALETTE.gold, T.x, SHAFT - 0.22, T.z),
  );
  allFaces(stone, () => {
    const p: THREE.BufferGeometry[] = [];
    // Vertical gothic piers, a fat one at the corner, and the arched lancets between them.
    for (let i = -2; i <= 2; i++) p.push(box(0.18, SHAFT - 1.4, 0.14, HONEY_DARK, i * 0.8, 1.0, S + 0.07));
    p.push(box(0.5, SHAFT + 0.2, 0.5, HONEY_DARK, S - 0.05, 0, S - 0.05));
    p.push(windows({ cols: 4, rows: 7, cellW: 0.8, cellH: 1.6, winW: 0.38, winH: 1.0, color: WINDOW, x: 0, y: 1.4, z: S }));
    // The clock stage face: a gold square frame, the black ring, twelve black hour marks.
    p.push(box(4.5, 4.5, 0.1, PALETTE.gold, 0, DIAL_Y - 2.25, STAGE));
    p.push(cyl(DIAL_R + 0.18, DIAL_R + 0.18, 0.1, INK, 0, 0, 0, 32).rotateX(Math.PI / 2).translate(0, DIAL_Y, STAGE + 0.05));
    for (let h = 0; h < 12; h++) {
      const long = h % 3 === 0;
      p.push(
        box(long ? 0.16 : 0.1, long ? 0.42 : 0.28, 0.05, INK, 0, -0.14, 0)
          .translate(0, DIAL_R - 0.3, 0)
          .rotateZ((h / 12) * Math.PI * 2)
          .translate(0, DIAL_Y, STAGE + 0.25),
      );
    }
    p.push(sphere(0.14, PALETTE.gold, 0, DIAL_Y, STAGE + 0.3, 8, 6));
    // Little gold pinnacles at the clock stage's corners.
    p.push(cyl(0.18, 0.18, 0.5, PALETTE.honey, STAGE - 0.15, 18.5, STAGE - 0.15, 6), cone(0.22, 1.1, PALETTE.gold, STAGE - 0.15, 19.0, STAGE - 0.15, 6));
    // The belfry: three tall open arches on each side.
    p.push(windows({ cols: 3, rows: 1, cellW: 1.25, cellH: 2.2, winW: 0.75, winH: 1.8, color: 0x2a2433, x: 0, y: 18.75, z: 2.1, arched: true }));
    p.push(cyl(0.24, 0.24, 2.8, HONEY_DARK, 2.1, 18.7, 2.1, 6), cone(0.3, 1.5, PALETTE.gold, 2.1, 21.5, 2.1, 6));
    // A gold dormer on each face of the spire.
    p.push(box(0.55, 0.9, 0.3, PALETTE.gold, 0, 23.0, 1.25), pyramid(0.3, 0.6, PALETTE.gold, 0, 23.9, 1.25));
    return p;
  });
  // The dials themselves: glowing white, their own mesh.
  for (const yaw of FACES) {
    dials.push(cyl(DIAL_R, DIAL_R, 0.1, PALETTE.clockWhite, 0, 0, 0, 32).rotateX(Math.PI / 2).translate(0, DIAL_Y, STAGE + 0.12).rotateY(yaw).translate(T.x, 0, T.z));
  }
  stone.push(
    box(STAGE * 2, 4.9, STAGE * 2, PALETTE.honey, T.x, SHAFT, T.z), // the clock stage
    box(STAGE * 2 + 0.3, 0.3, STAGE * 2 + 0.3, PALETTE.gold, T.x, SHAFT + 4.9, T.z),
    box(4.2, 2.6, 4.2, PALETTE.honey, T.x, 18.7, T.z), // the belfry
    box(4.6, 0.3, 4.6, PALETTE.gold, T.x, 21.2, T.z),
    pyramid(2.25, 6.6, SPIRE, T.x, 21.5, T.z), // the spire
    box(1.2, 0.2, 1.2, PALETTE.gold, T.x, 25.1, T.z),
    sphere(0.32, PALETTE.gold, T.x, 28.2, T.z, 10, 8),
    cone(0.13, 1.4, PALETTE.gold, T.x, 28.3, T.z, 6),
    box(0.7, 0.12, 0.12, PALETTE.gold, T.x, 29.1, T.z),
  );

  // ---- the Houses of Parliament
  const W = PARLIAMENT.w - 0.4; // 11.6
  const D = PARLIAMENT.d - 0.4; // 7.6
  const H = 5.2;
  const front = P.z + D / 2;
  const westX = P.x - W / 2;
  const eastX = P.x + W / 2;
  stone.push(
    box(W + 0.2, 0.6, D + 0.2, HONEY_DARK, P.x, 0, P.z),
    box(W, H, D, PALETTE.honey, P.x, 0, P.z),
    box(W + 0.15, 0.25, D + 0.15, HONEY_DARK, P.x, H - 0.25, P.z),
  );
  const gable = new THREE.Shape();
  gable.moveTo(-D / 2 + 0.3, 0);
  gable.lineTo(D / 2 - 0.3, 0);
  gable.lineTo(0, 2.0);
  gable.closePath();
  stone.push(extrude(gable, W - 0.4, SPIRE, P.x, H, P.z, Math.PI / 2));
  // Buttresses up the south front, each running past the roofline into a pinnacle.
  const bays = 12;
  const bayW = W / bays;
  for (let k = 0; k <= bays; k++) {
    const x = westX + k * bayW;
    for (const [z, dz] of [[front, 1], [P.z - D / 2, -1]] as const) {
      stone.push(box(0.24, H + 0.6, 0.24, HONEY_DARK, x, 0, z + dz * 0.1), cone(0.2, 0.9, PALETTE.honey, x, H + 0.6, z + dz * 0.1, 4));
    }
  }
  for (const z of [P.z - D / 2 + 1.5, P.z - D / 2 + 3.8, P.z + D / 2 - 1.5]) {
    stone.push(box(0.24, H + 0.6, 0.24, HONEY_DARK, eastX + 0.1, 0, z), cone(0.2, 0.9, PALETTE.honey, eastX + 0.1, H + 0.6, z, 4));
  }
  stone.push(windows({ cols: bays, rows: 2, cellW: bayW, cellH: 2.1, winW: 0.45, winH: 1.3, color: WINDOW, x: P.x, y: 0.7, z: front, arched: true }));
  stone.push(windows({ cols: 5, rows: 2, cellW: 0.95, cellH: 2.1, winW: 0.45, winH: 1.3, color: WINDOW, x: eastX, y: 0.7, z: P.z + 1.4, rotY: Math.PI / 2, arched: true }));
  // A gold string-course between the window rows.
  stone.push(box(W + 0.05, 0.12, 0.1, PALETTE.gold, P.x, 2.7, front + 0.02));

  // The Central Tower: an octagonal lantern and a slim spire over the middle of the roof.
  const cx = P.x + 0.5;
  stone.push(
    cyl(1.15, 1.25, 3.4, PALETTE.honey, cx, H + 0.6, P.z, 8),
    windows({ cols: 1, rows: 1, cellW: 1, cellH: 2.2, winW: 0.45, winH: 1.5, color: WINDOW, x: cx, y: H + 1.3, z: P.z + 1.12, arched: true }),
    cyl(1.3, 1.3, 0.2, PALETTE.gold, cx, H + 4.0, P.z, 8),
    cone(1.2, 3.8, SPIRE, cx, H + 4.2, P.z, 8),
    cone(0.12, 0.9, PALETTE.gold, cx, H + 7.9, P.z, 6),
  );

  // Victoria Tower: the big square tower at the far (west) end, corner turrets and a gold crown.
  const vx = westX + 1.9;
  const vz = front - 1.9;
  const VH = 12;
  stone.push(box(3.4, VH, 3.4, PALETTE.honey, vx, 0, vz), box(3.6, 0.25, 3.6, PALETTE.gold, vx, VH - 0.3, vz), pyramid(1.5, 1.2, SPIRE, vx, VH, vz));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    stone.push(cyl(0.35, 0.35, VH + 1.4, HONEY_DARK, vx + sx * 1.65, 0, vz + sz * 1.65, 8), cone(0.42, 1.4, PALETTE.gold, vx + sx * 1.65, VH + 1.4, vz + sz * 1.65, 8));
  }
  for (let i = -1; i <= 1; i += 2) stone.push(box(0.16, VH - 2, 0.12, HONEY_DARK, vx + i * 0.55, 1.2, vz + 1.76));
  stone.push(windows({ cols: 3, rows: 4, cellW: 0.55, cellH: 2.2, winW: 0.3, winH: 1.4, color: WINDOW, x: vx, y: 2.2, z: vz + 1.7, arched: true }));
  stone.push(windows({ cols: 1, rows: 1, cellW: 1.4, cellH: 2.6, winW: 1.2, winH: 2.4, color: 0x2a2433, x: vx, y: 0, z: vz + 1.71, arched: true }));
  stone.push(cyl(0.06, 0.06, 2.2, PALETTE.white, vx, VH + 1.0, vz, 6));

  const group = new THREE.Group();
  group.add(inked(stone, 0.1));
  group.add(toonMesh(merge(dials), { glow: 0.55, castShadow: false }));

  // ---- the hands: one instanced mesh, a minute and an hour hand on each of the four dials.
  const handGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.38, 0); // pivots near its tail
  const hands = new THREE.InstancedMesh(handGeo, new THREE.MeshBasicMaterial({ color: INK }), 8);
  hands.castShadow = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qz = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const setHands = (t: number) => {
    const minute = (t / 60 + 10 / 60) * Math.PI * 2; // starts at ten past, one turn a minute
    const hour = (10 + t / 60) / 12 * Math.PI * 2;
    FACES.forEach((yaw, f) => {
      for (let k = 0; k < 2; k++) {
        const isMin = k === 0;
        q.setFromAxisAngle(Y, yaw).multiply(qz.setFromAxisAngle(Z, -(isMin ? minute : hour)));
        p.set(0, DIAL_Y, STAGE + (isMin ? 0.36 : 0.3)).applyAxisAngle(Y, yaw);
        p.x += T.x;
        p.z += T.z;
        s.set(isMin ? 0.13 : 0.2, isMin ? 1.7 : 1.15, 0.05);
        hands.setMatrixAt(f * 2 + k, m.compose(p, q, s));
      }
    });
    hands.instanceMatrix.needsUpdate = true;
  };
  setHands(0);
  hands.computeBoundingBox();
  hands.computeBoundingSphere();
  group.add(hands);

  return { group, labelY: 31, animate: (t) => setHands(t) };
}
