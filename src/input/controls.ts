import type { Input } from '../sim/snake';

const DEAD_ZONE = 8; // px
const STICK_RADIUS = 56; // px
const TAP_MAX_MS = 250; // a touch shorter than this, that barely moved, is a tap
const TAP_MAX_MOVE = 24; // px
const DOUBLE_TAP_MS = 320; // the hold must start this soon after the tap...
const DOUBLE_TAP_RADIUS = 90; // ...and this close to it

/**
 * One-thumb steering: touch anywhere and drag; a floating stick appears under the thumb.
 * Lifting the thumb keeps the snake on its current heading.
 *
 * Speed burst, three ways: hold the lightning button with the other thumb; or, one-handed,
 * tap and then press-and-hold anywhere (keep dragging to steer while it bursts); or Space.
 * Arrow keys / WASD steer on a keyboard.
 */
export class Controls {
  private readonly state: Input = { x: 0, z: 0, active: false, dash: false };
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private readonly keys = new Set<string>();
  private dashHeld = false;
  private dashKey = false;
  /** Bursting because this press was the hold of a tap-then-hold. Ends when that finger lifts. */
  private dashTouch = false;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private movedFar = false;
  private tapAt = -Infinity;
  private tapX = 0;
  private tapY = 0;
  /** Release the stick and the dash, as if every finger had lifted. Called when a menu opens. */
  letGo: () => void = () => {};

  constructor(surface: HTMLElement, stick: HTMLElement, dashButton: HTMLElement) {
    const knob = stick.firstElementChild as HTMLElement;

    // The newest finger on the glass always steers: kids swap thumbs without lifting first.
    surface.addEventListener('pointerdown', (e) => {
      const now = performance.now();
      const afterTap = now - this.tapAt < DOUBLE_TAP_MS && Math.hypot(e.clientX - this.tapX, e.clientY - this.tapY) < DOUBLE_TAP_RADIUS;
      this.dashTouch = afterTap;
      this.tapAt = -Infinity;
      stick.classList.toggle('burst', afterTap);
      dashButton.classList.toggle('on', afterTap || this.dashHeld);
      this.downAt = now;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.movedFar = false;

      this.pointerId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      stick.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      knob.style.transform = 'translate(-50%, -50%)';
      stick.classList.add('on');
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > TAP_MAX_MOVE) this.movedFar = true;
      let dx = e.clientX - this.originX;
      let dy = e.clientY - this.originY;
      const dist = Math.hypot(dx, dy);
      if (dist > STICK_RADIUS) {
        // Drag the stick base along so reversing direction is always a short move.
        this.originX += (dx / dist) * (dist - STICK_RADIUS);
        this.originY += (dy / dist) * (dist - STICK_RADIUS);
        dx = e.clientX - this.originX;
        dy = e.clientY - this.originY;
        stick.style.transform = `translate(${this.originX}px, ${this.originY}px)`;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      if (dist < DEAD_ZONE) return;
      this.state.x = dx / dist;
      this.state.z = dy / dist; // screen down is world south
      this.state.active = true;
    });

    const endBurst = () => {
      this.dashTouch = false;
      stick.classList.remove('burst');
      dashButton.classList.toggle('on', this.dashHeld);
    };

    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      // A quick touch that stayed put is a tap: the next press, if it comes at once, bursts.
      const now = performance.now();
      if (e.type === 'pointerup' && !this.dashTouch && !this.movedFar && now - this.downAt < TAP_MAX_MS) {
        this.tapAt = now;
        this.tapX = e.clientX;
        this.tapY = e.clientY;
      }
      endBurst();
      this.pointerId = null;
      this.state.active = false;
      stick.classList.remove('on');
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    dashButton.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.dashHeld = true;
      dashButton.classList.add('on');
    });
    const dashOff = () => {
      this.dashHeld = false;
      dashButton.classList.toggle('on', this.dashTouch);
    };
    dashButton.addEventListener('pointerup', dashOff);
    dashButton.addEventListener('pointercancel', dashOff);
    dashButton.addEventListener('pointerleave', dashOff);

    window.addEventListener('keydown', (e) => {
      // Space is the dash key: it must never also click whichever button was tapped last, or scroll.
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) e.preventDefault();
      if (e.code === 'Space') this.dashKey = true;
      else this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.dashKey = false;
      else this.keys.delete(e.code);
    });
    // A pointerup can get lost (system gestures, app switcher). Never stay wedged on it.
    this.letGo = () => {
      this.keys.clear();
      this.dashKey = false;
      this.pointerId = null;
      this.state.active = false;
      this.tapAt = -Infinity;
      stick.classList.remove('on');
      endBurst();
      dashOff();
    };
    window.addEventListener('blur', this.letGo);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.letGo();
    });
  }

  read(): Input {
    const k = this.keys;
    const kx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const kz = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (this.pointerId === null) {
      this.state.active = kx !== 0 || kz !== 0;
      if (this.state.active) {
        const len = Math.hypot(kx, kz);
        this.state.x = kx / len;
        this.state.z = kz / len;
      }
    }
    this.state.dash = this.dashHeld || this.dashKey || this.dashTouch;
    return this.state;
  }
}
