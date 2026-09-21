/** 0 → 1 with a little overshoot that settles back, for things popping into the world. `t` in 0..1. */
export function popIn(t: number): number {
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  const k = 1.70158;
  const u = t - 1;
  return 1 + (k + 1) * u * u * u + k * u * u;
}
