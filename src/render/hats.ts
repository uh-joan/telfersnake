import * as THREE from 'three';

const materials = new Map<number, THREE.MeshLambertMaterial>();

/** One material per colour, shared by every hat part that uses it, so identical parts batch together. */
function mat(color: number): THREE.MeshLambertMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    m.userData.shared = true; // never disposed with a single snake: see SnakeView.dispose
    materials.set(color, m);
  }
  return m;
}

/**
 * Tuck Shop hats, modelled for a head of radius 1 facing +z, brim resting on top of the skull.
 * A child called "spin" (if any) is turned by the snake view every frame.
 */
export function makeHat(id: string): THREE.Group | null {
  const g = new THREE.Group();
  switch (id) {
    case 'party': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 10), mat(0xff6b6b));
      cone.position.y = 0.75;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xffd84a));
      pom.position.y = 1.55;
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.46 - i * 0.14, 0.05, 6, 14), mat(0x4dabf7));
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.25 + i * 0.4;
        g.add(band);
      }
      g.add(cone, pom);
      break;
    }
    case 'bobble': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4dabf7));
      cap.scale.set(1.15, 0.85, 1.2);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 8, 16), mat(0xffffff));
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(1.12, 1.18, 1);
      const bobble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), mat(0xffffff));
      bobble.position.y = 0.95;
      g.add(cap, rim, bobble);
      g.position.y = -0.35;
      break;
    }
    case 'propeller': {
      const colors = [0xe03131, 0xffd43b, 0x4dabf7, 0x69db7c];
      for (let i = 0; i < 4; i++) {
        const wedge = new THREE.Mesh(
          new THREE.SphereGeometry(0.95, 6, 8, (i * Math.PI) / 2, Math.PI / 2, 0, Math.PI / 2), mat(colors[i]),
        );
        wedge.scale.set(1.12, 0.75, 1.18);
        g.add(wedge);
      }
      const peak = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.7), mat(0xe03131));
      peak.position.set(0, 0.08, 1.2);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), mat(0x495057));
      stalk.position.y = 0.9;
      const spin = new THREE.Group();
      spin.name = 'spin';
      spin.position.y = 1.12;
      for (const turn of [0, Math.PI / 2]) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.22), mat(0xffd43b));
        blade.rotation.y = turn;
        spin.add(blade);
      }
      g.add(peak, stalk, spin);
      g.position.y = -0.3;
      break;
    }
    case 'wizard': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 16), mat(0x5f3dc4));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.1, 12), mat(0x5f3dc4));
      cone.position.y = 1.05;
      cone.rotation.z = 0.12;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.2, 12), mat(0xffd43b));
      band.position.y = 0.15;
      for (const [x, y, z] of [[0.3, 0.8, 0.5], [-0.35, 1.2, 0.3], [0.1, 1.5, -0.3]]) {
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), mat(0xffd43b));
        star.position.set(x, y, z);
        g.add(star);
      }
      g.add(brim, cone, band);
      break;
    }
    case 'crown': {
      // Open-ended, so it needs both faces: its own material rather than the shared gold.
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.66, 0.45, 12, 1, true),
        new THREE.MeshLambertMaterial({ color: 0xffd43b, side: THREE.DoubleSide }),
      );
      ring.position.y = 0.22;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.45, 4), mat(0xffd43b));
        point.position.set(Math.cos(a) * 0.68, 0.66, Math.sin(a) * 0.68);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(i % 2 ? 0xe03131 : 0x4dabf7));
        gem.position.set(Math.cos(a) * 0.72, 0.25, Math.sin(a) * 0.72);
        g.add(point, gem);
      }
      g.add(ring);
      break;
    }
    case 'flower': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), mat(0x2f9e44));
      stem.position.y = 0.25;
      const middle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat(0xffd43b));
      middle.position.y = 0.62;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(0xffffff));
        petal.scale.set(1, 0.35, 0.6);
        petal.position.set(Math.cos(a) * 0.42, 0.6, Math.sin(a) * 0.42);
        petal.rotation.y = -a;
        g.add(petal);
      }
      g.add(stem, middle);
      break;
    }
    case 'cat-ears':
    case 'bunny-ears': {
      const bunny = id === 'bunny-ears';
      const fur = mat(bunny ? 0xffffff : 0x495057);
      for (const side of [-1, 1]) {
        const ear = bunny
          ? new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 4, 8), fur)
          : new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 4), fur);
        const inner = bunny
          ? new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.9, 4, 6), mat(0xffb3c6))
          : new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 4), mat(0xffb3c6));
        ear.position.set(side * 0.5, bunny ? 0.75 : 0.3, 0);
        inner.position.set(side * 0.5, bunny ? 0.75 : 0.28, bunny ? 0.13 : 0.12);
        ear.rotation.z = inner.rotation.z = -side * (bunny ? 0.22 : 0.3);
        g.add(ear, inner);
      }
      g.position.y = -0.15;
      break;
    }
    case 'chef': {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.55, 14), mat(0xffffff));
      band.position.y = 0.28;
      g.add(band);
      for (const [x, z, r] of [[0, 0, 0.62], [0.42, 0.1, 0.45], [-0.42, 0.1, 0.45], [0, -0.42, 0.45], [0.05, 0.42, 0.42]]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(0xffffff));
        puff.position.set(x, 0.85, z);
        g.add(puff);
      }
      break;
    }
    case 'cone': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), mat(0xff6b00));
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.7, 12), mat(0xff6b00));
      body.position.y = 0.9;
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.43, 0.32, 12), mat(0xffffff));
      stripe.position.y = 0.95;
      g.add(base, body, stripe);
      break;
    }
    case 'cowboy':
    case 'top-hat': {
      const cowboy = id === 'cowboy';
      const felt = mat(cowboy ? 0x8a5a3a : 0x1c1c1f);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(cowboy ? 1.45 : 1.1, cowboy ? 1.45 : 1.1, 0.1, 18), felt);
      if (cowboy) brim.scale.set(1, 1, 0.8);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(cowboy ? 0.55 : 0.68, 0.7, cowboy ? 0.8 : 1.25, 14), felt);
      crown.position.y = cowboy ? 0.45 : 0.67;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.18, 14), mat(cowboy ? 0x3d2914 : 0xe03131));
      band.position.y = 0.16;
      g.add(brim, crown, band);
      break;
    }
    case 'pirate': {
      const hat = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1c1c1f));
      hat.scale.set(1.5, 0.95, 0.75);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(3, 0.14, 0.95), mat(0x1c1c1f));
      brim.position.y = 0.07;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.08, 0.1), mat(0xffd43b));
      trim.position.set(0, 0.12, 0.48);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xffffff));
      skull.position.set(0, 0.45, 0.66);
      g.add(hat, brim, trim, skull);
      break;
    }
    case 'viking': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.98, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xadb5bd));
      dome.scale.set(1.12, 0.85, 1.18);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.11, 8, 18), mat(0x8a5a3a));
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(1.08, 1.13, 1);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 8), mat(0xfff1c9));
        horn.position.set(side * 1.25, 0.65, 0);
        horn.rotation.z = -side * 0.75;
        g.add(horn);
      }
      g.add(dome, rim);
      g.position.y = -0.3;
      break;
    }
    case 'halo': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.75;
      g.add(ring);
      break;
    }
    case 'acorn': {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.82, 12, 10), mat(0xc79a5b));
      nut.scale.set(1, 1.1, 1);
      nut.position.y = 0.5;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.88, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x7a5230));
      cap.scale.set(1.06, 0.72, 1.06);
      cap.position.y = 0.86;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 5), mat(0x5b3a1e));
      stalk.position.y = 1.35;
      g.add(nut, cap, stalk);
      break;
    }
    case 'flower-crown': {
      const cols = [0xff8fab, 0xffd43b, 0xffffff, 0xa5d8ff, 0xffc9de];
      const leaf = mat(0x3f8f3a);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const bx = Math.cos(a) * 0.86;
        const bz = Math.sin(a) * 0.86;
        const centre = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(0xffe066));
        centre.position.set(bx, 0.34, bz);
        g.add(centre);
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat(cols[i % cols.length]));
          petal.scale.set(1, 0.5, 1);
          petal.position.set(bx + Math.cos(pa) * 0.13, 0.34, bz + Math.sin(pa) * 0.13);
          g.add(petal);
        }
        const sprig = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), leaf);
        sprig.scale.set(0.5, 0.3, 1.2);
        sprig.position.set(Math.cos(a + 0.5) * 0.86, 0.3, Math.sin(a + 0.5) * 0.86);
        g.add(sprig);
      }
      break;
    }
    case 'antlers': {
      const bone = mat(0xe8d9b5);
      for (const side of [-1, 1]) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.3, 6), bone);
        beam.position.set(side * 0.35, 0.8, -0.15);
        beam.rotation.z = -side * 0.45;
        beam.rotation.x = -0.35;
        g.add(beam);
        for (const [ty, tz, ang] of [[1.0, 0.15, 0.9], [1.25, -0.15, 1.25]] as const) {
          const tine = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 5), bone);
          tine.position.set(side * 0.62, ty, tz);
          tine.rotation.z = -side * ang;
          g.add(tine);
        }
      }
      break;
    }
    default:
      return null;
  }
  return g;
}
