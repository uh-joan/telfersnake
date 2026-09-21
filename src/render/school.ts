import * as THREE from 'three';
import {
  BENCHES, BOUNDS, BUILDINGS, CARS, COURT_FENCES, PLATFORM, SAIL, TREES, type Building,
} from '../sim/layout';
import { Rng } from '../sim/rng';

const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, ...extra });

/** A tile of brick courses, light on the bricks and darker in the mortar, so a colour tint on top reads as brick. */
let brickTex: THREE.CanvasTexture | null = null;
function brickTexture(): THREE.CanvasTexture {
  if (brickTex) return brickTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#b8b8b8'; // mortar
  c.fillRect(0, 0, 256, 256);
  const rows = 9;
  const bw = 256 / 5;
  const bh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let x = -1; x < 6; x++) {
      const shade = 205 + Math.floor(Math.random() * 45);
      c.fillStyle = `rgb(${shade},${shade},${shade})`;
      c.fillRect(x * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
    }
  }
  brickTex = new THREE.CanvasTexture(cv);
  brickTex.colorSpace = THREE.SRGBColorSpace;
  return brickTex;
}

/** Unit gable roof: 1 wide (x), 1 long (z), 1 tall, ridge running along z. */
function gableGeometry(): THREE.BufferGeometry {
  const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0, 1, -0.5];
  const D = [-0.5, 0, 0.5], E = [0.5, 0, 0.5], F = [0, 1, 0.5];
  const tris = [D, E, F, B, A, C, A, D, F, A, F, C, B, C, F, B, F, E];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

const GABLE = gableGeometry();
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

/** Something tall enough to hide a snake that slithers round the back of it. */
interface Occluder {
  minX: number;
  maxX: number;
  /** The far (north) side, and how far beyond it the camera cannot see the ground. */
  northZ: number;
  southZ: number;
  shadow: number;
  materials: THREE.MeshLambertMaterial[];
}

function building(b: Building, occluders: Occluder[]): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(UNIT_BOX, b.brick ? lambert(b.wall, { map: brickTexture() }) : lambert(b.wall));
  walls.scale.set(b.w, b.h, b.d);
  walls.position.set(b.x, b.h / 2, b.z);
  g.add(walls);

  const roofMat = lambert(b.roof);
  if (b.roofH > 0) {
    const roof = new THREE.Mesh(GABLE, roofMat);
    const overhang = 0.6;
    roof.position.set(b.x, b.h, b.z);
    if (b.w > b.d) {
      roof.rotation.y = Math.PI / 2;
      roof.scale.set(b.d + overhang, b.roofH, b.w + overhang);
    } else {
      roof.scale.set(b.w + overhang, b.roofH, b.d + overhang);
    }
    g.add(roof);
  } else {
    const roof = new THREE.Mesh(UNIT_BOX, roofMat);
    roof.scale.set(b.w + 0.4, 0.3, b.d + 0.4);
    roof.position.set(b.x, b.h + 0.15, b.z);
    g.add(roof);
  }
  occluders.push({
    minX: b.x - b.w / 2, maxX: b.x + b.w / 2, northZ: b.z - b.d / 2, southZ: b.z + b.d / 2,
    // The camera looks north and down at about 58 degrees: a wall hides roughly 0.65 of its height behind it.
    shadow: (b.h + b.roofH) * 0.65 + 1,
    materials: [walls.material as THREE.MeshLambertMaterial, roofMat],
  });
  return g;
}

function extras(): THREE.Group {
  const g = new THREE.Group();
  const north = BUILDINGS.find((b) => b.id === 'northBlock')!;
  const wing = BUILDINGS.find((b) => b.id === 'oldNorthEast')!;

  // Solar panels along the north block's flat roof
  const panel = lambert(0x1f3a6e);
  for (let x = north.x - north.w / 2 + 3; x < north.x + north.w / 2 - 2; x += 3.2) {
    const p = new THREE.Mesh(UNIT_BOX, panel);
    p.scale.set(2.6, 0.12, 4.5);
    p.position.set(x, north.h + 0.45, north.z - 1);
    p.rotation.x = 0.12;
    g.add(p);
  }
  // Its white canopy over the top playground (see-through so it never hides the snake)
  const canopy = new THREE.Mesh(UNIT_BOX, lambert(0xffffff, { transparent: true, opacity: 0.55 }));
  canopy.scale.set(north.w - 8, 0.15, 2.4);
  canopy.position.set(north.x + 2, 3, north.z + north.d / 2 + 1.2);
  g.add(canopy);

  // Glass atrium along the Old School's north wing ridge
  const atrium = new THREE.Mesh(UNIT_BOX, lambert(0xdfe8f0));
  atrium.scale.set(18, 0.8, 4);
  atrium.position.set(wing.x, wing.h + wing.roofH - 0.5, wing.z);
  g.add(atrium);

  // Brick chimneys on the roofed brick buildings
  for (const [x, z] of [[24, -32], [30, -8], [8, -6], [15, 13]]) {
    const ch = new THREE.Mesh(UNIT_BOX, lambert(0x8a4a32));
    ch.scale.set(1, 2.4, 1);
    ch.position.set(x, 7, z);
    g.add(ch);
  }
  return g;
}

function courtFence(): THREE.Group {
  const g = new THREE.Group();
  const mesh = lambert(0xcfe9ee, { transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const post = lambert(0x3d6f7a);
  const H = 3;
  for (const f of COURT_FENCES) {
    const panel = new THREE.Mesh(UNIT_BOX, mesh);
    panel.scale.set(Math.max(f.w, 0.05), H, Math.max(f.d, 0.05));
    panel.position.set(f.x, H / 2, f.z);
    g.add(panel);
    const alongX = f.w > f.d;
    const len = alongX ? f.w : f.d;
    const n = Math.max(1, Math.round(len / 4));
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(UNIT_BOX, post);
      p.scale.set(0.16, H, 0.16);
      const t = i / n - 0.5;
      p.position.set(f.x + (alongX ? t * len : 0), H / 2, f.z + (alongX ? 0 : t * len));
      g.add(p);
    }
  }
  return g;
}

function sail(): THREE.Group {
  const g = new THREE.Group();
  const hw = SAIL.w / 2;
  const hd = SAIL.d / 2;
  // Corners alternate high/low like a real tensioned shade sail.
  // Built around the group's own origin: transparent objects are depth-sorted by their
  // origin, so geometry baked at world coordinates would sort as if it sat at (0, 0, 0).
  g.position.set(SAIL.x, 0, SAIL.z);
  const corners = [
    [-hw, 4.4, -hd], [hw, 3.1, -hd],
    [hw, 4.4, hd], [-hw, 3.1, hd],
  ];
  const tri = (a: number[], b: number[], c: number[], color: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, lambert(color, { transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })));
  };
  tri(corners[0], corners[3], corners[2], 0x2f6fd6);
  tri(corners[0], corners[2], corners[1], 0x1d4fa3);
  const postMat = lambert(0x3b4350);
  for (const c of corners) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, c[1], 6), postMat);
    p.position.set(c[0], c[1] / 2, c[2]);
    g.add(p);
  }
  return g;
}

function props(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert(0x8a5a3a);
  for (const b of BENCHES) {
    const top = new THREE.Mesh(UNIT_BOX, wood);
    top.scale.set(b.w, 0.12, b.d);
    top.position.set(b.x, 0.7, b.z);
    g.add(top);
    for (const side of [-1, 1]) {
      const seat = new THREE.Mesh(UNIT_BOX, wood);
      seat.scale.set(b.w, 0.1, 0.3);
      seat.position.set(b.x, 0.42, b.z + side * (b.d / 2 + 0.25));
      g.add(seat);
    }
  }

  // Climbing platform with a little roof and a slide
  const deck = new THREE.Mesh(UNIT_BOX, lambert(0xb9814f));
  deck.scale.set(PLATFORM.w, 1.2, PLATFORM.d);
  deck.position.set(PLATFORM.x, 0.6, PLATFORM.z);
  g.add(deck);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.1, 4), lambert(0xf2c94c));
  hat.position.set(PLATFORM.x, 2.9, PLATFORM.z);
  hat.rotation.y = Math.PI / 4;
  g.add(hat);
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) {
    const leg = new THREE.Mesh(UNIT_BOX, wood);
    leg.scale.set(0.14, 2.4, 0.14);
    leg.position.set(PLATFORM.x + dx, 1.2, PLATFORM.z + dz);
    g.add(leg);
  }
  const slide = new THREE.Mesh(UNIT_BOX, lambert(0xe0524d));
  slide.scale.set(0.8, 0.08, 2.6);
  slide.position.set(PLATFORM.x - 1.9, 0.62, PLATFORM.z);
  slide.rotation.set(0, Math.PI / 2, 0.45);
  g.add(slide);

  for (const car of CARS) g.add(carMesh(car.x, car.z, car.color, 0));
  return g;
}

function carMesh(x: number, z: number, color: number, rotY: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(UNIT_BOX, lambert(color));
  body.scale.set(1.8, 0.75, 4.1);
  body.position.y = 0.6;
  const cabin = new THREE.Mesh(UNIT_BOX, lambert(0x27303c));
  cabin.scale.set(1.6, 0.6, 2.1);
  cabin.position.set(0, 1.25, -0.2);
  g.add(body, cabin);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

interface Canopy {
  x: number;
  z: number;
  size: number;
  material: THREE.MeshLambertMaterial;
}

function trees(rng: Rng, canopies: Canopy[]): THREE.Group {
  const g = new THREE.Group();
  const trunk = lambert(0x6b4a2f);
  const greens = [0x3f9a3c, 0x57b04a, 0x2f7f35];
  const add = (x: number, z: number, canopy: number) => {
    const h = canopy * 1.1 + 0.8;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(canopy * 0.12, canopy * 0.16, h, 6), trunk);
    t.position.set(x, h / 2, z);
    // Own material per tree so each can fade on its own when the snake slips behind it.
    const material = lambert(rng.pick(greens));
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(canopy, 1), material);
    c.position.set(x, h + canopy * 0.55, z);
    c.scale.y = 0.85;
    c.rotation.y = rng.range(0, 3);
    g.add(t, c);
    canopies.push({ x, z, size: canopy, material });
  };
  for (const t of TREES) add(t.x, t.z, t.canopy);
  // Street trees on the Telferscot Rd pavement, as in the satellite view
  for (const z of [-33, -20, -6, 5, 16, 29]) add(BOUNDS.minX - 2, z, 1.7);
  for (const z of [-28, -4, 20]) add(BOUNDS.maxX + 2.2, z, 1.5);
  return g;
}

function schoolFence(): THREE.Group {
  const g = new THREE.Group();
  const mat = lambert(0x2f5d3a);
  const H = 1.3;
  const w = BOUNDS.maxX - BOUNDS.minX;
  const d = BOUNDS.maxZ - BOUNDS.minZ;
  const rails: [number, number, number, number][] = [
    [0, BOUNDS.minZ, w, 0.1], [0, BOUNDS.maxZ, w, 0.1],
    [BOUNDS.minX, 0, 0.1, d], [BOUNDS.maxX, 0, 0.1, d],
  ];
  for (const [x, z, sx, sz] of rails) {
    for (const y of [H, H * 0.45]) {
      const rail = new THREE.Mesh(UNIT_BOX, mat);
      rail.scale.set(sx, 0.08, sz);
      rail.position.set(x, y, z);
      g.add(rail);
    }
  }
  const spots: [number, number][] = [];
  for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 2) spots.push([x, BOUNDS.minZ], [x, BOUNDS.maxZ]);
  for (let z = BOUNDS.minZ + 2; z < BOUNDS.maxZ; z += 2) spots.push([BOUNDS.minX, z], [BOUNDS.maxX, z]);
  const posts = new THREE.InstancedMesh(UNIT_BOX, mat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    m.makeScale(0.12, H + 0.1, 0.12).setPosition(x, (H + 0.1) / 2, z);
    posts.setMatrixAt(i, m);
  });
  g.add(posts);
  return g;
}

/** Terraced houses and parked cars beyond the fence. Scenery only. */
function neighbourhood(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const rows: { x: number; z: number; alongZ: boolean }[] = [];
  for (let t = -68; t <= 68; t += 6.2) {
    rows.push({ x: -59, z: t, alongZ: true }, { x: 59, z: t, alongZ: true });
    if (Math.abs(t) < 50) rows.push({ x: t, z: 59, alongZ: false }, { x: t, z: -50, alongZ: false });
  }
  const bodies = new THREE.InstancedMesh(UNIT_BOX, lambert(0xffffff, { map: brickTexture() }), rows.length);
  const roofs = new THREE.InstancedMesh(GABLE, lambert(0xffffff), rows.length);
  const wallColors = [0xc98a5f, 0xd8a06f, 0xb56a44, 0xcaa98a, 0xa8583a];
  const roofColors = [0x5a6170, 0x6b7280, 0x4e5563];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  rows.forEach((r, i) => {
    const h = rng.range(6, 7.2);
    q.setFromAxisAngle(up, r.alongZ ? 0 : Math.PI / 2);
    m.compose(new THREE.Vector3(r.x, h / 2, r.z), q, new THREE.Vector3(11, h, 6));
    bodies.setMatrixAt(i, m);
    bodies.setColorAt(i, col.setHex(rng.pick(wallColors)));
    m.compose(new THREE.Vector3(r.x, h, r.z), q, new THREE.Vector3(11.6, 2.6, 6.2));
    roofs.setMatrixAt(i, m);
    roofs.setColorAt(i, col.setHex(rng.pick(roofColors)));
  });
  g.add(bodies, roofs);

  const carColors = [0xd94b3d, 0x2b2f38, 0xe6e8eb, 0x3a5fa8, 0x8a8f98, 0x274a36];
  for (let z = -66; z < 70; z += rng.range(6, 11)) {
    g.add(carMesh(-43.6, z, rng.pick(carColors), 0));
    if (rng.next() < 0.8) g.add(carMesh(43.6, z + 2, rng.pick(carColors), 0));
  }
  for (let x = -30; x < 36; x += rng.range(7, 13)) g.add(carMesh(x, 50.4, rng.pick(carColors), Math.PI / 2));
  return g;
}

export interface School {
  group: THREE.Group;
  /** Turn see-through any tree canopy or building the camera would otherwise look through to reach (x, z). */
  reveal(x: number, z: number, dt: number): void;
}

export function makeSchool(): School {
  const rng = new Rng(11);
  const group = new THREE.Group();
  const canopies: Canopy[] = [];
  const occluders: Occluder[] = [];
  for (const b of BUILDINGS) group.add(building(b, occluders));
  group.add(extras(), courtFence(), sail(), props(), trees(rng, canopies), schoolFence(), neighbourhood(rng));

  const reveal = (x: number, z: number, dt: number) => {
    for (const c of canopies) {
      // The camera looks north and down, so a canopy hides the ground from just south of
      // its trunk to a few metres north of it.
      const hidden = Math.abs(x - c.x) < c.size + 1 && z > c.z - c.size * 2.4 - 1 && z < c.z + c.size * 0.6;
      const want = hidden ? 0.3 : 1;
      c.material.opacity += (want - c.material.opacity) * (1 - Math.exp(-dt * 12));
      c.material.transparent = c.material.opacity < 0.99;
    }
    // Buildings too: a child must never lose sight of their own snake behind the Red Roof Hut.
    for (const o of occluders) {
      const hidden = x > o.minX - 1 && x < o.maxX + 1 && z > o.northZ - o.shadow && z < o.southZ;
      const want = hidden ? 0.28 : 1;
      for (const m of o.materials) {
        m.opacity += (want - m.opacity) * (1 - Math.exp(-dt * 12));
        m.transparent = m.opacity < 0.99;
        m.depthWrite = !m.transparent;
      }
    }
  };
  return { group, reveal };
}
