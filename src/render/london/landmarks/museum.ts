import * as THREE from 'three';
import { MUSEUM } from '../../../sim/londonLayout';
import { box, cone, extrude, inked, PALETTE, sphere, windows, type LandmarkBuild } from './kit';

/**
 * The Natural History Museum: a long cathedral of a front in buff terracotta striped with blue-grey
 * bands, rows of round-topped windows, end pavilions with pyramid roofs, and two tall central towers
 * with pointed slate spires either side of a big arched door. The fun bit: a giant long-necked
 * dinosaur skeleton has broken out through the roof. Its ribcage sits on the ridge, and its neck rises
 * between the towers with a toothy skull on top. Alive: the neck slowly sways, looking around.
 */

const W = MUSEUM.w; // 16, east-west
const D = MUSEUM.d; // 7, north-south
const FRONT = D / 2; // the south face (toward the camera)
const MAIN_H = 5.2;
const PAV_H = 6.4;
const TOWER_H = 10.5;
const RIDGE = 1.6;

const BUFF = 0xe6b088;
const BAND = 0x6f88a8;
const ROOF = PALETTE.slate;
const WINDOW = 0x34465e;
const DOOR = 0x3b2a20;
const BONE = 0xf4ecd6;
const SOCKET = 0x3b2a20;

/** A block in buff terracotta striped with blue-grey bands, standing on y. */
function banded(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const buff = 0.78;
  const band = 0.2;
  let at = 0;
  while (at < h - 0.01) {
    const b = Math.min(buff, h - at);
    out.push(box(w, b, d, BUFF, x, y + at, z));
    at += b;
    if (at >= h - 0.01) break;
    const s = Math.min(band, h - at);
    out.push(box(w + 0.06, s, d + 0.06, BAND, x, y + at, z)); // a hair proud, so it reads as a stripe
    at += s;
  }
  return out;
}

/** A square-based pyramid roof hw × hd (half sizes) and h tall, standing on y. */
function pyramid(hw: number, hd: number, h: number, color: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const s = Math.SQRT1_2;
  return cone(1, h, color, 0, 0, 0, 4).rotateY(Math.PI / 4).scale(hw / s, 1, hd / s).translate(x, y, z);
}

/** A round-topped arch shape (x across, y up) w wide and h tall, its base at (0, 0). */
function archShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return s;
}

/** A kit-shaped tube (a rib) bent along an arc: radius r, tube thickness t, spanning `arc` radians in the XY plane. */
function rib(r: number, t: number, arc: number, color: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, t, 5, 10, arc).toNonIndexed();
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function build(): LandmarkBuild {
  const parts: THREE.BufferGeometry[] = [];
  const towerX = 2.3;
  const towerS = 2.1;
  const pavW = 2.6;
  const pavX = W / 2 - pavW / 2;

  // The long main block and its slate ridge roof (running east-west).
  parts.push(...banded(W - 0.2, MAIN_H, D, 0, 0, 0));
  const ridge = new THREE.Shape();
  ridge.moveTo(-D / 2, 0);
  ridge.lineTo(D / 2, 0);
  ridge.lineTo(0, RIDGE);
  ridge.lineTo(-D / 2, 0);
  parts.push(extrude(ridge, W - 2 * pavW, ROOF, 0, MAIN_H, 0, Math.PI / 2));

  // The end pavilions: taller, a touch proud, with pyramid roofs.
  for (const s of [-1, 1]) {
    const x = s * pavX;
    parts.push(...banded(pavW, PAV_H, D + 0.5, x, 0, 0));
    parts.push(pyramid(pavW / 2 + 0.15, (D + 0.5) / 2 + 0.15, 1.8, ROOF, x, PAV_H, 0));
    parts.push(windows({ cols: 2, rows: 3, cellW: 1.05, cellH: 2.0, winW: 0.55, winH: 1.25, color: WINDOW, x, y: 0.5, z: FRONT + 0.25, arched: true }));
    // The wing between pavilion and tower: two rows of tall arched windows.
    const wingX = s * ((towerX + towerS / 2 + pavX - pavW / 2) / 2);
    parts.push(windows({ cols: 2, rows: 2, cellW: 1.05, cellH: 2.2, winW: 0.6, winH: 1.5, color: WINDOW, x: wingX, y: 0.5, z: FRONT, arched: true }));
  }
  // Two arched windows down each side (the east and west ends) so the corners read from an angle.
  for (const s of [-1, 1]) {
    parts.push(windows({ cols: 3, rows: 3, cellW: 2.0, cellH: 2.0, winW: 0.55, winH: 1.25, color: WINDOW, x: s * (W / 2 + 0.01), y: 0.5, z: 0, rotY: s * Math.PI / 2, arched: true }));
  }

  // The twin towers with pinnacles and tall pointy spires.
  for (const s of [-1, 1]) {
    const x = s * towerX;
    const z = FRONT - towerS / 2 + 0.25;
    parts.push(...banded(towerS, TOWER_H, towerS, x, 0, z));
    parts.push(windows({ cols: 1, rows: 3, cellW: 1, cellH: 2.2, winW: 0.6, winH: 1.4, color: WINDOW, x, y: 3.2, z: z + towerS / 2, arched: true }));
    parts.push(windows({ cols: 2, rows: 1, cellW: 0.8, cellH: 1.4, winW: 0.42, winH: 1.1, color: WINDOW, x: x + s * (towerS / 2), y: TOWER_H - 1.8, z, rotY: s * Math.PI / 2, arched: true }));
    parts.push(box(towerS + 0.3, 0.3, towerS + 0.3, BAND, x, TOWER_H, z)); // cornice
    parts.push(pyramid(towerS / 2 + 0.05, towerS / 2 + 0.05, 4.6, ROOF, x, TOWER_H + 0.3, z));
    parts.push(sphere(0.18, PALETTE.gold, x, TOWER_H + 5.0, z, 8, 6));
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      parts.push(pyramid(0.2, 0.2, 1.0, ROOF, x + dx * towerS / 2, TOWER_H + 0.3, z + dz * towerS / 2));
    }
  }

  // The big arched entrance between the towers, under a buff gable with a blue band.
  const gable = new THREE.Shape();
  const gw = 2 * towerX - towerS + 0.1;
  gable.moveTo(-gw / 2, 0);
  gable.lineTo(gw / 2, 0);
  gable.lineTo(gw / 2, MAIN_H + 0.6);
  gable.lineTo(0, MAIN_H + 2.0);
  gable.lineTo(-gw / 2, MAIN_H + 0.6);
  gable.lineTo(-gw / 2, 0);
  parts.push(extrude(gable, 0.8, BUFF, 0, 0, FRONT + 0.15));
  parts.push(extrude(archShape(2.2, 3.6), 0.12, BAND, 0, 0, FRONT + 0.58)); // the stepped surround
  parts.push(extrude(archShape(1.7, 3.2), 0.12, DOOR, 0, 0, FRONT + 0.66)); // the dark doorway
  parts.push(box(2.8, 0.25, 1.2, PALETTE.stone, 0, 0, FRONT + 0.9)); // the front step
  parts.push(windows({ cols: 1, rows: 1, cellW: 1, cellH: 1, winW: 0.7, winH: 0.7, color: WINDOW, x: 0, y: MAIN_H + 0.3, z: FRONT + 0.56 }));

  // ---- the dinosaur, lying north-south on the roof of the east wing (between the east tower and the
  // east pavilion): its ribcage on the roof, its tail draped over the pavilion, its neck rising out
  // over the front with the skull grinning down at the street.
  const spineY = MAIN_H + RIDGE + 0.6;
  const dinoX = (towerX + towerS / 2 + pavX - pavW / 2) / 2;
  const shoulderZ = 0.6;
  const hipZ = -2.6;
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    const z = shoulderZ + (hipZ - shoulderZ) * k;
    const y = spineY + Math.sin(k * Math.PI) * 0.4 - k * 0.9; // a gentle arch, sloping down with the roof
    parts.push(sphere(0.34, BONE, dinoX, y, z, 8, 6));
    parts.push(cone(0.15, 0.5, BONE, dinoX, y + 0.2, z, 5)); // the bumps along the back
    if (i >= 1 && i <= 7) {
      const r = 0.95 + Math.sin(k * Math.PI) * 0.4;
      parts.push(rib(r, 0.14, Math.PI, BONE).translate(dinoX, y - r + 0.05, z));
    }
  }
  // The hips, and a tail arching over the pavilion roof and drooping off the east end.
  parts.push(sphere(0.6, BONE, dinoX, spineY - 0.75, hipZ - 0.3, 10, 8));
  const tail = new THREE.CubicBezierCurve3(
    new THREE.Vector3(dinoX + 0.3, spineY - 0.6, hipZ - 0.6),
    new THREE.Vector3(dinoX + 2.4, spineY + 1.2, hipZ - 0.6),
    new THREE.Vector3(W / 2 + 0.2, spineY + 0.6, hipZ + 0.2),
    new THREE.Vector3(W / 2 + 0.7, MAIN_H - 1.4, hipZ + 1.2),
  );
  for (let i = 0; i <= 12; i++) {
    const p = tail.getPoint(i / 12);
    parts.push(sphere(0.36 - (i / 12) * 0.24, BONE, p.x, p.y, p.z, 8, 6));
  }

  const group = new THREE.Group();
  group.add(inked(parts, 0.1));

  // ---- the neck and skull: their own group, pivoting at the shoulders
  const neck: THREE.BufferGeometry[] = [];
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.2, 3.4, 0.0),
    new THREE.Vector3(1.9, 5.6, 0.6),
    new THREE.Vector3(2.7, 4.7, 2.5),
  );
  const N = 15;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const p = curve.getPoint(k);
    neck.push(sphere(0.55 - k * 0.22, BONE, p.x, p.y, p.z, 8, 6));
    if (i < N) neck.push(cone(0.13, 0.42, BONE, p.x, p.y + 0.3 - k * 0.1, p.z, 5));
  }
  // The skull: a rounded cranium, a long snout, big dark eye sockets and a toothy grin, chin up.
  const head = new THREE.Vector3(2.75, 4.4, 2.85);
  const skull: THREE.BufferGeometry[] = [
    sphere(0.5, BONE, 0, 0.1, 0, 10, 8),
    box(0.7, 0.4, 1.3, BONE, 0, -0.18, 0.65),
    box(0.6, 0.14, 1.15, BONE, 0, -0.42, 0.6), // the jaw
    sphere(0.2, SOCKET, -0.27, 0.3, 0.3, 8, 6),
    sphere(0.2, SOCKET, 0.27, 0.3, 0.3, 8, 6),
    sphere(0.08, SOCKET, -0.16, 0.12, 1.22, 6, 4), // nostrils
    sphere(0.08, SOCKET, 0.16, 0.12, 1.22, 6, 4),
  ];
  for (let i = 0; i < 6; i++) {
    for (const s of [-1, 1]) skull.push(box(0.08, 0.13, 0.08, 0xffffff, s * 0.27, -0.3, 0.3 + i * 0.18));
  }
  for (const g of skull) {
    g.rotateX(-0.55); // chin up: grinning at the camera
    g.rotateY(-0.35); // and turned back toward the middle of the street
    g.scale(1.75, 1.75, 1.75);
    g.translate(head.x, head.y, head.z);
    neck.push(g);
  }
  const neckGroup = inked(neck, 0.08);
  neckGroup.position.set(dinoX, spineY + 0.1, shoulderZ + 0.2);
  group.add(neckGroup);

  return {
    group,
    tall: true,
    labelY: TOWER_H + 7.5,
    animate: (t) => {
      // Look left… look right… with a little bob, like it's checking the traffic.
      neckGroup.rotation.y = Math.sin(t * 0.55) * 0.32;
      neckGroup.rotation.x = Math.sin(t * 1.1) * 0.05;
      neckGroup.rotation.z = Math.sin(t * 0.55 + 0.6) * 0.06;
    },
  };
}
