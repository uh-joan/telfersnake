/**
 * The beat grid. The game's theme (src/audio/music.ts) runs at 142 BPM in sixteenths, eight bars
 * to the loop; the film is cut on that grid. Everything in the promo is placed in beats, not seconds.
 */
export const BPM = 142;
export const BEAT = 60 / BPM; // 0.4225 s
export const BAR = BEAT * 4; // 1.690 s
/** 18 bars: 30.4 s. */
export const FILM_BEATS = 72;

export const secondsAt = (beat: number): number => beat * BEAT;
export const beatAt = (seconds: number): number => seconds / BEAT;
