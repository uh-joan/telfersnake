import * as THREE from 'three';
import type { StageId } from '../sim/stage';

const SKY = 0x9fd8f5;
interface Atmosphere {
  sky: number;
  fog: readonly [number, number];
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunI: number;
  /** Soft sun shadows (London's pop-up landmarks). Off elsewhere, so the other stages render as before. */
  shadows?: boolean;
}
/** Each stage's own light: the school's bright noon, the Common's warmer late-afternoon haze, London's storybook daylight. */
const ATMOSPHERE: Record<StageId, Atmosphere> = {
  school: { sky: 0x9fd8f5, fog: [70, 170], hemiSky: 0xffffff, hemiGround: 0x8a8f7a, hemi: 1.9, sun: 0xfff2d6, sunI: 2.2 },
  common: { sky: 0xcfe6c0, fog: [55, 150], hemiSky: 0xf6e9c8, hemiGround: 0x6f7a52, hemi: 1.75, sun: 0xffe6b0, sunI: 2.35 },
  // Bright storybook daylight: a pale warm-blue sky, a light haze far off, warm sun, soft shadows.
  london: { sky: 0xcfe3f2, fog: [85, 210], hemiSky: 0xfdfbf5, hemiGround: 0x9a9384, hemi: 1.75, sun: 0xfff6e6, sunI: 2.4, shadows: true },
};
const TILT = (58 * Math.PI) / 180;
/** Where the sun shines from, relative to what it lights. */
const SUN_FROM = new THREE.Vector3(-30, 60, 25);
/** Half the shadow box's width, metres: covers the view round the snake. */
const SHADOW_BOX = 42;
const FOV_LANDSCAPE = 42;
const FOV_PORTRAIT = 54; // a tall screen needs a wider lens, but not so wide the school looks tiny
const CAMERA_FAR = 400;
/** The bird's-eye view (London's Eye ride): half the width it tries to fit across the screen, and its furthest pull-back. */
const OVERVIEW_HALF_WIDTH = 88;
const OVERVIEW_MAX = 320;

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
  readonly camera = new THREE.PerspectiveCamera(FOV_LANDSCAPE, 1, 0.5, CAMERA_FAR);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  /** The current stage's clear-weather atmosphere; the weather system dims and greys it from here. */
  private baseAtmo: Atmosphere = ATMOSPHERE.school;
  private readonly skyTmp = new THREE.Color();
  private readonly greyTmp = new THREE.Color(0x8a8f96);
  private readonly focus = new THREE.Vector3();
  private distance = 17;
  /** The stage's camera distance multiplier (Stage.cameraZoom): 1 everywhere but London. */
  zoom = 1;
  /**
   * London's Eye ride (A6): while true, the camera cranes up and out to a bird's-eye view of the
   * whole map (`overviewOf`), then eases back down to the snake when it is false again.
   */
  overview = false;
  private crane = 0;
  private readonly overviewAt = new THREE.Vector3();
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
    this.sun.position.copy(SUN_FROM);
    this.scene.add(this.sun, this.sun.target);
    // Shadows only where a stage asks (setAtmosphere): a box round the camera's focus that follows it.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -SHADOW_BOX;
    cam.right = cam.top = SHADOW_BOX;
    cam.near = 1;
    cam.far = 200;
    // A phone (touch, a low pixel ratio, or a small texture limit) gets a quarter of the texels:
    // the soft PCF edge hides the difference, and the shadow pass costs far less fill.
    const small = navigator.maxTouchPoints > 0 || window.devicePixelRatio < 1.5 || this.renderer.capabilities.maxTextureSize < 8192;
    const size = small ? 1024 : 2048;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.radius = 3;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;

    this.resize();
  }

  /** Give each stage its own light and haze: the school's bright noon, the Common's warm afternoon, London's cool morning. */
  setAtmosphere(id: StageId): void {
    const a = ATMOSPHERE[id];
    this.baseAtmo = a;
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
    this.sun.castShadow = a.shadows === true;
    if (!this.sun.castShadow) {
      this.sun.position.copy(SUN_FROM);
      this.sun.target.position.set(0, 0, 0);
    }
  }

  /**
   * The weather dims and greys the clear-weather light: `dim` 1 = bright sun, lower = overcast;
   * `flash` briefly adds brightness for a lightning strike. Recomputed from the stored base.
   */
  weatherLight(dim: number, flash: number): void {
    const a = this.baseAtmo;
    this.hemi.intensity = a.hemi * dim + flash;
    this.sun.intensity = a.sunI * dim + flash;
    // Grey and darken the sky/fog as it clouds over, then brighten on a flash.
    this.skyTmp.setHex(a.sky).lerp(this.greyTmp, (1 - dim) * 0.85).multiplyScalar(Math.min(1.4, 0.55 + 0.45 * dim + flash * 0.15));
    (this.scene.background as THREE.Color).copy(this.skyTmp);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.skyTmp);
    fog.far = a.fog[1] * (0.6 + 0.4 * dim); // the rain closes the view in
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

  get maxTextureSize(): number {
    return this.renderer.capabilities.maxTextureSize;
  }

  /** Where the bird's-eye view looks (the middle of the map) and from how far: set per stage. */
  overviewOf(x: number, z: number, distance: number): void {
    this.overviewAt.set(x, distance, z);
  }

  /** Ease the camera after the snake; pull back as it grows, and further in portrait. */
  follow(x: number, z: number, heading: number, radius: number, dt: number): void {
    this.crane += ((this.overview ? 1 : 0) - this.crane) * (1 - Math.exp(-dt * 1.3));
    if (this.crane < 0.001) this.crane = 0;
    // Zoomed to show roughly 10 m across at the start (portrait), so the snake and the school
    // read at a friendly size; it eases back as the snake grows and needs to see further.
    const pullBack = this.camera.aspect < 1 ? 1.4 : 1.15;
    const wantDistance = (15 + 30 * (radius - 0.3)) * pullBack * this.zoom;
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

    // Up on the London Eye: blend toward the bird's-eye view of the whole map.
    const k = this.crane * this.crane * (3 - 2 * this.crane);
    const fx = this.focus.x + (this.overviewAt.x - this.focus.x) * k;
    const fz = this.focus.z + (this.overviewAt.z - this.focus.z) * k;
    // A tall phone sees less across: back off further (within reach of the far plane) so the map's width fits.
    const across = Math.tan(((this.camera.fov / 2) * Math.PI) / 180) * this.camera.aspect;
    const birdsEye = Math.min(OVERVIEW_MAX, Math.max(this.overviewAt.y, OVERVIEW_HALF_WIDTH / across));
    const dist = this.distance + (birdsEye - this.distance) * k;
    const far = k > 0 ? CAMERA_FAR + dist : CAMERA_FAR;
    if (this.camera.far !== far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.v.set(fx, 0, fz);
    this.camera.position.set(fx, Math.sin(TILT) * dist, fz + Math.cos(TILT) * dist);
    this.camera.lookAt(this.v);
    if (this.sun.castShadow) {
      // Keep the shadow box centred on what the camera sees (a little north of the focus), snapped
      // to whole shadow texels so the edges do not shimmer as it slides.
      const step = (SHADOW_BOX * 2) / this.sun.shadow.mapSize.x;
      const fx = Math.round(this.focus.x / step) * step;
      const fz = Math.round((this.focus.z - 8) / step) * step;
      this.sun.target.position.set(fx, 0, fz);
      this.sun.position.set(fx + SUN_FROM.x, SUN_FROM.y, fz + SUN_FROM.z);
    }
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
    // The bird's-eye view sees the whole map: push the haze back while it is up (for this frame only).
    const fog = this.scene.fog as THREE.Fog;
    const near = fog.near;
    const far = fog.far;
    fog.near = near * (1 + this.crane * 2.5);
    fog.far = far * (1 + this.crane * 2.5);
    this.renderer.render(this.scene, this.camera);
    fog.near = near;
    fog.far = far;
  }
}
