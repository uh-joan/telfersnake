import * as THREE from 'three';

const SKY = 0x9fd8f5;
/** Each stage's own light: the school's bright noon, the Common's warmer late-afternoon haze. */
const ATMOSPHERE = {
  school: { sky: 0x9fd8f5, fog: [70, 170] as const, hemiSky: 0xffffff, hemiGround: 0x8a8f7a, hemi: 1.9, sun: 0xfff2d6, sunI: 2.2 },
  common: { sky: 0xcfe6c0, fog: [55, 150] as const, hemiSky: 0xf6e9c8, hemiGround: 0x6f7a52, hemi: 1.75, sun: 0xffe6b0, sunI: 2.35 },
};
const TILT = (58 * Math.PI) / 180;
const FOV_LANDSCAPE = 42;
const FOV_PORTRAIT = 54; // a tall screen needs a wider lens, but not so wide the school looks tiny

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Renderer, scene, lights and the follow camera. The camera never rotates with the snake:
 * north stays up, so "push the stick up" always means "go up the screen".
 */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV_LANDSCAPE, 1, 0.5, 400);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly focus = new THREE.Vector3();
  private distance = 17;
  private primed = false;
  private readonly v = new THREE.Vector3();
  width = 1;
  height = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 70, 170);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 1.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
    this.sun.position.set(-30, 60, 25);
    this.scene.add(this.sun);

    this.resize();
  }

  /** Give each stage its own light and haze: the school's bright noon, the Common's warm afternoon. */
  setAtmosphere(id: 'school' | 'common'): void {
    const a = ATMOSPHERE[id];
    (this.scene.background as THREE.Color).setHex(a.sky);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(a.sky);
    fog.near = a.fog[0];
    fog.far = a.fog[1];
    this.hemi.color.setHex(a.hemiSky);
    this.hemi.groundColor.setHex(a.hemiGround);
    this.hemi.intensity = a.hemi;
    this.sun.color.setHex(a.sun);
    this.sun.intensity = a.sunI;
  }

  /**
   * Size everything from the box the canvas is actually laid out in. On iOS the layout and
   * visual viewports differ (toolbars, notch), and mixing them stretches the picture and
   * drags the HUD labels off the things they point at.
   */
  resize(): void {
    this.width = Math.max(1, this.canvas.clientWidth);
    this.height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.fov = this.camera.aspect < 1 ? FOV_PORTRAIT : FOV_LANDSCAPE;
    this.camera.updateProjectionMatrix();
  }

  get maxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  /** Ease the camera after the snake; pull back as it grows, and further in portrait. */
  follow(x: number, z: number, heading: number, radius: number, dt: number): void {
    // Zoomed to show roughly 10 m across at the start (portrait), so the snake and the school
    // read at a friendly size; it eases back as the snake grows and needs to see further.
    const pullBack = this.camera.aspect < 1 ? 1.4 : 1.15;
    const wantDistance = (15 + 30 * (radius - 0.3)) * pullBack;
    const lead = 1.5 + radius * 2;
    const wantX = x + Math.cos(heading) * lead;
    const wantZ = z + Math.sin(heading) * lead;

    if (!this.primed) {
      this.primed = true;
      this.focus.set(wantX, 0, wantZ);
      this.distance = wantDistance;
    } else {
      const k = 1 - Math.exp(-dt * 4);
      this.focus.x += (wantX - this.focus.x) * k;
      this.focus.z += (wantZ - this.focus.z) * k;
      this.distance += (wantDistance - this.distance) * (1 - Math.exp(-dt * 1.5));
    }

    this.camera.position.set(
      this.focus.x,
      Math.sin(TILT) * this.distance,
      this.focus.z + Math.cos(TILT) * this.distance,
    );
    this.camera.lookAt(this.focus);
  }

  /** World position to CSS pixels. */
  project(x: number, y: number, z: number, out: ScreenPoint): ScreenPoint {
    this.v.set(x, y, z).project(this.camera);
    out.x = (this.v.x * 0.5 + 0.5) * this.width;
    out.y = (-this.v.y * 0.5 + 0.5) * this.height;
    out.visible = this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2;
    return out;
  }

  render(): void {
    // Checked every frame rather than on resize events: iOS reports stale sizes mid-rotation
    // and moves its toolbars without firing one.
    if (this.canvas.clientWidth !== this.width || this.canvas.clientHeight !== this.height) this.resize();
    this.renderer.render(this.scene, this.camera);
  }
}
