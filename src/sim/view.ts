import type { Animal } from './animals';
import type { Food } from './food';
import type { Hazard, Pellet } from './hazards';
import type { Snake } from './snake';
import type { CardId } from './upgrades';
import type { GameEvent } from './world';

/** As much of Mr Cooper as anything outside the sim needs to know. */
export interface CooperState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Seconds left of the current telling-off. */
  talking: number;
}

/**
 * What the renderer and HUD read. Solo play hands them the World itself; in a shared room they
 * get a Replica, a copy kept up to date from the server's snapshots. Same shape either way, so
 * nothing that draws needs to know which game it is in.
 */
export interface WorldView {
  readonly tick: number;
  /** Which snake belongs to the person looking at this screen. */
  readonly me: number;
  readonly snakes: readonly Snake[];
  readonly snake: Snake;
  readonly cooper: CooperState;
  readonly hazards: readonly Hazard[];
  readonly foods: readonly Food[];
  readonly animals: readonly Animal[];
  readonly pellets: readonly Pellet[];
  /** Things that happened since whoever is drawing last emptied this. */
  readonly events: GameEvent[];
  /** The local player's level-up cards, while they are choosing. */
  readonly cards: CardId[] | null;
  beeAt(s: Snake, i: number, out: { x: number; z: number }): void;
}
