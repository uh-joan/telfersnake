import * as THREE from 'three';
import {
  BOUNDS, CAR_PARK, COURT, GREEN, HOPSCOTCH, LAGOON, LANES, LOOP_TRACK, TARGET, TOP_PLAYGROUND,
} from '../sim/layout';
import { Rng } from '../sim/rng';

/** Side of the painted square, in metres and in pixels. */
const WORLD = 150;
const PIXELS = 2048;
const S = PIXELS / WORLD;
const px = (x: number) => (x + WORLD / 2) * S;
const pz = (z: number) => (z + WORLD / 2) * S;

const HOP_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4dabf7', '#f78fb3', '#ffa94d', '#b197fc', '#63e6be'];

/**
 * The whole ground plan (tarmac, court, lagoon, grass, every painted line) is drawn once
 * into a canvas and shown on a single plane: one draw call, plenty of playground detail.
 */
export function makeGround(maxAnisotropy: number): THREE.Group {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PIXELS;
  const c = canvas.getContext('2d')!;
  const rng = new Rng(7);

  const rect = (x0: number, z0: number, x1: number, z1: number, fill: string) => {
    c.fillStyle = fill;
    c.fillRect(px(x0), pz(z0), (x1 - x0) * S, (z1 - z0) * S);
  };
  const line = (x0: number, z0: number, x1: number, z1: number, color: string, width: number, dash?: number[]) => {
    c.strokeStyle = color;
    c.lineWidth = width * S;
    c.setLineDash((dash ?? []).map((d) => d * S));
    c.beginPath();
    c.moveTo(px(x0), pz(z0));
    c.lineTo(px(x1), pz(z1));
    c.stroke();
    c.setLineDash([]);
  };
  const boxOf = (b: { x: number; z: number; w: number; d: number }) =>
    [b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2] as const;

  // Pavements, then the three roads that frame the school.
  rect(-WORLD / 2, -WORLD / 2, WORLD / 2, WORLD / 2, '#a9adb3');
  rect(-52, -75, -42, 75, '#5d626b');
  rect(42, -75, 52, 75, '#5d626b');
  rect(-42, 44, 42, 52, '#5d626b');
  line(-47, -75, -47, 75, '#e8e8e8', 0.15, [2, 3]);
  line(47, -75, 47, 75, '#e8e8e8', 0.15, [2, 3]);
  line(-42, 48, 42, 48, '#e8e8e8', 0.15, [2, 3]);

  // School tarmac, speckled so it does not read as flat grey.
  rect(BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX, BOUNDS.maxZ, '#7c818b');
  rect(...boxOf(TOP_PLAYGROUND), '#858a94');
  rect(...boxOf(CAR_PARK), '#8d9199');
  for (let i = 0; i < 7000; i++) {
    const x = rng.range(BOUNDS.minX, BOUNDS.maxX);
    const z = rng.range(BOUNDS.minZ, BOUNDS.maxZ);
    c.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    c.fillRect(px(x), pz(z), rng.range(1, 4), rng.range(1, 4));
  }

  // Car park bays
  for (let x = 14; x <= 37; x += 2.6) line(x, 33.5, x, 39.5, '#e8e8e8', 0.1);

  // Amphitheatre steps curling round the south of the loop track
  for (let k = 0; k < 3; k++) {
    c.strokeStyle = ['#9b9083', '#a79c8e', '#b3a899'][k];
    c.lineWidth = 0.9 * S;
    c.beginPath();
    c.ellipse(px(LOOP_TRACK.x), pz(LOOP_TRACK.z), (LOOP_TRACK.rx + 3.5 + k) * S, (LOOP_TRACK.rz + 3.5 + k) * S, 0, Math.PI * 0.12, Math.PI * 0.88);
    c.stroke();
  }

  // Painted loop "road" track
  const loop = (grow: number, color: string, width: number, dash: number[] = []) => {
    c.strokeStyle = color;
    c.lineWidth = width * S;
    c.setLineDash(dash.map((d) => d * S));
    c.beginPath();
    c.ellipse(px(LOOP_TRACK.x), pz(LOOP_TRACK.z), (LOOP_TRACK.rx + grow) * S, (LOOP_TRACK.rz + grow) * S, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  };
  loop(0, '#4f545c', 2.2);
  loop(1.1, '#f1f1f1', 0.12);
  loop(-1.1, '#f1f1f1', 0.12);
  loop(0, '#ffd84a', 0.12, [0.8, 0.8]);

  // The Cage: turquoise court with white markings
  const [cx0, cz0, cx1, cz1] = boxOf(COURT);
  rect(cx0, cz0, cx1, cz1, '#55c8d6');
  c.strokeStyle = '#f4fbfc';
  c.lineWidth = 0.14 * S;
  c.strokeRect(px(cx0 + 1), pz(cz0 + 1), (COURT.w - 2) * S, (COURT.d - 2) * S);
  line(cx0 + 1, COURT.z, cx1 - 1, COURT.z, '#f4fbfc', 0.14);
  c.beginPath();
  c.arc(px(COURT.x), pz(COURT.z), 2.4 * S, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(px(COURT.x), pz(cz0 + 1), 4 * S, 0, Math.PI);
  c.stroke();
  c.beginPath();
  c.arc(px(COURT.x), pz(cz1 - 1), 4 * S, Math.PI, Math.PI * 2);
  c.stroke();

  // Blue Lagoon soft-play blob
  c.fillStyle = '#3d8fe6';
  c.beginPath();
  c.ellipse(px(LAGOON.x), pz(LAGOON.z), LAGOON.rx * S, LAGOON.rz * S, LAGOON.rot, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#6fb2f5';
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 0.85;
    const lx = Math.cos(a) * LAGOON.rx * r;
    const lz = Math.sin(a) * LAGOON.rz * r;
    const x = LAGOON.x + lx * Math.cos(LAGOON.rot) - lz * Math.sin(LAGOON.rot);
    const z = LAGOON.z + lx * Math.sin(LAGOON.rot) + lz * Math.cos(LAGOON.rot);
    c.beginPath();
    c.arc(px(x), pz(z), 0.28 * S, 0, Math.PI * 2);
    c.fill();
  }

  // The Green
  const [gx0, gz0] = boxOf(GREEN);
  c.fillStyle = '#4cc04a';
  c.beginPath();
  c.roundRect(px(gx0), pz(gz0), GREEN.w * S, GREEN.d * S, 2.5 * S);
  c.fill();
  for (let i = 0; i < 500; i++) {
    const x = rng.range(gx0 + 0.5, gx0 + GREEN.w - 0.5);
    const z = rng.range(gz0 + 0.5, gz0 + GREEN.d - 0.5);
    c.fillStyle = rng.next() < 0.5 ? 'rgba(20,110,30,0.25)' : 'rgba(190,255,150,0.25)';
    c.fillRect(px(x), pz(z), 2, 5);
  }
  line(gx0 + 8, gz0, gx0 + 10, gz0 + GREEN.d, 'rgba(230,240,200,0.55)', 0.5);

  // Sprint lanes
  const laneD = (LANES.z1 - LANES.z0) / LANES.count;
  for (let i = 0; i <= LANES.count; i++) {
    line(LANES.x0, LANES.z0 + i * laneD, LANES.x1, LANES.z0 + i * laneD, '#f1f1f1', 0.12);
  }
  line(LANES.x0, LANES.z0, LANES.x0, LANES.z1, '#f1f1f1', 0.25);
  line(LANES.x1, LANES.z0, LANES.x1, LANES.z1, '#ffd84a', 0.25);
  c.fillStyle = '#f1f1f1';
  c.font = `bold ${0.7 * S}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 0; i < LANES.count; i++) c.fillText(String(i + 1), px(LANES.x0 + 1), pz(LANES.z0 + (i + 0.5) * laneD));

  // Hopscotch, numbered away from the player's start
  for (let i = 0; i < HOPSCOTCH.cells; i++) {
    const z = HOPSCOTCH.z0 - i;
    c.fillStyle = HOP_COLORS[i % HOP_COLORS.length];
    c.fillRect(px(HOPSCOTCH.x - 0.5), pz(z - 1), S, S);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 0.08 * S;
    c.strokeRect(px(HOPSCOTCH.x - 0.5), pz(z - 1), S, S);
    c.fillStyle = '#ffffff';
    c.fillText(String(i + 1), px(HOPSCOTCH.x), pz(z - 0.5));
  }

  // Red target grid where lunchbox chests will land
  c.strokeStyle = '#e0524d';
  c.lineWidth = 0.1 * S;
  c.strokeRect(px(TARGET.x - TARGET.size / 2), pz(TARGET.z - TARGET.size / 2), TARGET.size * S, TARGET.size * S);
  line(TARGET.x - TARGET.size / 2, TARGET.z, TARGET.x + TARGET.size / 2, TARGET.z, '#e0524d', 0.1);
  line(TARGET.x, TARGET.z - TARGET.size / 2, TARGET.x, TARGET.z + TARGET.size / 2, '#e0524d', 0.1);
  c.beginPath();
  c.arc(px(TARGET.x), pz(TARGET.z), 0.7 * S, 0, Math.PI * 2);
  c.stroke();

  // --- The Telferscot crest, painted on the tarmac in front of the Old School, in the school's
  // own blue-and-yellow mosaic style (the "TELFER SCOT — 100 Years of Learning" wall badge).
  const crest = (cx: number, cz: number) => {
    const ox = px(cx);
    const oz = pz(cz);
    const mm = (v: number) => v * S;
    const box = (x: number, z: number, w: number, h: number, fill: string, r = 0) => {
      c.fillStyle = fill;
      c.beginPath();
      c.roundRect(ox + mm(x), oz + mm(z), mm(w), mm(h), mm(r));
      c.fill();
    };
    const ribbon = (z: number, w: number, text: string, size: number) => {
      box(-w / 2, z, w, 1.7, '#2f5fc0', 0.85);
      c.fillStyle = '#ffd21f';
      c.font = `900 ${mm(size)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, ox, oz + mm(z + 0.85));
    };

    const side = 5;
    box(-side / 2 - 0.4, -side / 2 - 0.4, side + 0.8, side + 0.8, '#ffcb1f', 0.7); // yellow tile frame
    box(-side / 2, -side / 2, side, side, '#2f5fc0', 0.4); // blue field
    // blocky yellow "T"
    box(-1.7, -1.6, 3.4, 0.95, '#ffd21f');
    box(-0.5, -1.6, 1.0, 3.3, '#ffd21f');
    // faint mosaic tile grid over the badge
    c.strokeStyle = 'rgba(15,30,70,0.28)';
    c.lineWidth = mm(0.06);
    for (let g = -side / 2; g <= side / 2 + 0.01; g += side / 6) {
      c.beginPath();
      c.moveTo(ox + mm(g), oz + mm(-side / 2));
      c.lineTo(ox + mm(g), oz + mm(side / 2));
      c.moveTo(ox + mm(-side / 2), oz + mm(g));
      c.lineTo(ox + mm(side / 2), oz + mm(g));
      c.stroke();
    }
    ribbon(-side / 2 - 2.6, 8, 'TELFERSCOT', 1.1);
    ribbon(side / 2 + 0.9, 8.4, '100 YEARS OF LEARNING', 0.72);
  };
  crest(0, -4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const group = new THREE.Group();
  const painted = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshLambertMaterial({ map: texture }));
  painted.rotation.x = -Math.PI / 2;
  group.add(painted);

  // Everything past the painted square fades into fog.
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0x9aa58c }));
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.y = -0.05;
  group.add(beyond);
  return group;
}
