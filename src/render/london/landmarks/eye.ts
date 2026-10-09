import * as THREE from 'three';
import { box, cyl, inked, inkMaterial, merge, outlineGeometry, PALETTE, sphere, toonMaterial, type LandmarkBuild } from './kit';
import { paint } from './palace';

/**
 * The London Eye: a giant white bicycle wheel standing face-on to the camera (its plane runs east–west,
 * so from the south we see the whole circle), leaning out toward the river on a white A-frame whose
 * feet are the sim's solid (LONDON_EYE, r 1.6). A double rim braced together, thin cable spokes, a big
 * hub, and 24 glass capsules round the outside that stay level as the wheel turns (one instanced mesh,
 * plus its instanced ink hull). Draw calls: frame (2), wheel (2), capsules (2).
 */

const R = 9; // the rim's radius: an 18 m wheel, so it reads from across the map
const HUB_Y = R + 1.7;
const HUB_Z = -2.4; // the wheel hangs a little north of its feet, out toward the Thames
const PODS = 24;
const POD_R = R + 0.75;
const WHITE = PALETTE.eyeWhite;
const CABLE = 0xd9dde2;

/** A thin box from a to b (a strut, a spoke, a leg). */
function beam(a: THREE.Vector3, b: THREE.Vector3, t: number, color: number, tz = t): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = box(t, len, tz, color);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  return g.translate(a.x, a.y, a.z);
}

export function build(): LandmarkBuild {
  // ---- the A-frame, the feet and the spindle (static)
  const frame: THREE.BufferGeometry[] = [];
  const top = new THREE.Vector3(0, HUB_Y, HUB_Z + 1.3);
  for (const s of [-1, 1]) {
    frame.push(beam(new THREE.Vector3(s * 1.15, 0, 0.5), top.clone().setX(s * 0.35), 0.55, WHITE));
    frame.push(cyl(0.6, 0.7, 0.4, 0xc9c4b8, s * 1.0, 0, 0.5, 10)); // the concrete feet
  }
  frame.push(beam(new THREE.Vector3(-1.0, 4.5, 0.0), new THREE.Vector3(1.0, 4.5, 0.0), 0.3, WHITE)); // the A's crossbar
  frame.push(cyl(0.45, 0.45, 2.8, WHITE, 0, 0, 0, 12).rotateX(Math.PI / 2).translate(0, HUB_Y, HUB_Z - 1.4)); // the spindle
  // The boarding pier under the wheel.
  frame.push(box(4.5, 0.25, 2.6, 0xc9c4b8, 0, 0, HUB_Z), box(4.5, 0.08, 0.08, WHITE, 0, 0.9, HUB_Z + 1.25));

  // ---- the wheel (it turns): two rims braced together, spokes, the hub
  const wheel: THREE.BufferGeometry[] = [];
  for (const z of [-0.55, 0.55]) wheel.push(paint(new THREE.TorusGeometry(R, 0.22, 6, 72).translate(0, 0, z), WHITE));
  wheel.push(paint(new THREE.TorusGeometry(R - 0.6, 0.12, 5, 64), WHITE)); // the inner chord of the truss
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rim = (r: number, z: number) => new THREE.Vector3(c * r, s * r, z);
    // The truss: rungs tying the two rims to the inner chord.
    wheel.push(beam(rim(R, -0.55), rim(R - 0.6, 0), 0.1, WHITE), beam(rim(R, 0.55), rim(R - 0.6, 0), 0.1, WHITE));
    // Cable spokes, fanning from either end of the hub to the rim.
    wheel.push(beam(new THREE.Vector3(0, 0, i % 2 ? 0.9 : -0.9), rim(R - 0.6, 0), 0.06, CABLE));
  }
  wheel.push(cyl(0.9, 0.9, 2.0, WHITE, 0, 0, 0, 16).rotateX(Math.PI / 2).translate(0, 0, -1.0));
  wheel.push(cyl(0.5, 0.5, 2.3, 0xb8bec6, 0, 0, 0, 12).rotateX(Math.PI / 2).translate(0, 0, -1.15));

  const wheelGroup = inked(wheel, 0.06, { castShadow: true });
  wheelGroup.position.set(0, HUB_Y, HUB_Z);

  // ---- the capsules: glass eggs lying along the axle, a white collar each; most sky-glass, a few pink and white
  const podGeo = (() => {
    const glass = sphere(1, 0xffffff, 0, 0, 0, 12, 7).scale(0.62, 0.62, 1.05);
    const collar = cyl(0.68, 0.68, 0.18, 0xe9ecef, 0, -0.09, 0, 12).rotateX(Math.PI / 2);
    return merge([glass, collar]);
  })();
  const pods = new THREE.InstancedMesh(podGeo, toonMaterial(), PODS);
  const podInk = new THREE.InstancedMesh(outlineGeometry(podGeo, 0.05), inkMaterial(), PODS);
  podInk.instanceMatrix = pods.instanceMatrix; // the hull follows the pods
  podInk.raycast = () => {};
  pods.castShadow = true;
  const tints = [PALETTE.glassBlue, 0xa8dcf2, PALETTE.glassBlue, 0xf6a6c8, PALETTE.glassBlue, 0xa8dcf2, 0xffffff, PALETTE.glassBlue];
  for (let i = 0; i < PODS; i++) pods.setColorAt(i, new THREE.Color(tints[i % tints.length]));
  const m = new THREE.Matrix4();
  const place = (angle: number) => {
    for (let i = 0; i < PODS; i++) {
      const a = angle + (i / PODS) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * POD_R, HUB_Y + Math.sin(a) * POD_R, HUB_Z);
      pods.setMatrixAt(i, m);
    }
    pods.instanceMatrix.needsUpdate = true;
  };
  place(0);
  for (const im of [pods, podInk]) {
    im.computeBoundingBox();
    im.computeBoundingSphere();
  }

  const group = new THREE.Group();
  group.add(inked(frame, 0.07), wheelGroup, pods, podInk);

  return {
    group,
    tall: true,
    labelY: HUB_Y + R + 2.5,
    animate: (t) => {
      const a = -t * 0.06; // clockwise, a turn every ~100 s
      wheelGroup.rotation.z = a;
      place(a);
    },
  };
}
