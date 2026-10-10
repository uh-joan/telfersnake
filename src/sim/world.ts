import { ANIMALS, type Animal, type AnimalKind, makeAnimal, placeAnimal, updateAnimal } from './animals';
import {
  awake, LION, LION_CLIMB_TIME, LION_HOME_GIVE_UP, LION_HOP_TIME, LION_LEASH, LION_STONE_TIME, LION_WAKE, LION_WAKE_TIME,
  makePredators, type Predator, type PredatorKind, PREDATORS, RAVEN, RAVEN_CAW_TIME, RAVEN_LEASH,
} from './predators';
import { alongLoop, KID_RADIUS, KIDS, type Kid, loopLength, makeKids, type Projectile, type ProjectileKind, TRIP_GAP, TRIP_THROWS } from './kids';
import { type Creature, type CreatureKind, CREATURES, creatureSpot, makeCreatures } from './creatures';
import { Bot, MORE_RIVALS, type Personality } from './bot';
import { botCardChoice, type Rules, rulesFor } from './modes';
import { isFree, makeHit, resolveAshore, resolveCircle, slideAlong, turnToward, wrapAngle } from './collide';
import { Cooper, COOPER_AURA, COOPER_RADIUS } from './cooper';
import { type Food, type FoodKind, FOOD_VALUE, GOLDEN_MULTIPLIER, placeFood, TEA_TIME } from './food';
import { type Hazard, type HazardKind, isSolidHazard, makeHazards, type Pellet, PELLET_LIFE_TICKS, placeHazard } from './hazards';
import { type Box, type Circle, inBox, SCHOOL } from './layout';
import { Rng } from './rng';
import type { Stage, Terrain } from './stage';
import { type CarrierKind, type Input, Snake, type SnakeLook, TIERS } from './snake';
import {
  type Arrows, arrowsAt, ARROWS_REACH, type Boat, boatAt, bongAt, bridgesAt, type Burst, burstAt, confettiAt, liftRises, MARCHER_R,
  FIREWORKS_EVERY, type Marcher, PARADE_LET_THROUGH, paradeAt, projectOnPath, alongPath, type SetPieceSpots, setPieceSeedFor, spanClosed,
  wobbled,
} from './setPieces';
import { type CardId, type PowerId, rollCards, type UpgradeId } from './upgrades';
import {
  ahead, distanceToLoop, driveVehicle, type Lane, local, makeLane, makeVehicles, placeVehicle, pointAt, type Vehicle, type VehicleKind, VEHICLES, type Walker,
} from './vehicles';
import { inWater } from './water';
import {
  type Button, BUTTON_LIFE, BUTTON_MASS, BUTTON_MAX, BUTTON_STEP, JEWEL_REACH, JEWEL_RESPAWN, JEWELS_FOR_CROWN, makeTreasures, moveTreasure, type Treasure,
} from './treasures';

export const STEP = 1 / 60;
export const PLAYER = 0;

const SLOW_FACTOR = 0.6;
/** Swimming (London's Thames): a slow paddle. Bridges are the fast way across. */
const SWIM_FACTOR = 0.5;
const BUMP_QUIET = 0.4;

/** Animals are gulped from a bit closer than food: they are the ones worth chasing. */
const GULP_REACH = 0.75;
const RESPAWN_CLEARANCE = 15;
const BOOP_SLOWDOWN = 0.35;
const BOOP_COOLDOWN = 1.2;
const GOAT_COOLDOWN = 3;

const OUCH_SHARE = 0.12; // of current mass lost per rock...
const OUCH_MAX = 15; // ...up to this much
const CREATURE_RESPAWN = 25; // seconds a gulped creature stays faded before it returns elsewhere
const PIXIE_MAGNET = 22; // Pixie Dust: a huge food-pull radius
// London's legends (A5).
/** How long each London magic lasts, in seconds. */
const WINGS_FOR = 12;
const RIVER_FOR = 20;
const GIANT_FOR = 15;
const PHOENIX_FOR = 30;
/** River Rider: in the water you go this much faster than on land (instead of the ×0.5 paddle). */
const RIVER_ZOOM = 1.6;
/** Mighty Roar: everything within this many metres is blown back; rivals are pushed this far. */
export const ROAR_REACH = 10;
const ROAR_PUSH = 2.5;
const ROAR_STUN = 0.5;
/** Rise Again: a little growth when the phoenix undoes a hit, and a moment's grace. */
const RISE_GROWTH = 6;
/** A jewel is worth this much score; all five, the crown, this much more and these gems. */
const JEWEL_SCORE = 200;
const ROYAL_SCORE = 1000;
export const ROYAL_GEMS = 5;
/** London's cuppa: a little warm-up zoom, this much faster for this long. */
const TEA_ZOOM = 1.25;
const TEA_ZOOM_FOR = 2;
/** Tea Time: sandwich → scone → sponge inside this many seconds... */
const TEA_TIME_WITHIN = 20;
/** ...brings out the cake stand: this many treats around you, and a bonus. */
const TEA_TIME_TREATS = 8;
const TEA_TIME_BONUS = 150;
/** Seconds after a Tea Time when bites do not count toward another (the cake stand is not a fresh tea). */
const TEA_TIME_COOL = 3;
const TEA_STAND: readonly FoodKind[] = ['scone', 'sponge', 'sandwich', 'strawberry'];
/** Miss Sami, out on the Common with a mum: warm, whimsical, accurate. Bubbles only, like Mr Cooper. */
const SAMI_LINES = [
  'Morning! Lovely to see you on the Common.',
  'Mind the bears, poppet — give them a wide berth.',
  'Ooh, someone has grown! Well done, you.',
  'Have you seen a white stag? They say one lives in the woods.',
  'Stay on the grass, away from the road, there’s a love.',
  'Kind hands and kind hearts, everyone!',
  '…and I said to her, well, he’s not had his tea yet!',
  'The mushrooms are out — the spotted ones are the best.',
  'No throwing pebbles! …Oh. It’s only a little one.',
  'Wave to the kiddies, they do love a friendly snake.',
];
const OUCH_GRACE = 1.5; // seconds before the next rock can hurt
/** London's puddles: a slippery slide, this much faster while you are in one. */
const PUDDLE_ZOOM = 1.35;
/** A vehicle has to be rolling at least this fast for a touch to be a bonk rather than a nudge. */
const VEHICLE_BONK_SPEED = 0.3;
// London's people (A4).
/** The Royal Guard: three full laps round him inside this ring earns a smile and a gem, then he rests. */
const GUARD_REACH = 8;
const GUARD_LAPS = 3;
export const GUARD_COOL = 60;
/** Turning back more than this (radians) round the guard starts the count again. */
const GUARD_REVERSE = Math.PI / 2;
/** A busker's tune: a snake this close dances along, this much faster. */
export const BUSK_REACH = 5;
export const BUSK_ZOOM = 1.2;
/** The living statue moves (BOO!) when a snake comes this close, then holds still a while. */
const STATUE_REACH = 3;
const STATUE_REST = 6;
/** Tourists stay this close to their sight, and this far from the traffic. */
const TOURIST_ROAM = 5;
const TOURIST_KERB = 3.5;
/** Held against the school trip's line this long, a snake is let through (the children duck under the rope). */
const TRIP_LET_THROUGH = 1.2;
// London's set pieces (A6).
/** Golden treats in each BONG's ring round Big Ben, and about how many a whole minute's striking scatters (twelve o'clock: rings of two). */
const BONG_RING = 5;
const BONG_MINUTE = 15;
/** Tower Bridge's ramp: this much faster, this long, after the bascules launch you. */
const LAUNCH_ZOOM = 1.8;
const LAUNCH_FOR = 1.6;
/** The London Eye: one turn (ticks), the wait before another, and the little bonus for the view. */
export const EYE_RIDE = 12 * 60;
const EYE_COOL = 40;
const EYE_GROWTH = 6;
const EYE_SCORE = 100;
/** The river bus: the wait before riding again, and its bonus. */
const BOAT_COOL = 15;
const BOAT_GROWTH = 3;
const BOAT_SCORE = 60;
/** The Tube: a head this close to a station's middle goes down; the wait before it can again; the grace on arrival. */
export const TUBE_REACH = 1.3;
const TUBE_COOL = 8;
const TUBE_GRACE = 2;
/** Food borrowed for a set piece comes from at least this far from every snake (nobody sees it vanish). */
const BORROW_CLEAR = 15;
/** The fireworks finale: a snake this close to a finale burst catches a sparkle (a gem). */
const FINALE_REACH = 16;
/** The parade's confetti: sweets, dropped behind the guards for whoever follows them. */
const CONFETTI: readonly FoodKind[] = ['jellybaby', 'biscuit', 'strawberry', 'scone'];
/** Set-piece scratch (one process may run many rooms, but never two steps at once). */
const BOAT: Boat = { x: 0, z: 0, heading: 0, dock: -1, next: 0, leaveIn: 0 };
const BURST: Burst = { tick: 0, k: 0, x: 0, z: 0, finale: false, colour: 0 };
const ARROWS: Arrows = { x: 0, z: 0, heading: 0, t: 0, line: 0, x0: 0, z0: 0 };
const SPOT = { x: 0, z: 0, heading: 0 };
const PELLET_RETURN = 0.7; // share of the lost mass that lands on the ground as pellets
const PELLET_MAX = 5;
const PELLET_CAP = 150;

const BODY_HIT = 0.85; // share of a body's radius that counts as solid to another snake's head
const BONK_PELLETS = 14;
const BONK_RETURN = 0.6; // share of a bonked snake's mass scattered as pellets
/** What a bonk does to upgrades: 'all' (lose the lot), 'one-level' (each drops a level) or 'none'. */
const BONK_UPGRADE_LOSS: 'all' | 'one-level' | 'none' = 'all';
const BONK_REWARD = 8; // mass-worth of points and XP for the snake that did the bonking
const RESPAWN_AFTER = 3;
const RESPAWN_GRACE = 3;
const HELMET_GRACE = 1.5;
const SNAKE_CLEARANCE = 12;
const AWAY_TIME = 30; // seconds a player may stand aside in a menu before the game carries on without them
const CARD_TIME = 8; // seconds to choose in a shared room before the first card is taken for you
const DROP_HEADINGS = 8;

const MAGNET_PULL = 7; // m/s
const BEE_ORBIT = 2.4;
const BEE_REACH = 0.9;
const BEE_SPIN = 2.2; // rad/s
const BREATH_HALF_ANGLE = 0.5;
const BREATH_RECHECK = 0.25;
const DAZE = 1.8;
const BREATH_SHARE = 0.14; // fire breath scorches a rival smaller, like bonking a rock
const LASER_HALF_ANGLE = 0.2; // radians either side of dead-ahead the laser can catch a rival

const PLAYER_LOOK: SnakeLook = { name: 'You', body: 0x4cbb4a, stripe: 0xf2d94a, head: 0x57c955 };

/** Bee Buddies orbit on the clock, so the sim and any copy of it agree where each bee is. */
export function beePosition(tick: number, s: Snake, i: number, out: { x: number; z: number }): void {
  const a = tick * STEP * BEE_SPIN + (i * Math.PI * 2) / Math.max(1, s.bees);
  const r = BEE_ORBIT + s.radius;
  out.x = s.x + Math.cos(a) * r;
  out.z = s.z + Math.sin(a) * r;
}

export type GameEvent =
  | { type: 'eat'; who: number; kind: FoodKind; x: number; z: number; points: number; golden: boolean; toasted: boolean }
  | { type: 'gulp'; who: number; kind: AnimalKind; x: number; z: number; points: number }
  | { type: 'boop'; who: number; kind: AnimalKind; x: number; z: number }
  | { type: 'ouch'; who: number; kind: HazardKind; x: number; z: number; lost: number; broke: boolean }
  | { type: 'rock'; i: number; x: number; z: number; turn: number }
  | { type: 'pellet'; who: number; x: number; z: number; points: number }
  | { type: 'tier'; who: number; tier: number }
  | { type: 'cards'; who: number; cards: CardId[] }
  | { type: 'bonk'; who: number; by: number; x: number; z: number; lost: UpgradeId[] }
  | { type: 'helmet'; who: number; x: number; z: number }
  | { type: 'respawn'; who: number; x: number; z: number }
  | { type: 'breath'; who: number; x: number; z: number; heading: number; range: number }
  | { type: 'sneeze'; who: number; by: number; x: number; z: number }
  /** A wolf about to sprint: its warning howl. */
  | { type: 'howl'; x: number; z: number }
  /** A predator bit a snake: puff at the victim, who loses mass like a rock bonk. London's lions and ravens also say how much (`lost`). */
  | { type: 'chomp'; kind: PredatorKind; who: number; x: number; z: number; lost?: number }
  /** London: a Trafalgar lion wakes up with a big stretch and a yawn (its tell). */
  | { type: 'roar'; x: number; z: number }
  /** London: a Tower raven is about to swoop: CAW! */
  | { type: 'caw'; x: number; z: number }
  /** London: a bus or cab has a snake ahead: DING DING! (a bus), or a honk (a cab, or a bus kept waiting). */
  | { type: 'ding'; kind: VehicleKind; honk: boolean; x: number; z: number }
  /** London: a snake slithered into a moving bus or cab: a rock-style bonk. "Mind the bus!" */
  | { type: 'vbonk'; kind: VehicleKind; who: number; x: number; z: number; lost: number }
  /** London: a snake slid into a puddle. Whee! */
  | { type: 'splash'; who: number; x: number; z: number }
  /** A power was cast: FX at the caster. */
  | { type: 'power'; who: number; kind: PowerId; x: number; z: number; heading: number; range: number }
  /** A rival was shrunk or frozen by a power (or bonk): puff at the victim; `by` earns the gem. */
  | { type: 'hit'; who: number; by: number; kind: 'shrink' | 'freeze'; x: number; z: number }
  | { type: 'say'; text: string; x: number; z: number }
  /** A child let fly: a pebble or a blown kiss leaves their hand — a whoosh at (x, z). */
  | { type: 'lob'; kind: ProjectileKind; x: number; z: number }
  /** A pebble caught a snake: a small shrink, "oops, a pebble!". */
  | { type: 'pelt'; who: number; x: number; z: number; lost: number; chip?: true }
  /** A blown kiss reached a snake: a little gift — growth, and sometimes a gem. */
  | { type: 'kiss'; who: number; x: number; z: number; gem: boolean }
  /** A fantastic creature was gulped: its magic bursts, `gems` are earned by `who`. */
  | { type: 'magic'; kind: CreatureKind; who: number; x: number; z: number; gems: number }
  | { type: 'bump'; who: number; what: 'wall' | 'cooper' | 'kid' | 'guard' }
  /** London: the Bobby blows his whistle at a dashing snake. PHWEEE! */
  | { type: 'whistle'; who: number; x: number; z: number }
  /** London: three laps round the Royal Guard. The tiniest smile, and a gem from his bearskin for `who`. */
  | { type: 'guard'; who: number; x: number; z: number }
  /** London: the same moment for the whole room: his smile, his eyes on `who`, the sparkle. */
  | { type: 'guardSmile'; who: number; x: number; z: number }
  /** London: a tourist took `who`'s photo. CLICK! (a flash on that player's screen) */
  | { type: 'photo'; who: number; x: number; z: number }
  /** London: the living statue moved. BOO! */
  | { type: 'boo'; x: number; z: number }
  /** London: an animal's call (a swan's HONK, a corgi's yip, a flock of pigeons taking off). */
  | { type: 'cry'; kind: AnimalKind; x: number; z: number }
  /** London: a gull or a pelican made off with a snack (it reappears elsewhere). */
  | { type: 'steal'; kind: AnimalKind; food: FoodKind; x: number; z: number }
  /** London: sandwich, scone, sponge in a row: TEA TIME! A cake stand of treats around `who`. */
  | { type: 'teatime'; who: number; x: number; z: number }
  /** London: the phoenix undid a hit on `who`: flame-feathers, and a little growth. RISE! */
  | { type: 'rise'; who: number; x: number; z: number }
  /** London: Dragon Wings wore off and `who` came down here (always free, dry ground). */
  | { type: 'land'; who: number; x: number; z: number }
  /** London: the Royal Lion's Mighty Roar: a golden ring of radius `r` round `who`. */
  | { type: 'ring'; who: number; x: number; z: number; r: number }
  /** London: `who` was blown back by `by`'s roar. */
  | { type: 'roared'; who: number; by: number; x: number; z: number }
  /** London: a Crown Jewel (index `i`) picked up by `who`, who now has `n`. */
  | { type: 'jewel'; who: number; i: number; x: number; z: number; n: number }
  /** London: all five jewels. ROYAL! A crown for `who` for the rest of the run, and gems. */
  | { type: 'royal'; who: number; x: number; z: number }
  /** London: the Pearly Lights laid a trail of buttons from (x, z) to a treasure at (tx, tz). */
  | { type: 'pearly'; who: number; x: number; z: number; tx: number; tz: number }
  /** London: a pearl button eaten. */
  | { type: 'button'; who: number; x: number; z: number; points: number }
  /** London: Big Ben strikes: BONG `k` + 1 of `n`, and a ring of golden treats bursts out round (x, z). */
  | { type: 'bong'; k: number; n: number; x: number; z: number }
  /** London: `who` was on Tower Bridge as it rose: WHEE! down the ramp, landing at (x, z). */
  | { type: 'launch'; who: number; x: number; z: number }
  /** London: `who` got on (`on`) or off the London Eye or the river bus. */
  | { type: 'ride'; who: number; by: CarrierKind; on: boolean; x: number; z: number }
  /** London: `who` took the Tube from station `from` to `to` (indices into the stage's portals), popping out at (x, z). */
  | { type: 'warp'; who: number; from: number; to: number; x: number; z: number }
  /** London: `who` stepped onto the wobbly Millennium Bridge. */
  | { type: 'wobble'; who: number; x: number; z: number }
  /** London: the Red Arrows flew over `who`: a red, white and blue trail for the rest of the run. */
  | { type: 'arrows'; who: number; x: number; z: number }
  /** London: a sparkle from the fireworks finale landed on `who`: a gem. */
  | { type: 'treat'; who: number; x: number; z: number };

/**
 * Where a lane's vehicles must pull up while Tower Bridge is shut: just short of each place the lane
 * runs onto the span (as distances along the lane, for the front bumper).
 */
function spanStopLines(lane: Lane, span: Box): number[] {
  const out: number[] = [];
  const at = { x: 0, z: 0 };
  const on = (s: number) => {
    pointAt(lane, s, at);
    return Math.abs(at.x - span.x) < span.w / 2 + 1 && Math.abs(at.z - span.z) < span.d / 2 + 1;
  };
  let was = on(0);
  for (let s = 0.25; s <= lane.length; s += 0.25) {
    const now = on(s);
    if (now && !was) out.push(s - 1);
    was = now;
  }
  return out;
}

/** Terrain with only bounds and solids: water counts as open. */
const dryTerrain = (t: Terrain): Terrain => ({ bounds: t.bounds, solidBoxes: t.solidBoxes, solidCircles: t.solidCircles });

/**
 * The whole game state. Advances in fixed steps from inputs alone: no rendering, no DOM,
 * no wall-clock time, no Math.random. That keeps it ready to run on a server for multiplayer.
 * Note the model that implies: server-authoritative. Math.sin/pow/hypot are not bit-identical
 * across JS engines, so two machines will drift; do not build lockstep or rollback on this.
 */
export class World {
  tick = 0;
  /** Which snake belongs to whoever is looking at this world. Solo play: seat 0. */
  readonly me = PLAYER;
  readonly rng: Rng;
  /** One per seat. A seat is driven by a bot until a player takes it over, and again after they leave. */
  readonly snakes: Snake[] = [];
  /** What each seat's player is pressing, by snake id. Bots ignore theirs. */
  readonly inputs: Input[] = [];
  readonly cooper: Cooper;
  readonly hazards: Hazard[];
  /** Everything the snake bounces off: rocks (which shrink it) and the log (which does not). */
  private readonly snakeSolids: Circle[];
  /** London's puddles (flat: slid across, never bumped), and who was in one last tick. */
  private readonly puddles: Hazard[];
  private readonly inPuddle: boolean[] = [];
  /** Every snake's head and body, as circles, for the traffic to brake for (rebuilt each tick). */
  private readonly walkers: Walker[] = [];
  /** The place this world is played: fence, solids, spawn tables, sanctuary, who patrols it. */
  readonly stage: Stage;
  readonly foods: Food[] = [];
  readonly animals: Animal[] = [];
  readonly predators: Predator[] = [];
  /** London's buses and cabs (empty elsewhere), and their routes made ready for driving. */
  readonly vehicles: Vehicle[] = [];
  readonly lanes: Lane[] = [];
  /** The Common's children (empty on the school), and the pebbles/kisses in flight. */
  readonly kids: Kid[] = [];
  readonly projectiles: Projectile[] = [];
  /** The Common's fantastic creatures (empty on the school). */
  readonly creatures: Creature[] = [];
  /** London's Crown Jewels (empty elsewhere), and the pearly buttons leading to one. */
  readonly treasures: Treasure[] = [];
  readonly buttons: Button[] = [];
  readonly pellets: Pellet[] = [];
  /** Things that happened since the caller last drained this. */
  readonly events: GameEvent[] = [];
  /**
   * Solo play pauses on a level-up, as Megabonk does: the caller stops stepping while
   * `cards` is set. A shared room cannot stop for everyone, so there the chooser's snake
   * freezes, cannot be bonked, and takes the first card if they dither.
   */
  private readonly pausesForCards: boolean;

  /** Collision scratch for this world's actors. Per world, so many rooms can share a process. */
  readonly hit = makeHit();

  private readonly bots = new Map<Snake, Bot>();
  private readonly p = { x: 0, z: 0 };
  private readonly loc = { f: 0, l: 0 };
  private readonly loc2 = { f: 0, l: 0 };
  private readonly landSpot = { x: 0, z: 0 };
  /** The stage with its rivers taken out (just the solids), for things that may cross water. */
  private dryStage: Terrain | null = null;
  /** Miss Sami's little natter with the mum: when she next says something, if the stage has her. */
  private samiSayIn = 3;
  /** London: when each chatter (tour guide, Beefeater) next speaks; the statue's rest; the trip's loop. */
  private readonly chatterIn: number[] = [];
  private statueRest = 0;
  private readonly tripTotal: number;
  private readonly tripAt = { x: 0, z: 0, heading: 0 };
  /** The buskers (fixed spots), for the dance zone. Empty except in London. */
  private readonly buskers: Kid[] = [];
  /** Per snake, round the Royal Guard: angle swept, its peak, the last angle, and the cooldown. */
  private readonly guardSwept: number[] = [];
  private readonly guardPeak: number[] = [];
  private readonly guardLast: number[] = [];
  readonly guardCool: number[] = [];
  /** Per snake: how long it has been pressed against the school trip's line. */
  private readonly tripHeld: number[] = [];
  /** Which difficulty this world runs at: rival personalities, food count, whether bots get upgrades. */
  readonly rules: Rules;
  // London's set pieces (A6). All idle (null, empty) on a stage without them.
  /** Where they happen, and the room's flavour (which ship, which way the jets fly): sent to phones in welcome. */
  private readonly sp: SetPieceSpots | null;
  readonly setPieceSeed: number;
  /** The stage's own bridges (Tower Bridge down); `stage.bridges` is swapped for the lifted set while it is up. */
  private readonly bridgesDown: readonly Box[];
  /** Per lane: the distances along it where its vehicles must stop short of Tower Bridge's span while it is shut. */
  private readonly spanStops: number[][] = [];
  /** The Changing of the Guard this tick (a pure function of the tick: the phones work it out too), as solids. */
  readonly marchers: Marcher[] = [];
  marcherCount = 0;
  private readonly paradeSolids: Circle[] = [];
  /** What a snake bumps into while the parade is out: the rocks and log, plus the marchers. */
  private readonly withParade: Circle[] = [];
  /** Per snake: Tube, Eye and boat cooldowns (s), on the wobbly bridge last tick, and held against the parade (s). */
  private readonly tubeCool: number[] = [];
  /** Per snake: the station its head was in last tick (−1: none). The Tube takes you as you step in, not while you stand. */
  private readonly tubeAt: (number | undefined)[] = [];
  private readonly eyeCool: number[] = [];
  private readonly boatCool: number[] = [];
  private readonly wobbling: boolean[] = [];
  private readonly paradeHeld: number[] = [];
  /** Per snake: which fireworks show last paid it a finale gem (one a show). */
  private readonly treatShow: number[] = [];
  /** Where the next borrowed food is looked for (round and round the list). */
  private borrowAt = 0;

  /**
   * Solo: `new World(seed, look, rules)` seats the player at 0 and four rivals after them.
   * `playerLook` is purely cosmetic (the Tuck Shop skin); it never affects the rules.
   * A shared room: `World.room(seed, rules)` fills every seat with a bot, and players join() later.
   */
  constructor(seed = 1, playerLook: SnakeLook | null = PLAYER_LOOK, rules: Rules = rulesFor('normal'), stage: Stage = SCHOOL) {
    this.rng = new Rng(seed);
    this.rules = rules;
    // A stage with set pieces changes under the snakes (Tower Bridge lifts): this world gets its own copy.
    this.stage = stage.setPieces ? { ...stage } : stage;
    this.sp = stage.setPieces ?? null;
    this.setPieceSeed = this.sp ? setPieceSeedFor(seed) : 0;
    this.bridgesDown = stage.bridges ?? [];
    this.cooper = new Cooper(stage.cooper);
    this.hazards = makeHazards(this.rng, stage);
    // What the snake bounces off: the rocks, plus the fallen log (the children clamber it instead).
    // Not London's puddles: those you slide across.
    this.snakeSolids = [...this.hazards.filter(isSolidHazard), ...stage.logs];
    this.puddles = this.hazards.filter((h) => !isSolidHazard(h));
    this.pausesForCards = playerLook !== null;

    if (playerLook) {
      const player = new Snake(PLAYER, playerLook, false);
      player.placeAt(stage.snakeSpawn.x, stage.snakeSpawn.z, stage.snakeSpawn.heading);
      this.snakes.push(player);
      this.inputs.push({ x: 0, z: 0, active: false, dash: false });
    }
    // The mode's roster, plus any extra rivals a bigger stage asks for (the Common), difficulty-matched.
    const base = playerLook ? rules.soloRivals : rules.rivals;
    const extras = MORE_RIVALS.slice(0, stage.extraRivals).map(rules.transform);
    for (const who of [...base, ...extras]) {
      const s = new Snake(this.snakes.length, who, true);
      this.snakes.push(s);
      this.inputs.push({ x: 0, z: 0, active: false, dash: false });
      this.seatBot(s, who);
      this.dropIn(s);
    }
    const player = this.snakes[0];

    // Everyone starts blinking: a long rival dropped in at random may be lying across someone.
    for (const s of this.snakes) s.immune = RESPAWN_GRACE;

    for (let i = 0; i < Math.round(rules.foodCount * stage.foodScale); i++) {
      const food: Food = { kind: 'cookie', golden: false, x: 0, z: 0, born: -999 };
      placeFood(food, this.rng, stage, -999, player.x, player.z, 2, this.hazards);
      this.foods.push(food);
    }
    for (const kind of stage.animals) {
      for (let i = 0; i < (stage.animalCounts?.[kind] ?? ANIMALS[kind].count); i++) {
        const a = makeAnimal(kind);
        placeAnimal(a, this, 6);
        a.born = -999;
        this.animals.push(a);
      }
    }
    for (const p of makePredators(stage, this.rng)) this.predators.push(p);
    for (const k of makeKids(stage, this.rng)) this.kids.push(k);
    for (const k of this.kids) if (k.kind === 'busker') this.buskers.push(k);
    this.tripTotal = stage.tripPath ? loopLength(stage.tripPath) : 0;
    (stage.chatters ?? []).forEach((_, i) => this.chatterIn.push(3 + i * 2.5));
    for (const c of makeCreatures(stage, this.rng)) this.creatures.push(c);
    // London's traffic: fixed routes, evenly spread, no RNG.
    if (stage.routes && stage.traffic) {
      for (const r of stage.routes) this.lanes.push(makeLane(r, stage.zebras ?? []));
      for (const v of makeVehicles(stage.traffic, stage.routes, this.lanes)) this.vehicles.push(v);
      if (this.sp) for (const lane of this.lanes) this.spanStops.push(spanStopLines(lane, this.sp.span));
    }
    // London's Crown Jewels: last, and no RNG at all on a stage without them.
    for (const t of makeTreasures(stage, this.rng)) this.treasures.push(t);
  }

  static room(seed: number, rules: Rules = rulesFor('normal'), stage: Stage = SCHOOL): World {
    return new World(seed, null, rules, stage);
  }

  /** The local player's snake. */
  get snake(): Snake {
    return this.snakes[this.me];
  }

  /** The local player's cards, while they are choosing. */
  get cards(): CardId[] | null {
    return this.snake.cards;
  }

  private seatBot(s: Snake, who: Personality): void {
    s.reset();
    s.look = who;
    s.isBot = true;
    s.mass = who.startMass;
    s.baseSpeedMul = s.speedMul = who.speedMul;
    s.baseGrowthMul = s.growthMul = who.growthMul;
    s.massCap = who.massCap;
    // In God mode the bots take upgrades, so let them draw powers too (they pay no gems).
    s.canBuyPowers = this.rules.botsGetUpgrades;
    this.bots.set(s, new Bot(who));
  }

  /** A player takes over a bot's seat, starting small like anyone else. Null if the room is full of players. */
  join(look: SnakeLook, canBuyPowers = false): Snake | null {
    const s = this.snakes.find((o) => o.isBot);
    if (!s) return null;
    this.bots.delete(s);
    s.reset();
    s.look = look;
    s.isBot = false;
    s.canBuyPowers = canBuyPowers;
    Object.assign(this.inputs[s.id], { x: 0, z: 0, active: false, dash: false });
    this.respawn(s);
    return s;
  }

  /** A player has gone: their seat goes back to the bot it was made for. */
  leave(id: number): void {
    const s = this.snakes[id];
    if (!s || s.isBot) return;
    this.seatBot(s, this.rules.rivals[id % this.rules.rivals.length]);
    this.respawn(s);
  }

  get humans(): number {
    return this.snakes.filter((s) => !s.isBot).length;
  }

  /** True when no living snake's head is within `clear` metres of (x, z). */
  clearOfSnakes(x: number, z: number, clear: number): boolean {
    for (const s of this.snakes) {
      if (s.alive && (s.x - x) ** 2 + (s.z - z) ** 2 < clear * clear) return false;
    }
    return true;
  }

  /** Spend one of a snake's level-ups on the card at `index`. */
  choose(index: number, who = this.me): void {
    const s = this.snakes[who];
    if (!s?.cards) return;
    const i = Math.min(Math.max(Math.floor(index) || 0, 0), s.cards.length - 1);
    s.takeCard(s.cards[i]);
    s.cards = null;
  }

  /**
   * A player in a shared room has opened a menu (or closed it). The world cannot stop for
   * everyone, so their own snake stops dead and cannot be bonked until they come back.
   *
   * It is immediate and always granted, on purpose. A delay or a cooldown would stop pause being
   * used to dodge, but to a child "I pressed pause and still got bonked" is simply a broken game,
   * and dodging this way only ever protects the pauser: nobody else loses anything.
   * The phone repeats `away` while the menu is open; if it stops (tab closed, phone asleep) the
   * snake is released after AWAY_TIME and the heartbeat frees the seat soon after.
   */
  setAway(who: number, away: boolean): void {
    const s = this.snakes[who];
    if (!s || s.isBot) return;
    s.awayFor = away ? AWAY_TIME : 0;
    if (away) s.immune = Math.max(s.immune, 0.5);
  }

  /** Advance one tick. Solo play passes the player's input here; a room fills `inputs` itself. */
  step(playerInput?: Input): void {
    if (playerInput) Object.assign(this.inputs[this.me], playerInput);
    const dt = STEP;
    const c = this.cooper;

    if (this.sp) this.setPieces(this.sp);
    c.update(this, dt);
    for (const a of this.animals) updateAnimal(a, this, dt);
    this.updatePredators(dt);
    if (this.vehicles.length > 0) this.updateVehicles(dt);
    this.updateKids(dt);
    this.updateProjectiles(dt);
    this.updateCreatures(dt);
    if (this.treasures.length > 0) this.updateTreasures(dt);
    if (this.buttons.length > 0) this.expireButtons();
    this.chatterSami(dt);
    if (this.stage.chatters) this.chatterLondon(dt);
    if (this.stage.statue) this.statue(dt);

    for (const s of this.snakes) {
      if (!s.alive) {
        s.respawnIn -= dt;
        if (s.respawnIn <= 0) this.respawn(s);
        continue;
      }
      const flew = s.hasMagic('wings');
      s.tickMagic(dt);
      if (flew && !s.hasMagic('wings')) this.land(s); // Dragon Wings wore off: down to free, dry ground
      // London's timers run down whether or not the snake is moving.
      if (s.teaFor > 0) s.teaFor -= dt;
      if (s.teaCool > 0) s.teaCool -= dt;
      // London: on the Eye or the river bus, the ride moves you (and you cannot be touched).
      if (s.carried) {
        this.carry(s, this.sp!);
        continue;
      }
      if (s.launchFor > 0) s.launchFor -= dt;
      const bot = this.bots.get(s);
      if (s.awayFor > 0) {
        s.awayFor -= dt;
        s.immune = Math.max(s.immune, 0.5);
        continue;
      }
      if (s.cards && !this.pausesForCards) {
        // Choosing a card in a shared room: stand still, untouchable, until they pick or time runs out.
        s.immune = Math.max(s.immune, 0.5);
        s.cardsFor -= dt;
        if (s.cardsFor <= 0) this.choose(0, s.id);
        continue;
      }
      if (s.frozenFor > 0) {
        // Frozen solid by a rival's Freeze Puff: stands still, cannot steer, until it wears off.
        s.frozenFor -= dt;
        continue;
      }
      const input = bot ? bot.think(s, this, dt) : this.inputs[s.id];

      s.slowed = Math.hypot(s.x - c.x, s.z - c.z) < COOPER_AURA;
      let pace = s.slowed ? SLOW_FACTOR : 1;
      // Flying (Dragon Wings): no paddle, no puddles. River Rider: the Thames is a fast lane.
      const flying = s.hasMagic('wings');
      if (this.stage.water && !flying && inWater(this.stage, s.x, s.z)) pace *= s.hasMagic('river') ? RIVER_ZOOM : SWIM_FACTOR;
      if (this.puddles.length > 0 && !flying && this.puddle(s)) pace *= PUDDLE_ZOOM;
      if (s.teaFor > 0) pace *= TEA_ZOOM;
      if (this.buskers.length > 0 && this.dancing(s)) pace *= BUSK_ZOOM;
      if (s.launchFor > 0) pace *= LAUNCH_ZOOM;
      s.speedFactor += (pace - s.speedFactor) * Math.min(1, dt * 4);
      // The parade is a moving wall, but never a trap: held against it a while, you are let through.
      const solids = this.marcherCount > 0 && (this.paradeHeld[s.id] ?? 0) <= PARADE_LET_THROUGH ? this.withParade : this.snakeSolids;
      s.update(input, dt, !s.slowed, this.stage, solids);

      const ouch = this.bonkRock(s);
      if (s.touchingWall && !s.wasTouchingWall && !ouch && s.bumpQuiet <= 0 && s.immune <= 0) {
        s.bumpQuiet = BUMP_QUIET;
        const g = this.stage.guard;
        const guard = (g !== undefined && Math.hypot(s.x - g.x, s.z - g.z) < s.radius + 1.2) || this.byMarcher(s, 0.1);
        this.events.push({ type: 'bump', who: s.id, what: guard ? 'guard' : 'wall' });
      }
      if (this.stage.guard) this.lapGuard(s, dt);

      if (!flying) {
        this.bumpCooper(s, dt);
        this.meetKids(s, dt);
        if (this.sp) this.meetSetPieces(s, this.sp, dt);
      }
      this.meetAnimals(s, dt, flying);
      this.meetCreatures(s);
      if (this.treasures.length > 0) this.meetJewels(s);
      if (this.buttons.length > 0) this.eatButtons(s);
      this.pullFood(s, dt);
      this.eat(s);
      this.bees(s);
      this.breathe(s, dt);
      this.castPowers(s, dt);

      if (s.tier > s.highestTier) {
        s.highestTier = s.tier;
        this.events.push({ type: 'tier', who: s.id, tier: s.tier });
      }
      // Upgrades are normally the players' edge: bots level up but get no cards. In God mode that
      // edge is gone — a bot grabs the scariest card at once, and never freezes to choose.
      if (bot && !this.rules.botsGetUpgrades) {
        s.pendingCards = 0;
      } else if (s.pendingCards > 0 && !s.cards) {
        s.cards = rollCards(this.rng, s);
        if (bot) {
          this.choose(botCardChoice(s.cards), s.id);
        } else {
          s.cardsFor = CARD_TIME;
          this.events.push({ type: 'cards', who: s.id, cards: s.cards });
        }
      }
    }

    // London's traffic: everyone out of the buses and cabs (a frozen or paused snake too; it is
    // blinking then, so it is only nudged, never bonked).
    if (this.vehicles.length > 0) for (const s of this.snakes) if (s.alive && !s.hasMagic('wings') && !s.carried) this.meetVehicles(s, dt);
    for (const s of this.snakes) if (s.alive) s.sampleBody();
    this.bonkSnakes();
    this.expirePellets();

    this.tick++;
  }

  // ---------------------------------------------------------------- snakes meeting things

  /** Push a snake's head out of a circle at (cx, cz) and swing it along the surface. */
  private shove(s: Snake, cx: number, cz: number, reach: number, dt: number): void {
    const dx = s.x - cx;
    const dz = s.z - cz;
    const d = Math.hypot(dx, dz);
    const nx = d > 1e-5 ? dx / d : 1;
    const nz = d > 1e-5 ? dz / d : 0;
    // The push must not shoulder the head into a wall or fence.
    resolveCircle(this.stage, cx + nx * reach, cz + nz * reach, s.radius, this.hit, this.snakeSolids);
    s.x = this.hit.x;
    s.z = this.hit.z;
    s.deflect(nx, nz, dt);
  }

  /** Rocks, sticks and stones: the snake has already bounced off; now it shrinks. */
  private bonkRock(s: Snake): boolean {
    if (!s.touchingWall || s.immune > 0 || s.hasMagic('wings')) return false;
    for (const h of this.hazards) {
      if (!isSolidHazard(h)) continue;
      const reach = s.radius + h.r + 0.02;
      if ((s.x - h.x) ** 2 + (s.z - h.z) ** 2 > reach * reach) continue;
      if (this.rise(s)) return true;
      s.immune = OUCH_GRACE;
      const full = s.mass < 1 ? 0 : Math.min(OUCH_MAX, Math.max(1, s.mass * OUCH_SHARE));
      const lost = full * (1 - s.rockGuard);
      if (lost > 0) this.shed(s, lost, PELLET_RETURN, Math.min(PELLET_MAX, Math.max(1, Math.round(lost))));
      // Enough bumps and it breaks: a fresh piece pops up elsewhere, clear of every snake.
      const broke = ++h.hits >= h.limit;
      this.events.push({ type: 'ouch', who: s.id, kind: h.kind, x: h.x, z: h.z, lost, broke });
      if (broke) {
        const i = this.hazards.indexOf(h);
        placeHazard(h, this.rng, this.stage, this.hazards.filter((o) => o !== h), (x, z) => !this.clearOfSnakes(x, z, 9));
        this.events.push({ type: 'rock', i, x: h.x, z: h.z, turn: h.turn });
      }
      return true;
    }
    return false;
  }

  /** Take `lost` mass off a snake and leave `share` of it on the ground as `n` pellets along its tail end. */
  // ---------------------------------------------------------------- powers (gem-unlocked)

  /** Fire whichever offensive powers this snake has unlocked and levelled, each on its own cooldown. */
  private castPowers(s: Snake, dt: number): void {
    if (s.levelOf('laser') > 0) this.fireLaser(s, dt);
    if (s.levelOf('stink') > 0) this.fireStink(s, dt);
    if (s.levelOf('zap') > 0) this.fireZap(s, dt);
    if (s.levelOf('freeze') > 0) this.fireFreeze(s, dt);
  }

  /** Shrink a rival like a rock bonk and puff pellets; `by` is credited (for gems). */
  private scorch(target: Snake, by: Snake, share: number, cap: number): void {
    if (this.rise(target)) return; // the phoenix takes it: your next hit, whatever it is
    target.immune = OUCH_GRACE;
    const lost = target.mass < 1 ? 0 : Math.min(cap, Math.max(2, target.mass * share));
    if (lost > 0) this.shed(target, lost, PELLET_RETURN, 3);
    this.events.push({ type: 'hit', who: target.id, by: by.id, kind: 'shrink', x: target.x, z: target.z });
  }

  /** Laser Eyes: a narrow beam that zaps the nearest rival roughly dead ahead. */
  private fireLaser(s: Snake, dt: number): void {
    s.laserIn -= dt;
    if (s.laserIn > 0) return;
    const lv = s.levelOf('laser');
    const range = 8 + 1.5 * lv;
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || o.hasMagic('wings')) continue;
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d > range || d >= bestD) continue;
      if (Math.abs(wrapAngle(Math.atan2(o.z - s.z, o.x - s.x) - s.heading)) > LASER_HALF_ANGLE) continue;
      bestD = d;
      best = o;
    }
    const bx = s.x + Math.cos(s.heading) * range * 0.5;
    const bz = s.z + Math.sin(s.heading) * range * 0.5;
    const scares = this.predatorsNear(bx, bz, range * 0.5);
    if (!best && !scares) {
      s.laserIn = 0.3;
      return;
    }
    s.laserIn = Math.max(0.8, 2.4 - 0.25 * lv);
    this.events.push({ type: 'power', who: s.id, kind: 'laser', x: s.x, z: s.z, heading: s.heading, range });
    if (best) this.scorch(best, s, 0.09, 8);
    if (scares) this.scarePredators(bx, bz, range * 0.5, false);
  }

  /** Stink Cloud: a puff behind the head that shrinks anyone chasing. */
  private fireStink(s: Snake, dt: number): void {
    s.stinkIn -= dt;
    if (s.stinkIn > 0) return;
    const lv = s.levelOf('stink');
    const radius = 2.5 + 0.5 * lv;
    const bx = s.x - Math.cos(s.heading) * radius * 0.6;
    const bz = s.z - Math.sin(s.heading) * radius * 0.6;
    const scares = this.predatorsNear(bx, bz, radius);
    let fired = scares;
    if (scares) this.events.push({ type: 'power', who: s.id, kind: 'stink', x: bx, z: bz, heading: s.heading, range: radius });
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || o.hasMagic('wings') || Math.hypot(o.x - bx, o.z - bz) > radius) continue;
      if (!fired) {
        fired = true;
        this.events.push({ type: 'power', who: s.id, kind: 'stink', x: bx, z: bz, heading: s.heading, range: radius });
      }
      this.scorch(o, s, 0.08, 6);
    }
    if (scares) this.scarePredators(bx, bz, radius, false);
    s.stinkIn = fired ? Math.max(1.5, 3 - 0.4 * lv) : 0.3;
  }

  /** Zap Ring: a 360° shock that shrinks every rival close by. */
  private fireZap(s: Snake, dt: number): void {
    s.zapIn -= dt;
    if (s.zapIn > 0) return;
    const lv = s.levelOf('zap');
    const radius = 2.5 + 0.4 * lv;
    const scares = this.predatorsNear(s.x, s.z, radius);
    let fired = scares;
    if (scares) this.events.push({ type: 'power', who: s.id, kind: 'zap', x: s.x, z: s.z, heading: s.heading, range: radius });
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || o.hasMagic('wings') || Math.hypot(o.x - s.x, o.z - s.z) > radius) continue;
      if (!fired) {
        fired = true;
        this.events.push({ type: 'power', who: s.id, kind: 'zap', x: s.x, z: s.z, heading: s.heading, range: radius });
      }
      this.scorch(o, s, 0.08, 6);
    }
    if (scares) this.scarePredators(s.x, s.z, radius, false);
    s.zapIn = fired ? Math.max(1.2, 3.5 - 0.4 * lv) : 0.3;
  }

  /** Freeze Puff: freezes the nearest rival on the spot for a moment (control, no shrink). */
  private fireFreeze(s: Snake, dt: number): void {
    s.freezeIn -= dt;
    if (s.freezeIn > 0) return;
    const lv = s.levelOf('freeze');
    const radius = 3 + 0.5 * lv;
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || o.frozenFor > 0 || o.hasMagic('wings')) continue;
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d <= radius && d < bestD) {
        bestD = d;
        best = o;
      }
    }
    const scares = this.predatorsNear(s.x, s.z, radius);
    if (!best && !scares) {
      s.freezeIn = 0.3;
      return;
    }
    s.freezeIn = Math.max(2.5, 5 - 0.5 * lv);
    if (best) {
      best.frozenFor = 0.8 + 0.4 * lv;
      best.immune = Math.max(best.immune, best.frozenFor); // frozen and untouchable, so it is not a free bonk
      this.events.push({ type: 'power', who: s.id, kind: 'freeze', x: best.x, z: best.z, heading: s.heading, range: radius });
      this.events.push({ type: 'hit', who: best.id, by: s.id, kind: 'freeze', x: best.x, z: best.z });
    } else {
      this.events.push({ type: 'power', who: s.id, kind: 'freeze', x: s.x, z: s.z, heading: s.heading, range: radius });
    }
    if (scares) this.scarePredators(s.x, s.z, radius, true);
  }

  // ---------------------------------------------------------------- predators (the Common's dangers)

  /** Bears and wolves: they seek out snakes, chase and bite. Deterministic, so a room stays in sync. */
  private updatePredators(dt: number): void {
    const fer = this.rules.predatorFerocity;
    for (const p of this.predators) {
      if (p.kind === 'lion') {
        this.updateLion(p, dt, fer);
        continue;
      }
      if (p.kind === 'raven') {
        this.updateRaven(p, dt, fer);
        continue;
      }
      const spec = PREDATORS[p.kind];
      if (p.frozenFor > 0) {
        p.frozenFor -= dt;
        p.speed = 0;
        continue;
      }
      p.biteIn -= dt;
      p.wanderIn -= dt;

      // The nearest living snake head within sight (a hidden snake — Fox Trick — is invisible to it).
      let target: Snake | null = null;
      let bestD = spec.sight;
      for (const s of this.snakes) {
        if (!s.alive || this.unseen(s)) continue;
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (d < bestD) {
          bestD = d;
          target = s;
        }
      }

      // Spooked (fire / zap / laser): turn tail and bolt away from the nearest snake, no hunting.
      if (p.scaredFor > 0) {
        p.scaredFor -= dt;
        p.chargeFor = 0;
        const flee = this.nearestSnake(p.x, p.z);
        if (flee) p.heading = turnToward(p.heading, Math.atan2(p.z - flee.z, p.x - flee.x), 6 * dt);
        const dash = spec.chaseSpeed * 0.9;
        resolveAshore(this.stage, p.x, p.z, p.x + Math.cos(p.heading) * dash * dt, p.z + Math.sin(p.heading) * dash * dt, spec.radius, this.hit, this.stage.logs);
        p.x = this.hit.x;
        p.z = this.hit.z;
        p.speed = dash;
        if (this.hit.hit) p.heading = slideAlong(p.heading, this.hit.nx, this.hit.nz);
        continue;
      }

      // Wolves rest after a sprint; a fresh sighting starts another with a howl.
      if (p.kind === 'wolf') {
        if (p.restFor > 0) {
          p.restFor -= dt;
          target = null;
        } else if (p.chargeFor > 0) {
          p.chargeFor -= dt;
          if (p.chargeFor <= 0) p.restFor = spec.restTime / fer;
        } else if (target) {
          p.chargeFor = spec.chaseTime;
          this.events.push({ type: 'howl', x: p.x, z: p.z });
        }
      }

      const chasing = target && (p.kind === 'bear' || p.chargeFor > 0);
      let speed: number;
      if (chasing && target) {
        p.heading = turnToward(p.heading, Math.atan2(target.z - p.z, target.x - p.x), 4 * dt);
        speed = spec.chaseSpeed * (p.kind === 'wolf' ? fer : 1);
      } else {
        if (p.wanderIn <= 0 || Math.hypot(p.x - p.wx, p.z - p.wz) < 1) this.wanderPredator(p);
        p.heading = turnToward(p.heading, Math.atan2(p.wz - p.z, p.wx - p.x), 3 * dt);
        speed = spec.roamSpeed;
      }

      resolveAshore(this.stage, p.x, p.z, p.x + Math.cos(p.heading) * speed * dt, p.z + Math.sin(p.heading) * speed * dt, spec.radius, this.hit, this.stage.logs);
      p.x = this.hit.x;
      p.z = this.hit.z;
      p.speed = speed;
      if (this.hit.hit) {
        p.heading = slideAlong(p.heading, this.hit.nx, this.hit.nz);
        this.wanderPredator(p);
      }

      // A bite: shrink whoever is in reach, like a big rock, then wait.
      if (p.biteIn <= 0) {
        for (const s of this.snakes) {
          if (!s.alive || s.immune > 0 || this.unseen(s) || Math.hypot(s.x - p.x, s.z - p.z) > spec.biteReach + s.radius) continue;
          if (!this.rise(s)) {
            s.immune = OUCH_GRACE;
            const lost = s.mass < 1 ? 0 : Math.min(spec.biteCap, Math.max(2, s.mass * spec.biteShare * fer));
            if (lost > 0) this.shed(s, lost, PELLET_RETURN, 4);
            this.events.push({ type: 'chomp', kind: p.kind, who: s.id, x: s.x, z: s.z });
          }
          p.biteIn = spec.biteEvery;
          if (p.kind === 'wolf') {
            p.chargeFor = 0;
            p.restFor = spec.restTime / fer; // a wolf snaps once, then slinks off
          }
          break;
        }
      }
    }
  }

  /** Pick a fresh spot for a predator to amble toward. */
  private wanderPredator(p: Predator): void {
    const B = this.stage.bounds;
    for (let tries = 0; tries < 20; tries++) {
      const x = this.rng.range(B.minX, B.maxX);
      const z = this.rng.range(B.minZ, B.maxZ);
      if (!isFree(this.stage, x, z, PREDATORS[p.kind].radius + 0.5, this.stage.logs)) continue;
      p.wx = x;
      p.wz = z;
      break;
    }
    p.wanderIn = this.rng.range(3, 7);
  }

  /** The closest living snake head to a point, or null if nobody is alive. */
  private nearestSnake(x: number, z: number): Snake | null {
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Is any predator (that is up and about) within this circle? Always false on the school (no predators). */
  private predatorsNear(x: number, z: number, radius: number): boolean {
    for (const p of this.predators) {
      if (awake(p) && Math.hypot(p.x - x, p.z - z) <= radius + PREDATORS[p.kind].radius) return true;
    }
    return false;
  }

  /**
   * A power splash reaches the Common's beasts: Freeze roots them; fire, zaps and lasers spook them
   * into fleeing. Empty on the school (no predators there), so it changes nothing that plays there.
   */
  private scarePredators(x: number, z: number, radius: number, freeze: boolean): void {
    for (const p of this.predators) {
      if (!awake(p) || Math.hypot(p.x - x, p.z - z) > radius + PREDATORS[p.kind].radius) continue;
      this.spook(p, freeze);
    }
  }

  /**
   * One beast caught by a power. Freeze roots a bear, wolf or raven and turns a lion to stone; fire,
   * zaps and lasers send a bear or wolf fleeing, a lion fleeing then home, a raven back to the Tower.
   */
  private spook(p: Predator, freeze: boolean): void {
    if (p.kind === 'lion') {
      if (p.state === LION.stone) return;
      if (freeze) {
        p.state = LION.stone;
        p.stateFor = LION_STONE_TIME;
        p.speed = 0;
      } else {
        if (p.state !== LION.home) p.stateFor = LION_HOME_GIVE_UP; // a second scare must not restart its way home
        p.state = LION.home;
        p.scaredFor = Math.max(p.scaredFor, 2.5);
        p.biteIn = Math.max(p.biteIn, 1);
      }
      return;
    }
    if (p.kind === 'raven' && !freeze) {
      p.state = RAVEN.back;
      p.biteIn = Math.max(p.biteIn, 1);
      return;
    }
    if (freeze) {
      p.frozenFor = Math.max(p.frozenFor, 1.4);
    } else {
      p.scaredFor = Math.max(p.scaredFor, 2.5);
      p.chargeFor = 0;
      p.biteIn = Math.max(p.biteIn, 1);
    }
  }

  /** The nearest living snake head within `range` of (x, z) that a beast can see (Fox Trick hides you). */
  private nearestVisible(x: number, z: number, range: number): Snake | null {
    let best: Snake | null = null;
    let bestD = range;
    for (const s of this.snakes) {
      if (!s.alive || this.unseen(s)) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** A London beast's capped, grace-protected bite: shrink like a rock, puff pellets. True if it landed. */
  private londonBite(p: Predator, fer: number): boolean {
    const spec = PREDATORS[p.kind];
    if (p.biteIn > 0) return false;
    for (const s of this.snakes) {
      if (!s.alive || s.immune > 0 || this.unseen(s) || Math.hypot(s.x - p.x, s.z - p.z) > spec.biteReach + s.radius) continue;
      if (this.rise(s)) {
        p.biteIn = spec.biteEvery;
        return true;
      }
      s.immune = OUCH_GRACE;
      const lost = s.mass < 1 ? 0 : Math.min(spec.biteCap, Math.max(p.kind === 'raven' ? 1 : 2, s.mass * spec.biteShare * fer));
      if (lost > 0) this.shed(s, lost, PELLET_RETURN, p.kind === 'raven' ? 2 : 4);
      this.events.push({ type: 'chomp', kind: p.kind, who: s.id, x: s.x, z: s.z, lost });
      p.biteIn = spec.biteEvery;
      return true;
    }
    return false;
  }

  /** Walk a beast `speed` m/s along its heading, on land, sliding along whatever it meets. */
  private walk(p: Predator, speed: number, dt: number): void {
    resolveAshore(this.stage, p.x, p.z, p.x + Math.cos(p.heading) * speed * dt, p.z + Math.sin(p.heading) * speed * dt, PREDATORS[p.kind].radius, this.hit, this.stage.logs);
    p.x = this.hit.x;
    p.z = this.hit.z;
    p.speed = speed;
    if (this.hit.hit) p.heading = slideAlong(p.heading, this.hit.nx, this.hit.nz);
  }

  /** A Trafalgar lion: statue → yawn → prowl → home → climb → statue (see LION in predators.ts). */
  private updateLion(p: Predator, dt: number, fer: number): void {
    const spec = PREDATORS.lion;
    p.biteIn -= dt;
    if (p.stateFor > 0) p.stateFor -= dt;
    switch (p.state) {
      case LION.statue: {
        p.speed = 0;
        if (p.stateFor > 0) return; // still sleeping off the last prowl
        const t = this.nearestVisible(p.hx, p.hz, LION_WAKE);
        if (!t) return;
        // One lion up at a time (two in God mode), and it is the sleeper nearest the snake that wakes.
        let up = 0;
        for (const o of this.predators) {
          if (o.kind !== 'lion' || o === p) continue;
          if (o.state !== LION.statue) up++;
          else if (o.stateFor <= 0 && Math.hypot(t.x - o.hx, t.z - o.hz) < Math.hypot(t.x - p.hx, t.z - p.hz)) return;
        }
        if (up >= (fer > 1 ? 2 : 1)) return;
        p.state = LION.waking;
        p.stateFor = LION_WAKE_TIME;
        p.heading = Math.atan2(p.wz - p.hz, p.wx - p.hx);
        this.events.push({ type: 'roar', x: p.x, z: p.z });
        return;
      }
      case LION.waking: {
        // A long stretch and a yawn on the plinth, then a hop down to the ground in front of it.
        const k = 1 - Math.min(1, Math.max(0, p.stateFor / LION_HOP_TIME));
        p.x = p.hx + (p.wx - p.hx) * k;
        p.z = p.hz + (p.wz - p.hz) * k;
        p.speed = k > 0 && k < 1 ? 1 : 0;
        if (p.stateFor <= 0) {
          p.state = LION.prowl;
          p.stateFor = spec.chaseTime * fer;
          p.x = p.wx;
          p.z = p.wz;
        }
        return;
      }
      case LION.climb: {
        const k = 1 - Math.min(1, Math.max(0, p.stateFor / LION_CLIMB_TIME));
        p.x = p.wx + (p.hx - p.wx) * k;
        p.z = p.wz + (p.hz - p.wz) * k;
        p.speed = 0;
        if (p.stateFor <= 0) {
          p.state = LION.statue;
          p.stateFor = spec.restTime / fer;
          p.x = p.hx;
          p.z = p.hz;
          p.heading = Math.atan2(p.wz - p.hz, p.wx - p.hx);
        }
        return;
      }
      case LION.stone:
        p.speed = 0;
        if (p.stateFor <= 0) {
          p.state = LION.home;
          p.stateFor = LION_HOME_GIVE_UP;
        }
        return;
    }

    // Up and about (prowling, or plodding home). A frog's spell holds it; a scare sends it hurrying home.
    if (p.frozenFor > 0) {
      p.frozenFor -= dt;
      p.speed = 0;
      return;
    }
    if (p.scaredFor > 0) p.scaredFor -= dt; // spooked: it hurries home (below), it does not bolt off anywhere
    const fromHome = Math.hypot(p.x - p.wx, p.z - p.wz);
    if (p.state === LION.prowl) {
      const t = this.nearestVisible(p.x, p.z, spec.sight);
      if (!t || p.stateFor <= 0 || fromHome > LION_LEASH) {
        p.state = LION.home; // tired, bored, or too far from the square
        p.stateFor = LION_HOME_GIVE_UP;
      } else {
        p.heading = turnToward(p.heading, Math.atan2(t.z - p.z, t.x - p.x), 4 * dt);
        this.walk(p, spec.chaseSpeed, dt);
        if (this.londonBite(p, fer)) {
          p.state = LION.home; // one big lick, then it is ready for a nap
          p.stateFor = LION_HOME_GIVE_UP;
        }
        return;
      }
    }
    // Home: plod back to the foot of the plinth, then climb up.
    if (fromHome < 0.35) {
      p.x = p.wx;
      p.z = p.wz;
      p.state = LION.climb;
      p.stateFor = LION_CLIMB_TIME;
      p.speed = 0;
      return;
    }
    const pace = Math.min(p.scaredFor > 0 ? spec.chaseSpeed * 1.2 : spec.roamSpeed, fromHome / dt);
    if (p.stateFor <= 0) {
      // Lost its way (never seen in checks): it pads straight home, ghosting past whatever is in the way.
      p.heading = Math.atan2(p.wz - p.z, p.wx - p.x);
      p.x += Math.cos(p.heading) * pace * dt;
      p.z += Math.sin(p.heading) * pace * dt;
      p.speed = pace;
      return;
    }
    p.heading = turnToward(p.heading, Math.atan2(p.wz - p.z, p.wx - p.x), (fromHome < 2 ? 10 : 4) * dt);
    this.walk(p, pace, dt);
  }

  /** A Tower raven: perched → CAW! → swoop → back (the wolf, with wings: it flies over water and walls). */
  private updateRaven(p: Predator, dt: number, fer: number): void {
    const spec = PREDATORS.raven;
    p.biteIn -= dt;
    if (p.stateFor > 0) p.stateFor -= dt;
    if (p.frozenFor > 0) {
      p.frozenFor -= dt; // rooted in mid-air by a Freeze Puff
      p.speed = 0;
      return;
    }
    switch (p.state) {
      case RAVEN.perched: {
        p.speed = 0;
        if (p.stateFor > 0) return;
        const t = this.nearestVisible(p.hx, p.hz, spec.sight);
        if (!t) return;
        p.state = RAVEN.caw;
        p.stateFor = RAVEN_CAW_TIME;
        p.heading = Math.atan2(t.z - p.z, t.x - p.x);
        this.events.push({ type: 'caw', x: p.x, z: p.z });
        return;
      }
      case RAVEN.caw:
        p.speed = 0;
        if (p.stateFor <= 0) {
          p.state = RAVEN.swoop;
          p.stateFor = spec.chaseTime;
        }
        return;
      case RAVEN.swoop: {
        const t = this.nearestVisible(p.x, p.z, spec.sight * 1.5);
        if (!t || p.stateFor <= 0 || Math.hypot(p.x - p.hx, p.z - p.hz) > RAVEN_LEASH) {
          p.state = RAVEN.back;
          return;
        }
        p.heading = turnToward(p.heading, Math.atan2(t.z - p.z, t.x - p.x), 5 * dt);
        this.fly(p, spec.chaseSpeed * fer, dt);
        if (this.londonBite(p, fer)) p.state = RAVEN.back; // a peck, and off home
        return;
      }
      case RAVEN.back: {
        const d = Math.hypot(p.hx - p.x, p.hz - p.z);
        if (d <= spec.roamSpeed * dt + 0.05) {
          p.x = p.hx;
          p.z = p.hz;
          p.speed = 0;
          p.state = RAVEN.perched;
          p.stateFor = spec.restTime / fer;
          return;
        }
        const want = Math.atan2(p.hz - p.z, p.hx - p.x);
        p.heading = d < 3 ? want : turnToward(p.heading, want, 6 * dt);
        this.fly(p, spec.roamSpeed, dt);
        return;
      }
    }
  }

  /** Fly a raven along its heading: over water, walls and all, but never off the map. */
  private fly(p: Predator, speed: number, dt: number): void {
    const B = this.stage.bounds;
    const r = PREDATORS[p.kind].radius;
    p.x = Math.min(B.maxX - r, Math.max(B.minX + r, p.x + Math.cos(p.heading) * speed * dt));
    p.z = Math.min(B.maxZ - r, Math.max(B.minZ + r, p.z + Math.sin(p.heading) * speed * dt));
    p.speed = speed;
  }

  // ---------------------------------------------------------------- traffic (London's buses and cabs)

  /** Every snake as circles (head and body) for the traffic to see, then drive each vehicle a tick. */
  private updateVehicles(dt: number): void {
    let n = 0;
    const add = (x: number, z: number, r: number) => {
      const w = this.walkers[n] ?? (this.walkers[n] = { x: 0, z: 0, r: 0 });
      w.x = x;
      w.z = z;
      w.r = r;
      n++;
    };
    for (const s of this.snakes) {
      if (!s.alive || s.carried) continue;
      add(s.x, s.z, s.radius);
      for (let i = 0; i < s.bodyCount; i++) add(s.body[i * 2], s.body[i * 2 + 1], s.radius);
    }
    this.walkers.length = n;
    // London: Tower Bridge shut for a lift (from the first bell till it is down): stop short of the span.
    const shut = this.sp !== null && spanClosed(this.tick);
    for (const v of this.vehicles) {
      driveVehicle(v, this.lanes[v.route], this.vehicles, this.walkers, dt, {
        ding: (veh, honk) => this.events.push({ type: 'ding', kind: veh.kind, honk, x: veh.x, z: veh.z }),
      }, shut ? this.spanStops[v.route] : undefined);
    }
  }

  /**
   * A snake against a bus or cab: it slides off the side like a wall, and if the vehicle was
   * rolling, it is bonked like a rock (a capped shrink and some pellets, then OUCH_GRACE).
   */
  private meetVehicles(s: Snake, dt: number): void {
    for (const v of this.vehicles) {
      const spec = VEHICLES[v.kind];
      const hl = spec.length / 2 + s.radius;
      const hw = spec.width / 2 + s.radius;
      if (Math.abs(v.x - s.x) > hl + hw || Math.abs(v.z - s.z) > hl + hw) continue;
      const at = local(v, s.x, s.z, this.loc);
      if (Math.abs(at.f) >= hl || Math.abs(at.l) >= hw) continue;
      // Out through the nearest face (front, back, left, right) that leaves it clear: a snake
      // pinned against a wall is squeezed out past the end instead of back into the bus.
      const c = Math.cos(v.heading);
      const sn = Math.sin(v.heading);
      const ways: [number, number, number][] = [
        [hl - at.f, c, sn], [hl + at.f, -c, -sn], [hw - at.l, sn, -c], [hw + at.l, -sn, c],
      ];
      ways.sort((a, b) => a[0] - b[0]);
      let nx = ways[0][1];
      let nz = ways[0][2];
      let bx = 0;
      let bz = 0;
      for (let k = 0; k < ways.length; k++) {
        const [push, wx, wz] = ways[k];
        resolveCircle(this.stage, s.x + wx * (push + 0.02), s.z + wz * (push + 0.02), s.radius, this.hit, this.snakeSolids);
        if (k === 0) {
          bx = this.hit.x;
          bz = this.hit.z;
        }
        const out = local(v, this.hit.x, this.hit.z, this.loc2);
        if (Math.abs(out.f) >= hl - 0.05 || Math.abs(out.l) >= hw - 0.05) {
          bx = this.hit.x;
          bz = this.hit.z;
          nx = wx;
          nz = wz;
          break;
        }
      }
      s.x = bx;
      s.z = bz;
      s.deflect(nx, nz, dt);
      // Steer next tick as if against a wall, so asking to go the other way turns away from the bus.
      s.leanOn(nx, nz);
      if (v.speed < VEHICLE_BONK_SPEED || s.immune > 0) continue;
      // Only a real collision bonks: the two closing on each other (not a corner brushing past).
      const sp = s.baseSpeed * s.speedFactor;
      const closing = (Math.cos(s.heading) * sp - Math.cos(v.heading) * v.speed) * nx + (Math.sin(s.heading) * sp - Math.sin(v.heading) * v.speed) * nz;
      if (closing >= 0) continue;
      if (s.hasMagic('giant')) {
        // Gog & Magog: the bus bounces off *you*. It stops dead and honks; no bonk.
        v.speed = 0;
        if (s.bumpQuiet <= 0) {
          s.bumpQuiet = BUMP_QUIET;
          this.events.push({ type: 'ding', kind: v.kind, honk: true, x: v.x, z: v.z });
        }
        continue;
      }
      if (this.rise(s)) continue;
      s.immune = OUCH_GRACE;
      const full = s.mass < 1 ? 0 : Math.min(spec.bonkCap, Math.max(1, s.mass * spec.bonkShare));
      const lost = full * (1 - s.rockGuard);
      if (lost > 0) this.shed(s, lost, PELLET_RETURN, Math.min(PELLET_MAX, Math.max(1, Math.round(lost))));
      this.events.push({ type: 'vbonk', kind: v.kind, who: s.id, x: s.x, z: s.z, lost });
    }
  }

  /** Is the snake sliding through a puddle? Says SPLASH as it goes in. */
  private puddle(s: Snake): boolean {
    let wet = false;
    for (const h of this.puddles) {
      if ((s.x - h.x) ** 2 + (s.z - h.z) ** 2 < h.r * h.r) {
        wet = true;
        break;
      }
    }
    if (wet && !this.inPuddle[s.id]) this.events.push({ type: 'splash', who: s.id, x: s.x, z: s.z });
    this.inPuddle[s.id] = wet;
    return wet;
  }

  // ---------------------------------------------------------------- the kids (the Common's crowd)

  /** Children scampering the meadow: runners for whimsy, the odd pebble-thrower and kiss-blower. */
  private updateKids(dt: number): void {
    let trip = 0;
    let leader: Kid | null = null;
    for (const k of this.kids) {
      const spec = KIDS[k.kind];
      if (k.kind === 'tourist' || k.kind === 'trip' || k.kind === 'busker') {
        k.throwIn -= dt;
        if (k.kind === 'tourist') this.updateTourist(k, dt);
        else if (k.kind === 'busker') k.speed = 0; // stands and plays
        else {
          leader ??= k;
          this.walkTrip(k, leader, trip++, dt);
        }
        continue;
      }
      k.wanderIn -= dt;
      k.throwIn -= dt;

      if (k.pauseFor > 0) {
        k.pauseFor -= dt;
        k.speed = 0;
      } else {
        if (k.wanderIn <= 0 || Math.hypot(k.x - k.tx, k.z - k.tz) < 0.8) this.wanderKid(k);
        k.heading = turnToward(k.heading, Math.atan2(k.tz - k.z, k.tx - k.x), 6 * dt);
        const speed = spec.roam;
        resolveAshore(this.stage, k.x, k.z, k.x + Math.cos(k.heading) * speed * dt, k.z + Math.sin(k.heading) * speed * dt, KID_RADIUS, this.hit);
        k.x = this.hit.x;
        k.z = this.hit.z;
        k.speed = speed;
        if (this.hit.hit) {
          k.heading = slideAlong(k.heading, this.hit.nx, this.hit.nz);
          this.wanderKid(k);
        }
      }

      // Naughty kids lob a pebble, nice kids blow a kiss — at a snake within reach, on a cooldown.
      if (spec.throwEvery > 0 && k.throwIn <= 0) {
        const target = this.nearestSnake(k.x, k.z);
        if (target && Math.hypot(target.x - k.x, target.z - k.z) <= spec.reach && this.projectiles.length < 24) {
          k.throwIn = spec.throwEvery;
          this.lob(k, target, k.kind === 'naughty' ? 'pebble' : 'kiss');
        } else {
          k.throwIn = 0.6; // nobody in range: glance again shortly
        }
      }
    }
  }

  /**
   * London's tourist: ambles round its sight, and now and then stops, turns and photographs a
   * snake nearby. CLICK! (the flash is on that player's screen: a per-seat `photo` event.)
   */
  private updateTourist(k: Kid, dt: number): void {
    const spec = KIDS.tourist;
    if (k.pauseFor > 0) {
      k.pauseFor -= dt;
      k.speed = 0;
    } else {
      k.wanderIn -= dt;
      if (k.wanderIn <= 0 || Math.hypot(k.x - k.tx, k.z - k.tz) < 0.6) this.wanderTourist(k);
      k.heading = turnToward(k.heading, Math.atan2(k.tz - k.z, k.tx - k.x), 4 * dt);
      resolveAshore(this.stage, k.x, k.z, k.x + Math.cos(k.heading) * spec.roam * dt, k.z + Math.sin(k.heading) * spec.roam * dt, KID_RADIUS, this.hit);
      k.x = this.hit.x;
      k.z = this.hit.z;
      k.speed = spec.roam;
      if (this.hit.hit) this.wanderTourist(k);
    }
    if (k.throwIn > 0) return;
    const target = this.nearestSnake(k.x, k.z);
    if (target && !target.hasMagic('hidden') && Math.hypot(target.x - k.x, target.z - k.z) <= spec.reach) {
      k.throwIn = spec.throwEvery;
      k.heading = Math.atan2(target.z - k.z, target.x - k.x);
      k.pauseFor = 1.2; // hold still for the shot
      k.speed = 0;
      this.events.push({ type: 'photo', who: target.id, x: k.x, z: k.z });
    } else {
      k.throwIn = 0.6;
    }
  }

  /** A fresh spot near the tourist's sight: on dry land, clear of things, and off the bus routes. */
  private wanderTourist(k: Kid): void {
    k.wanderIn = this.rng.range(3, 7);
    if (this.rng.next() < 0.35) k.pauseFor = this.rng.range(1, 3); // stop and gawp
    for (let tries = 0; tries < 20; tries++) {
      const x = k.hx + this.rng.range(-TOURIST_ROAM, TOURIST_ROAM);
      const z = k.hz + this.rng.range(-TOURIST_ROAM, TOURIST_ROAM);
      if (!isFree(this.stage, x, z, KID_RADIUS + 0.5) || inWater(this.stage, x, z, 0.5)) continue;
      if (this.stage.routes?.some((r) => distanceToLoop(r.path, x, z) < TOURIST_KERB)) continue;
      k.tx = x;
      k.tz = z;
      return;
    }
    k.tx = k.hx;
    k.tz = k.hz;
  }

  /**
   * The school-trip crocodile: the teacher walks the path at a steady pace and every child keeps
   * exactly TRIP_GAP further back along it, so the line can never split (and never strays off it).
   * Untouchable: a snake in the way is nudged aside (meetKids). The naughty ones toss soggy chips.
   */
  private walkTrip(k: Kid, leader: Kid, place: number, dt: number): void {
    const path = this.stage.tripPath;
    if (!path || this.tripTotal <= 0) return;
    if (place === 0) k.along = (k.along + KIDS.trip.roam * dt) % this.tripTotal;
    else k.along = (leader.along - place * TRIP_GAP + this.tripTotal) % this.tripTotal;
    alongLoop(path, this.tripTotal, k.along, this.tripAt);
    k.x = this.tripAt.x;
    k.z = this.tripAt.z;
    k.heading = this.tripAt.heading;
    k.speed = KIDS.trip.roam;
    const throws = TRIP_THROWS[place] ?? null;
    if (!throws || k.throwIn > 0) return;
    const target = this.nearestSnake(k.x, k.z);
    if (target && Math.hypot(target.x - k.x, target.z - k.z) <= KIDS.trip.reach && this.projectiles.length < 24) {
      k.throwIn = KIDS.trip.throwEvery;
      this.lob(k, target, throws);
    } else {
      k.throwIn = 0.6;
    }
  }

  /** Is this snake close enough to a busker to dance? */
  private dancing(s: Snake): boolean {
    for (const b of this.buskers) if ((s.x - b.x) ** 2 + (s.z - b.z) ** 2 < BUSK_REACH * BUSK_REACH) return true;
    return false;
  }

  /**
   * Round and round the Royal Guard: the angle a snake's head sweeps round him while inside
   * GUARD_REACH. Leaving the ring, a jump (respawn) or doubling back too far starts again. Three
   * full laps: the `guard` event (his smile, a gem for the snake), then GUARD_COOL seconds' rest.
   */
  private lapGuard(s: Snake, dt: number): void {
    const g = this.stage.guard!;
    const id = s.id;
    if (this.guardCool[id] === undefined) {
      this.guardCool[id] = 0;
      this.guardSwept[id] = this.guardPeak[id] = 0;
      this.guardLast[id] = NaN;
    }
    if (this.guardCool[id] > 0) this.guardCool[id] -= dt;
    const reset = () => {
      this.guardSwept[id] = this.guardPeak[id] = 0;
      this.guardLast[id] = NaN;
    };
    if (this.guardCool[id] > 0 || Math.hypot(s.x - g.x, s.z - g.z) > GUARD_REACH) return reset();
    const a = Math.atan2(s.z - g.z, s.x - g.x);
    const last = this.guardLast[id];
    this.guardLast[id] = a;
    if (Number.isNaN(last)) return;
    const da = wrapAngle(a - last);
    if (Math.abs(da) > Math.PI / 2) return reset(); // a jump, not a slither
    const swept = (this.guardSwept[id] += da);
    this.guardPeak[id] = Math.max(this.guardPeak[id], Math.abs(swept));
    if (this.guardPeak[id] - Math.abs(swept) > GUARD_REVERSE) return reset(); // doubled back
    if (Math.abs(swept) < GUARD_LAPS * Math.PI * 2) return;
    reset();
    this.guardCool[id] = GUARD_COOL;
    s.score += 100;
    this.events.push({ type: 'guardSmile', who: id, x: g.x, z: g.z }); // the whole room sees him smile
    this.events.push({ type: 'guard', who: id, x: g.x, z: g.z }); // only `who` gets the gem
  }

  /** London's chatters (the tour guide, the Beefeater): a line now and then, when someone is near to hear it. */
  private chatterLondon(dt: number): void {
    const chatters = this.stage.chatters!;
    for (let i = 0; i < chatters.length; i++) {
      this.chatterIn[i] -= dt;
      if (this.chatterIn[i] > 0) continue;
      const c = chatters[i];
      const near = this.nearestSnake(c.at.x, c.at.z);
      if (!near || Math.hypot(near.x - c.at.x, near.z - c.at.z) > 16) {
        this.chatterIn[i] = 1; // nobody about: look again in a moment
        continue;
      }
      this.chatterIn[i] = this.rng.range(7, 12);
      this.events.push({ type: 'say', text: this.rng.pick(c.lines), x: c.at.x, z: c.at.z });
    }
  }

  /** The living statue: frozen, until a snake comes close. Then BOO! (and a rest before the next). */
  private statue(dt: number): void {
    const at = this.stage.statue!;
    if (this.statueRest > 0) {
      this.statueRest -= dt;
      return;
    }
    const s = this.nearestSnake(at.x, at.z);
    if (!s || Math.hypot(s.x - at.x, s.z - at.z) > STATUE_REACH + s.radius) return;
    this.statueRest = STATUE_REST;
    this.events.push({ type: 'boo', x: at.x, z: at.z });
  }

  /** Pick a fresh spot for a child to scamper to; runners roam wild and sometimes freeze to stare. */
  private wanderKid(k: Kid): void {
    const spread = k.kind === 'runner' ? 30 : 14;
    for (let tries = 0; tries < 20; tries++) {
      const x = k.x + this.rng.range(-spread, spread);
      const z = k.z + this.rng.range(-spread, spread);
      if (!isFree(this.stage, x, z, KID_RADIUS + 0.5)) continue;
      k.tx = x;
      k.tz = z;
      break;
    }
    k.wanderIn = this.rng.range(1.5, 4);
    if (k.kind === 'runner' && this.rng.next() < 0.3) k.pauseFor = this.rng.range(0.4, 1.2);
  }

  /** A child throws: aimed a little ahead of the snake, so it stands a chance but is still dodgeable. */
  private lob(k: Kid, target: Snake, kind: ProjectileKind): void {
    const speed = kind === 'pebble' ? 11 : kind === 'chip' ? 9 : 7;
    const flight = Math.hypot(target.x - k.x, target.z - k.z) / speed;
    const vel = target.baseSpeed * target.speedFactor;
    const aimX = target.x + Math.cos(target.heading) * vel * flight * 0.7;
    const aimZ = target.z + Math.sin(target.heading) * vel * flight * 0.7;
    const dx = aimX - k.x;
    const dz = aimZ - k.z;
    const d = Math.hypot(dx, dz) || 1;
    k.heading = Math.atan2(dz, dx);
    this.projectiles.push({ kind, x: k.x, z: k.z, dx: dx / d, dz: dz / d, speed, left: d, total: d });
    this.events.push({ type: 'lob', kind, x: k.x, z: k.z });
  }

  /** Fly the pebbles and kisses; a head that comes within reach anywhere along the flight cops it. */
  private updateProjectiles(dt: number): void {
    const B = this.stage.bounds;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pj = this.projectiles[i];
      const step = pj.speed * dt;
      pj.x += pj.dx * step;
      pj.z += pj.dz * step;
      pj.left -= step;
      const hitR = pj.kind === 'kiss' ? 1.5 : 1.2;
      const best = this.nearestSnake(pj.x, pj.z);
      if (best && Math.hypot(best.x - pj.x, best.z - pj.z) <= hitR) {
        this.strikeProjectile(pj, best);
        this.projectiles.splice(i, 1);
        continue;
      }
      const out = pj.x < B.minX || pj.x > B.maxX || pj.z < B.minZ || pj.z > B.maxZ;
      if (pj.left <= 0 || out) this.projectiles.splice(i, 1);
    }
  }

  private strikeProjectile(pj: Projectile, best: Snake): void {
    if (pj.kind === 'pebble' || pj.kind === 'chip') {
      if (best.immune > 0 || best.hasMagic('wings')) return; // a graze while already blinking (or up in the air): no double dip
      if (this.rise(best)) return;
      best.immune = OUCH_GRACE * 0.5;
      const lost = best.mass < 1 ? 0 : Math.min(6, Math.max(1, best.mass * 0.05)) * (1 - best.rockGuard);
      if (lost > 0) this.shed(best, lost, PELLET_RETURN, 2);
      // A soggy chip says so (London's school trip); the pebble's event is unchanged.
      this.events.push(pj.kind === 'chip' ? { type: 'pelt', who: best.id, x: best.x, z: best.z, lost, chip: true } : { type: 'pelt', who: best.id, x: best.x, z: best.z, lost });
    } else {
      const gem = this.rng.next() < 0.25;
      best.gain(4);
      this.events.push({ type: 'kiss', who: best.id, x: best.x, z: best.z, gem });
    }
  }

  /** A snake ran into a child: the child is never hurt — the snake is nudged, the child scatters. */
  private meetKids(s: Snake, dt: number): void {
    let trip = false;
    for (const k of this.kids) {
      const reach = s.radius + KID_RADIUS;
      if ((s.x - k.x) ** 2 + (s.z - k.z) ** 2 >= reach * reach) continue;
      if (k.kind === 'trip') {
        // The crocodile is a moving wall, but never a trap: held against it a while, you are let through.
        trip = true;
        if ((this.tripHeld[s.id] ?? 0) > TRIP_LET_THROUGH) continue;
      }
      this.shove(s, k.x, k.z, reach, dt);
      // Send the child scampering out of the way (London's trip, buskers and tourists hold their ground).
      if (k.kind === 'naughty' || k.kind === 'nice' || k.kind === 'runner') {
        k.tx = k.x + (k.x - s.x);
        k.tz = k.z + (k.z - s.z);
        k.pauseFor = 0;
      }
      if (s.bumpQuiet <= 0) {
        s.bumpQuiet = BUMP_QUIET;
        this.events.push({ type: 'bump', who: s.id, what: 'kid' });
      }
    }
    if (trip) this.tripHeld[s.id] = (this.tripHeld[s.id] ?? 0) + dt;
    else if (this.tripHeld[s.id]) this.tripHeld[s.id] = 0;
  }

  /** Miss Sami natters with the mum by the road mouth: an occasional warm line, if the stage has her. */
  private chatterSami(dt: number): void {
    if (!this.stage.greeters) return;
    this.samiSayIn -= dt;
    if (this.samiSayIn > 0) return;
    this.samiSayIn = this.rng.range(7, 13);
    const sami = this.stage.greeters.sami;
    this.events.push({ type: 'say', text: this.rng.pick(SAMI_LINES), x: sami.x, z: sami.z });
  }

  // ---------------------------------------------------------------- the fantastic creatures (the woods & the Glade)

  /** Shy, ethereal things: they drift near the Glade, and bolt from any snake that comes near. */
  private updateCreatures(dt: number): void {
    for (const c of this.creatures) {
      const spec = CREATURES[c.kind];
      if (c.respawnIn > 0) {
        c.respawnIn -= dt;
        c.speed = 0;
        if (c.respawnIn <= 0) {
          const p = creatureSpot(this.stage, this.rng, c.kind); // fade back somewhere new in the woods (or its London home)
          c.x = c.wx = p.x;
          c.z = c.wz = p.z;
        }
        continue;
      }
      c.wanderIn -= dt;
      const near = this.nearestSnake(c.x, c.z);
      const d = near ? Math.hypot(near.x - c.x, near.z - c.z) : Infinity;
      let speed: number;
      if (near && d < spec.alert) {
        c.heading = turnToward(c.heading, Math.atan2(c.z - near.z, c.x - near.x), 5 * dt);
        speed = spec.flee;
      } else {
        if (c.wanderIn <= 0 || Math.hypot(c.x - c.wx, c.z - c.wz) < 1) this.wanderCreature(c);
        c.heading = turnToward(c.heading, Math.atan2(c.wz - c.z, c.wx - c.x), 2 * dt);
        speed = spec.flee * 0.3; // an ethereal drift while nothing is near
      }
      resolveAshore(this.stage, c.x, c.z, c.x + Math.cos(c.heading) * speed * dt, c.z + Math.sin(c.heading) * speed * dt, spec.radius, this.hit, this.stage.logs);
      c.x = this.hit.x;
      c.z = this.hit.z;
      c.speed = speed;
      if (this.hit.hit) {
        c.heading = slideAlong(c.heading, this.hit.nx, this.hit.nz);
        this.wanderCreature(c);
      }
    }
  }

  private wanderCreature(c: Creature): void {
    for (let tries = 0; tries < 20; tries++) {
      const x = c.x + this.rng.range(-14, 14);
      const z = c.z + this.rng.range(-14, 14);
      if (!isFree(this.stage, x, z, CREATURES[c.kind].radius + 0.5, this.stage.logs)) continue;
      c.wx = x;
      c.wz = z;
      break;
    }
    c.wanderIn = this.rng.range(2, 5);
  }

  /** A touch at any size catches a creature — no tier gate. It fades, and its magic bursts on the snake. */
  private meetCreatures(s: Snake): void {
    for (const c of this.creatures) {
      if (c.respawnIn > 0) continue;
      const reach = s.biteReach * GULP_REACH + CREATURES[c.kind].radius;
      if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 > reach * reach) continue;
      this.castMagic(s, c.kind);
      c.respawnIn = CREATURE_RESPAWN;
      break; // one blessing per tick
    }
  }

  /** Grant a creature's magic: an instant gift, a timed buff, or both. `gems` is credited to the client. */
  private castMagic(s: Snake, kind: CreatureKind): void {
    let gems = 0;
    switch (kind) {
      case 'stag': {
        // Stag's Blessing: leap straight to the next size tier, a big score, a halo.
        const next = TIERS[Math.min(TIERS.length - 1, s.tier + 1)];
        if (s.mass < next.mass) s.mass = next.mass;
        s.score += 500;
        s.giveMagic('halo', 8);
        gems = 3;
        break;
      }
      case 'unicorn':
        s.giveMagic('rainbow', 20); // Rainbow Rush: every bite golden for a while
        s.score += 150;
        gems = 1;
        break;
      case 'owl':
        s.giveMagic('owl', 30); // Owl Eyes: reveal the creatures on the minimap...
        s.luckyCards += 1; // ...and the next card is epic-or-better
        s.score += 120;
        gems = 1;
        break;
      case 'kitsune':
        s.giveMagic('hidden', 15); // Fox Trick: predators and rivals cannot see you
        s.score += 120;
        gems = 1;
        break;
      case 'pixie':
        s.giveMagic('magnet', 20); // Pixie Dust: a huge food magnet
        s.score += 100;
        gems = 1;
        break;
      case 'squirrel':
        s.gain(28); // Acorn Hoard: a burst of mass
        s.score += 80;
        gems = 2;
        break;
      case 'frog': {
        // Royal Ribbit: the nearest predator is rooted, harmless, for a spell (turned to a frog in spirit).
        const p = this.nearestPredatorTo(s.x, s.z);
        if (p) {
          p.frozenFor = Math.max(p.frozenFor, 10);
          p.scaredFor = 0;
        }
        s.score += 100;
        gems = 1;
        break;
      }
      case 'wisp':
        this.wispCache(s); // Will-o'-the-wisp: it leads you to a golden-food cache
        gems = 2;
        break;
      // London's legends.
      case 'dragon':
        s.giveMagic('wings', WINGS_FOR); // Dragon Wings: up you go, over everything
        s.score += 300;
        gems = 2;
        break;
      case 'lionroyal':
        this.roar(s); // Mighty Roar: a golden ring, everything near blown back
        s.score += 150;
        gems = 1;
        break;
      case 'phoenix':
        s.giveMagic('phoenix', PHOENIX_FOR); // Rise Again: the next hit is undone
        s.score += 150;
        gems = 1;
        break;
      case 'mermaid':
        s.giveMagic('river', RIVER_FOR); // River Rider: the Thames is a fast lane
        s.score += 120;
        gems = 1;
        break;
      case 'ghost':
        s.giveMagic('hidden', 15); // Boo!: predators and rivals cannot see you
        s.score += 120;
        gems = 1;
        break;
      case 'gog':
        s.giveMagic('giant', GIANT_FOR); // Giant Snake: the next size's gulp, and buses bounce off you
        s.score += 150;
        gems = 1;
        break;
      case 'fairy':
        s.giveMagic('magnet', 20); // Fairy Dust: a huge food magnet
        s.score += 100;
        gems = 1;
        break;
      case 'pearly':
        this.pearlyTrail(s); // The Pearly Lights: a trail of buttons to a treasure
        s.score += 100;
        gems = 1;
        break;
    }
    this.events.push({ type: 'magic', kind, who: s.id, x: s.x, z: s.z, gems });
  }

  // ---------------------------------------------------------------- London's legends (A5)

  /** Out of sight of the beasts and the rivals: hidden (Fox Trick, Boo!) or up in the air (Dragon Wings). */
  private unseen(s: Snake): boolean {
    return s.hasMagic('hidden') || s.hasMagic('wings') || s.carried !== null;
  }

  /** Rise Again: if the phoenix is with this snake, it undoes the hit about to land. True if it did. */
  private rise(s: Snake): boolean {
    if (!s.hasMagic('phoenix')) return false;
    s.clearMagic('phoenix');
    s.immune = Math.max(s.immune, OUCH_GRACE * 1.5);
    s.gain(RISE_GROWTH);
    this.events.push({ type: 'rise', who: s.id, x: s.x, z: s.z });
    return true;
  }

  /** Could a landing snake of radius `r` come down at (x, z)? Free, dry, and clear of the traffic. */
  private landable(x: number, z: number, r: number): boolean {
    if (!isFree(this.stage, x, z, r, this.snakeSolids)) return false;
    for (const v of this.vehicles) if (Math.hypot(v.x - x, v.z - z) < VEHICLES[v.kind].length / 2 + r + 0.5) return false;
    return true;
  }

  /**
   * Dragon Wings wore off: come down where it is, if that is free, dry ground; otherwise at the
   * nearest spot that is, searched ring by ring outward (ahead first). Never in a solid or the river.
   */
  land(s: Snake): void {
    const { x, z } = this.landing(s.x, s.z, s.heading, s.radius + 0.3);
    // Moved to free ground: lay the body out afresh there, so no trail is left strung through a wall.
    if (x !== s.x || z !== s.z) s.placeAt(x, z, s.heading);
    s.touchingWall = s.wasTouchingWall = false;
    s.immune = Math.max(s.immune, 1);
    this.events.push({ type: 'land', who: s.id, x, z });
  }

  /**
   * The nearest spot to (x0, z0) where a snake of radius `r` could come down (landable), searched ring
   * by ring outward, the way it faces (`heading`) first; the stage's fallback spot if nothing is near.
   */
  private landing(x0: number, z0: number, heading: number, r: number): { x: number; z: number } {
    const out = this.landSpot;
    out.x = x0;
    out.z = z0;
    if (this.landable(x0, z0, r)) return out;
    for (let ring = 1; ring <= 120; ring++) {
      const d = ring * 0.6;
      const n = Math.max(8, Math.ceil(d * 5));
      for (let k = 0; k < n; k++) {
        const a = heading + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * ((Math.PI * 2) / n);
        const cx = x0 + Math.cos(a) * d;
        const cz = z0 + Math.sin(a) * d;
        if (!this.landable(cx, cz, r)) continue;
        out.x = cx;
        out.z = cz;
        return out;
      }
    }
    out.x = this.stage.fallbackSpot.x;
    out.z = this.stage.fallbackSpot.z;
    return out;
  }

  /** Mighty Roar: beasts nearby run (lions home, ravens to the Tower); rivals are gently blown back. */
  private roar(s: Snake): void {
    s.giveMagic('roar', 1.5);
    this.events.push({ type: 'ring', who: s.id, x: s.x, z: s.z, r: ROAR_REACH });
    this.scarePredators(s.x, s.z, ROAR_REACH, false);
    for (const o of this.snakes) {
      // Not the unseen (hidden or flying), nor anyone choosing a card or standing aside in a menu.
      if (o === s || !o.alive || this.unseen(o) || o.cards !== null || o.awayFor > 0) continue;
      const dx = o.x - s.x;
      const dz = o.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > ROAR_REACH) continue;
      const nx = d > 1e-5 ? dx / d : Math.cos(s.heading);
      const nz = d > 1e-5 ? dz / d : Math.sin(s.heading);
      resolveCircle(this.stage, o.x + nx * ROAR_PUSH, o.z + nz * ROAR_PUSH, o.radius, this.hit, this.snakeSolids);
      o.x = this.hit.x;
      o.z = this.hit.z;
      o.heading = Math.atan2(nz, nx);
      // A brief daze (frozen and untouchable, like a Freeze Puff): never a free bonk.
      o.frozenFor = Math.max(o.frozenFor, ROAR_STUN);
      o.immune = Math.max(o.immune, ROAR_STUN);
      this.events.push({ type: 'roared', who: o.id, by: s.id, x: o.x, z: o.z });
    }
  }

  /** The Pearly Lights: a line of glowing buttons from the snake to the nearest jewel (or a golden cache). */
  private pearlyTrail(s: Snake): void {
    let tx = NaN;
    let tz = NaN;
    let best = Infinity;
    for (const t of this.treasures) {
      if (t.respawnIn > 0) continue;
      const d = Math.hypot(t.x - s.x, t.z - s.z);
      if (d < best) {
        best = d;
        tx = t.x;
        tz = t.z;
      }
    }
    if (Number.isNaN(tx)) {
      // No jewel lying about: a cache of golden food a little way off, and the buttons lead there.
      for (let tries = 0; tries < 30; tries++) {
        const a = this.rng.range(0, Math.PI * 2);
        const d = this.rng.range(14, 24);
        const x = s.x + Math.cos(a) * d;
        const z = s.z + Math.sin(a) * d;
        if (!isFree(this.stage, x, z, 2)) continue;
        tx = x;
        tz = z;
        break;
      }
      if (Number.isNaN(tx)) return;
      this.cacheAt(tx, tz);
    }
    // One trail per snake: a fresh one replaces only this snake's own, never anyone else's.
    for (let i = this.buttons.length - 1; i >= 0; i--) if (this.buttons[i].owner === s.id) this.buttons.splice(i, 1);
    const d = Math.hypot(tx - s.x, tz - s.z);
    for (let k = 2, n = 0; k < d - 1 && n < BUTTON_MAX; k += BUTTON_STEP, n++) {
      const x = s.x + ((tx - s.x) * k) / d;
      const z = s.z + ((tz - s.z) * k) / d;
      if (isFree(this.stage, x, z, 0.3, this.hazards)) this.buttons.push({ x, z, born: this.tick, owner: s.id });
    }
    this.events.push({ type: 'pearly', who: s.id, x: s.x, z: s.z, tx, tz });
  }

  /** Gather a handful of food round (x, z) and turn it golden. */
  private cacheAt(x0: number, z0: number): void {
    let n = 0;
    for (const f of this.foods) {
      if (n >= 6) break;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(0.5, 2.5);
      const x = x0 + Math.cos(a) * r;
      const z = z0 + Math.sin(a) * r;
      if (!isFree(this.stage, x, z, 0.5, this.hazards)) continue;
      f.x = x;
      f.z = z;
      f.golden = true;
      f.born = this.tick;
      n++;
    }
  }

  private eatButtons(s: Snake): void {
    const reach2 = s.biteReach * s.biteReach;
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if ((b.x - s.x) ** 2 + (b.z - s.z) ** 2 > reach2) continue;
      const points = s.gain(BUTTON_MASS);
      this.events.push({ type: 'button', who: s.id, x: b.x, z: b.z, points });
      this.buttons.splice(i, 1);
    }
  }

  private expireButtons(): void {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      if ((this.tick - this.buttons[i].born) * STEP > BUTTON_LIFE) this.buttons.splice(i, 1);
    }
  }

  /** The Crown Jewels: a touch picks one up (any size); all five is ROYAL. A crowned snake leaves them for others. */
  private meetJewels(s: Snake): void {
    if (s.crowned) return;
    for (let i = 0; i < this.treasures.length; i++) {
      const t = this.treasures[i];
      if (t.respawnIn > 0) continue;
      const reach = s.biteReach + JEWEL_REACH;
      if ((t.x - s.x) ** 2 + (t.z - s.z) ** 2 > reach * reach) continue;
      t.respawnIn = JEWEL_RESPAWN;
      s.jewels++;
      s.score += JEWEL_SCORE;
      this.events.push({ type: 'jewel', who: s.id, i, x: t.x, z: t.z, n: s.jewels });
      if (s.jewels >= JEWELS_FOR_CROWN) {
        s.crowned = true;
        s.score += ROYAL_SCORE;
        this.events.push({ type: 'royal', who: s.id, x: s.x, z: s.z });
      }
      return; // one a tick
    }
  }

  /** A taken jewel turns up again elsewhere, after a while. */
  private updateTreasures(dt: number): void {
    const spots = this.stage.jewelSpots ?? [];
    for (const t of this.treasures) {
      if (t.respawnIn <= 0) continue;
      t.respawnIn -= dt;
      if (t.respawnIn <= 0) {
        t.respawnIn = 0;
        moveTreasure(t, this.treasures, spots, this.rng);
      }
    }
  }

  private nearestPredatorTo(x: number, z: number): Predator | null {
    let best: Predator | null = null;
    let bestD = Infinity;
    for (const p of this.predators) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Relocate a handful of food around the snake and turn it golden: the wisp's hidden cache. */
  private wispCache(s: Snake): void {
    let n = 0;
    for (const f of this.foods) {
      if (n >= 6) break;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(2, 6);
      const x = s.x + Math.cos(a) * r;
      const z = s.z + Math.sin(a) * r;
      if (!isFree(this.stage, x, z, 0.5)) continue;
      f.x = x;
      f.z = z;
      f.golden = true;
      f.born = this.tick;
      n++;
    }
  }

  private shed(s: Snake, lost: number, share: number, n: number): void {
    const tail = s.length;
    const spread = Math.min(0.7, tail / n);
    for (let i = 0; i < n; i++) {
      s.sampleAt(Math.max(0, tail - 0.3 - i * spread), this.p);
      this.pellets.push({ x: this.p.x, z: this.p.z, value: (lost * share) / n, born: this.tick });
    }
    if (this.pellets.length > PELLET_CAP) this.pellets.splice(0, this.pellets.length - PELLET_CAP);
    s.mass = Math.max(0, s.mass - lost);
  }

  private bumpCooper(s: Snake, dt: number): void {
    const c = this.cooper;
    const reach = s.radius + COOPER_RADIUS;
    if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 >= reach * reach) return;
    this.shove(s, c.x, c.z, reach, dt);
    if (c.bumped(this)) this.events.push({ type: 'bump', who: s.id, what: 'cooper' });
  }

  private meetAnimals(s: Snake, dt: number, flying = false): void {
    // Gog & Magog: a giant gulps like the next size up.
    const tier = s.hasMagic('giant') ? s.tier + 1 : s.tier;
    for (const a of this.animals) {
      const spec = ANIMALS[a.kind];
      const d2 = (a.x - s.x) ** 2 + (a.z - s.z) ** 2;

      if (tier >= spec.tier) {
        const reach = s.biteReach * GULP_REACH + spec.radius;
        if (d2 > reach * reach) continue;
        const points = s.gain(spec.value);
        this.events.push({ type: 'gulp', who: s.id, kind: a.kind, x: a.x, z: a.z, points });
        placeAnimal(a, this, RESPAWN_CLEARANCE);
        continue;
      }

      // Too big to swallow: it stands its ground and the snake goes boing (a flyer just passes over).
      if (flying) continue;
      const reach = s.radius + spec.radius;
      if (d2 >= reach * reach) continue;
      this.shove(s, a.x, a.z, reach, dt);
      if (a.boopCooldown > 0) continue;
      a.boopCooldown = a.kind === 'goat' ? GOAT_COOLDOWN : BOOP_COOLDOWN;
      s.speedFactor = Math.min(s.speedFactor, BOOP_SLOWDOWN);
      this.events.push({ type: 'boop', who: s.id, kind: a.kind, x: a.x, z: a.z });
    }
  }

  // ---------------------------------------------------------------- eating

  private swallowFood(s: Snake, f: Food, toasted: boolean): void {
    // Rainbow Rush (the Unicorn): every bite counts golden while it lasts.
    const golden = f.golden || s.hasMagic('rainbow');
    const value = FOOD_VALUE[f.kind] * (golden ? GOLDEN_MULTIPLIER : 1) * (toasted ? 2 : 1);
    const points = s.gain(value);
    this.events.push({ type: 'eat', who: s.id, kind: f.kind, x: f.x, z: f.z, points, golden, toasted });
    const kind = f.kind;
    placeFood(f, this.rng, this.stage, this.tick, s.x, s.z, 8, this.hazards, s.luck);
    // London's menu only (no other stage grows these): a cuppa's zoom, and the Tea Time combo.
    if (kind === 'tea') s.teaFor = TEA_ZOOM_FOR;
    if (TEA_TIME.includes(kind)) this.teaTime(s, kind);
  }

  /** Sandwich, then scone, then sponge, inside TEA_TIME_WITHIN seconds (other food in between is fine). */
  private teaTime(s: Snake, kind: FoodKind): void {
    if (s.teaCool > 0) return;
    const step = TEA_TIME.indexOf(kind);
    if (step === 0) {
      s.teaStep = 1;
      s.teaFrom = this.tick;
      return;
    }
    if (step !== s.teaStep || (this.tick - s.teaFrom) * STEP > TEA_TIME_WITHIN) {
      s.teaStep = 0; // out of order: start again with a sandwich
      return;
    }
    s.teaStep++;
    if (s.teaStep < TEA_TIME.length) return;
    s.teaStep = 0;
    s.teaCool = TEA_TIME_COOL;
    s.score += TEA_TIME_BONUS;
    this.cakeStand(s);
    this.events.push({ type: 'teatime', who: s.id, x: s.x, z: s.z });
  }

  /** Bring a ring of afternoon-tea treats out around the snake (food borrowed from elsewhere on the map). */
  private cakeStand(s: Snake): void {
    let i = 0;
    const ring = Math.max(3, s.biteReach + 1.5); // out of reach, so the stand is not swallowed in one gulp
    for (let n = 0; n < TEA_TIME_TREATS; n++) {
      const a = (n / TEA_TIME_TREATS) * Math.PI * 2 + s.heading;
      const x = s.x + Math.cos(a) * ring;
      const z = s.z + Math.sin(a) * ring;
      if (!isFree(this.stage, x, z, 0.5, this.hazards)) continue;
      // Borrow the next food that is not already close by.
      while (i < this.foods.length && (this.foods[i].x - s.x) ** 2 + (this.foods[i].z - s.z) ** 2 < 100) i++;
      if (i >= this.foods.length) return;
      const f = this.foods[i++];
      f.x = x;
      f.z = z;
      f.kind = TEA_STAND[n % TEA_STAND.length];
      f.golden = false;
      f.born = this.tick;
    }
  }

  private swallowPellet(s: Snake, index: number): void {
    const p = this.pellets[index];
    const points = s.gain(p.value, 5);
    this.events.push({ type: 'pellet', who: s.id, x: p.x, z: p.z, points });
    this.pellets.splice(index, 1);
  }

  private eat(s: Snake): void {
    const reach2 = s.biteReach * s.biteReach;
    for (const f of this.foods) {
      if ((f.x - s.x) ** 2 + (f.z - s.z) ** 2 <= reach2) this.swallowFood(s, f, false);
    }
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      if ((p.x - s.x) ** 2 + (p.z - s.z) ** 2 <= reach2) this.swallowPellet(s, i);
    }
  }

  private expirePellets(): void {
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      if (this.tick - this.pellets[i].born > PELLET_LIFE_TICKS) this.pellets.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- upgrades at work

  /** Magnet Tail: food and pellets inside the pull drift to the head. Pixie Dust widens it hugely. */
  private pullFood(s: Snake, dt: number): void {
    const reach = Math.max(s.magnet, s.hasMagic('magnet') ? PIXIE_MAGNET : 0);
    if (reach <= 0) return;
    const r2 = reach * reach;
    const solids = this.stage.water ? (this.dryStage ??= dryTerrain(this.stage)) : this.stage;
    const pull = (o: { x: number; z: number }) => {
      const dx = s.x - o.x;
      const dz = s.z - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < 1e-6) return;
      const d = Math.sqrt(d2);
      const move = Math.min(d, MAGNET_PULL * dt);
      const nx = o.x + (dx / d) * move;
      const nz = o.z + (dz / d) * move;
      // Fences and benches still count: food stops at them instead of sliding through. Water
      // does not: a swimmer's magnet pulls pellets across the river (and bank food out to it).
      if (!isFree(solids, nx, nz, 0.25, this.hazards)) return;
      o.x = nx;
      o.z = nz;
    };
    for (const f of this.foods) pull(f);
    for (const p of this.pellets) pull(p);
  }

  /** Where bee `i` of a snake's Bee Buddies is right now. Shared with the renderer. */
  beeAt(s: Snake, i: number, out: { x: number; z: number }): void {
    beePosition(this.tick, s, i, out);
  }

  private bees(s: Snake): void {
    for (let i = 0; i < s.bees; i++) {
      this.beeAt(s, i, this.p);
      const bx = this.p.x;
      const bz = this.p.z;
      for (const f of this.foods) {
        if ((f.x - bx) ** 2 + (f.z - bz) ** 2 <= BEE_REACH * BEE_REACH) this.swallowFood(s, f, false);
      }
      for (let k = this.pellets.length - 1; k >= 0; k--) {
        const p = this.pellets[k];
        if ((p.x - bx) ** 2 + (p.z - bz) ** 2 <= BEE_REACH * BEE_REACH) this.swallowPellet(s, k);
      }
    }
  }

  private inBreath(s: Snake, x: number, z: number, range: number): boolean {
    const dx = x - s.x;
    const dz = z - s.z;
    if (dx * dx + dz * dz > range * range) return false;
    return Math.abs(wrapAngle(Math.atan2(dz, dx) - s.heading)) < BREATH_HALF_ANGLE;
  }

  /** Dragon Breath: a cartoon puff that toasts food, dazzles animals and makes rivals sneeze out a few segments. */
  private breathe(s: Snake, dt: number): void {
    if (s.breathLevel <= 0) return;
    s.breathIn -= dt;
    if (s.breathIn > 0) return;
    const range = 4 + s.breathLevel;

    // Only puff when there is something in front worth puffing at.
    let worth = false;
    for (const f of this.foods) if (this.inBreath(s, f.x, f.z, range)) { worth = true; break; }
    if (!worth) for (const o of this.snakes) if (o !== s && o.alive && o.immune <= 0 && !o.hasMagic('wings') && this.inBreath(s, o.x, o.z, range)) { worth = true; break; }
    if (!worth) for (const a of this.animals) if (s.tier >= ANIMALS[a.kind].tier && this.inBreath(s, a.x, a.z, range)) { worth = true; break; }
    if (!worth) for (const p of this.predators) if (awake(p) && this.inBreath(s, p.x, p.z, range)) { worth = true; break; }
    if (!worth) {
      s.breathIn = BREATH_RECHECK;
      return;
    }

    s.breathIn = 4.2 - 0.4 * s.breathLevel;
    this.events.push({ type: 'breath', who: s.id, x: s.x, z: s.z, heading: s.heading, range });
    for (const f of this.foods) if (this.inBreath(s, f.x, f.z, range)) this.swallowFood(s, f, true);
    for (const a of this.animals) {
      if (s.tier >= ANIMALS[a.kind].tier && this.inBreath(s, a.x, a.z, range)) a.dazed = DAZE;
    }
    for (const p of this.predators) {
      if (awake(p) && this.inBreath(s, p.x, p.z, range)) this.spook(p, false);
    }
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || o.hasMagic('wings') || !this.inBreath(s, o.x, o.z, range)) continue;
      if (this.rise(o)) continue; // the phoenix takes the scorch
      o.immune = OUCH_GRACE;
      // Scorch it smaller, capped like a rock bonk so it stays fair on the biggest rivals.
      const lost = o.mass < 1 ? 0 : Math.min(OUCH_MAX, Math.max(2, o.mass * BREATH_SHARE));
      if (lost > 0) this.shed(o, lost, PELLET_RETURN, 4);
      this.events.push({ type: 'sneeze', who: o.id, by: s.id, x: o.x, z: o.z });
    }
  }

  // ---------------------------------------------------------------- London's set pieces (A6)

  /**
   * The set pieces' tick: Tower Bridge's road (river while it is up), the parade's marchers, and
   * whatever happens on this exact tick: the launch as the bascules rise, a BONG, the confetti, a
   * firework, the Red Arrows overhead. All keyed off the tick (setPieces.ts): the phones agree.
   */
  private setPieces(sp: SetPieceSpots): void {
    const t = this.tick;
    this.stage.bridges = bridgesAt(sp, this.bridgesDown, t);
    this.marcherCount = paradeAt(t, sp.parade, this.marchers);
    this.withParade.length = 0;
    if (this.marcherCount > 0) {
      for (const h of this.snakeSolids) this.withParade.push(h);
      for (let i = 0; i < this.marcherCount; i++) {
        const c = this.paradeSolids[i] ?? (this.paradeSolids[i] = { x: 0, z: 0, r: MARCHER_R });
        c.x = this.marchers[i].x;
        c.z = this.marchers[i].z;
        this.withParade.push(c);
      }
    }
    if (liftRises(t)) this.liftSpan(sp);
    const bong = bongAt(t);
    if (bong) this.bong(sp, bong.k, bong.n);
    if (confettiAt(t, sp.parade, SPOT)) this.confetti(SPOT.x, SPOT.z, t);
    if (burstAt(t, sp, this.setPieceSeed, BURST)) this.firework(sp, BURST);
    if (arrowsAt(t, sp, this.setPieceSeed, ARROWS)) this.flyPast(ARROWS);
  }

  /** Is the snake's head against (within `slack` of touching) one of the parade's marchers? */
  private byMarcher(s: Snake, slack: number): boolean {
    for (let i = 0; i < this.marcherCount; i++) {
      const m = this.marchers[i];
      const reach = s.radius + MARCHER_R + slack;
      if ((s.x - m.x) ** 2 + (s.z - m.z) ** 2 < reach * reach) return true;
    }
    return false;
  }

  /**
   * Move some food, from well away from everyone, to (x, z): how the set pieces scatter treats
   * without growing the food list (so a room's food deltas stay as they are). False if none was free.
   */
  private borrowFood(x: number, z: number, golden: boolean, kind?: FoodKind): boolean {
    // A treat already lies there (an earlier ring, a cache): leave the spot be.
    if (this.foods.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 1)) return false;
    const n = this.foods.length;
    for (let tries = 0; tries < n; tries++) {
      const f = this.foods[this.borrowAt];
      this.borrowAt = (this.borrowAt + 1) % n;
      if (f.born >= this.tick - 60 || !this.clearOfSnakes(f.x, f.z, BORROW_CLEAR)) continue;
      f.x = x;
      f.z = z;
      f.golden = golden;
      if (kind) f.kind = kind;
      f.born = this.tick;
      return true;
    }
    return false;
  }

  /** BONG! A ring of golden treats bursts out round Big Ben (wider each bong, turning a little each time). */
  private bong(sp: SetPieceSpots, k: number, n: number): void {
    const c = sp.bigBen;
    const r = 7 + (k % 3) * 2;
    const ring = Math.max(2, Math.min(BONG_RING, Math.round(BONG_MINUTE / n)));
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + k * 0.7;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (isFree(this.stage, x, z, 0.6, this.hazards)) this.borrowFood(x, z, true);
    }
    this.events.push({ type: 'bong', k, n, x: c.x, z: c.z });
  }

  /**
   * The bascules start to rise: anyone on them slides down the ramp to the nearer end, WHEE!, with
   * a burst of speed; anything else standing on them steps off. The span is river from now on.
   */
  private liftSpan(sp: SetPieceSpots): void {
    const span = sp.span;
    const end = (x: number, out: number) => (x < span.x ? span.x - span.w / 2 - out : span.x + span.w / 2 + out);
    // A cab still on it (held up crossing during the bells) is waved on across, first.
    for (const v of this.vehicles) {
      const reach = VEHICLES[v.kind].length / 2 + 0.5;
      for (let k = 0; k < 160 && Math.abs(v.x - span.x) < span.w / 2 + reach && Math.abs(v.z - span.z) < span.d / 2 + 0.5; k++) {
        placeVehicle(v, this.lanes[v.route], v.s + 0.25);
      }
    }
    // Never into the back of the one in front: anything now too close ahead is nudged on too (a short chain).
    for (let pass = 0; pass < this.vehicles.length; pass++) {
      let moved = false;
      for (const v of this.vehicles) {
        const lane = this.lanes[v.route];
        for (const o of this.vehicles) {
          if (o === v || o.route !== v.route) continue;
          const gap = ahead(lane, v.s, o.s) - (VEHICLES[v.kind].length + VEHICLES[o.kind].length) / 2 - 1;
          if (gap >= 0 || ahead(lane, v.s, o.s) > lane.length / 2) continue;
          placeVehicle(o, lane, o.s - gap);
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const s of this.snakes) {
      if (!s.alive || s.carried || s.hasMagic('wings') || !inBox(span, s.x, s.z)) continue;
      const heading = s.x < span.x ? Math.PI : 0;
      const z = Math.min(span.z + span.d / 2 - 1.2, Math.max(span.z - span.d / 2 + 1.2, s.z));
      const at = this.landing(end(s.x, 3.5), z, heading, s.radius + 0.3);
      s.placeAt(at.x, at.z, heading);
      s.launchFor = LAUNCH_FOR;
      s.immune = Math.max(s.immune, 1.5);
      s.touchingWall = s.wasTouchingWall = false;
      this.events.push({ type: 'launch', who: s.id, x: at.x, z: at.z });
    }
    for (const a of this.animals) if (inBox(span, a.x, a.z)) a.x = end(a.x, 1.5);
    for (const c of this.creatures) if (inBox(span, c.x, c.z)) c.x = end(c.x, 1.5);
    for (const p of this.predators) if (p.kind !== 'raven' && inBox(span, p.x, p.z)) p.x = end(p.x, 1.5);
  }

  /** Sweets drop behind the parade, for whoever is following the band (only if someone is). */
  private confetti(x: number, z: number, t: number): void {
    if (this.clearOfSnakes(x, z, 10) || !isFree(this.stage, x, z, 0.5, this.hazards)) return;
    this.borrowFood(x, z, false, CONFETTI[Math.floor(t / 120) % CONFETTI.length]);
  }

  /** A firework bursts over the river: a golden treat lands on the bank below; the finale's sparkles are gems. */
  private firework(sp: SetPieceSpots, b: Burst): void {
    alongPath(sp.river, projectOnPath(sp.river, b.x, b.z), SPOT);
    for (const side of b.k % 2 === 0 ? [1, -1] : [-1, 1]) {
      const x = b.x - Math.sin(SPOT.heading) * 9.5 * side;
      const z = b.z + Math.cos(SPOT.heading) * 9.5 * side;
      if (isFree(this.stage, x, z, 0.6, this.hazards) && this.borrowFood(x, z, true)) break;
    }
    if (!b.finale) return;
    // One finale gem per snake per show, and only for someone actually watching (not riding, not in a menu).
    const show = Math.floor(this.tick / FIREWORKS_EVERY);
    for (const s of this.snakes) {
      if (!s.alive || s.carried || s.awayFor > 0 || this.treatShow[s.id] === show) continue;
      if (Math.hypot(s.x - b.x, s.z - b.z) >= FINALE_REACH) continue;
      this.treatShow[s.id] = show;
      this.events.push({ type: 'treat', who: s.id, x: s.x, z: s.z });
    }
  }

  /** The Red Arrows overhead: whoever is under the lead jet's track gets the red, white and blue trail. */
  private flyPast(a: Arrows): void {
    for (const s of this.snakes) {
      if (!s.alive || s.rwb || Math.hypot(s.x - a.x, s.z - a.z) > ARROWS_REACH) continue;
      s.rwb = true;
      this.events.push({ type: 'arrows', who: s.id, x: s.x, z: s.z });
    }
  }

  /** A snake slithering about London's set pieces: the wobbly bridge, the Tube, the Eye, the river bus, the parade. */
  private meetSetPieces(s: Snake, sp: SetPieceSpots, dt: number): void {
    const id = s.id;
    this.tubeCool[id] = Math.max(0, (this.tubeCool[id] ?? 0) - dt);
    this.eyeCool[id] = Math.max(0, (this.eyeCool[id] ?? 0) - dt);
    this.boatCool[id] = Math.max(0, (this.boatCool[id] ?? 0) - dt);
    // Pressed against the parade: the clock toward being let through.
    this.paradeHeld[id] = this.marcherCount > 0 && this.byMarcher(s, 0.05) ? (this.paradeHeld[id] ?? 0) + dt : 0;

    // The Millennium Bridge sways: a lazy sideways push, a bit more for a bigger snake (never off the deck).
    const deck = sp.millennium;
    const on = !s.swimming && inBox(deck, s.x, s.z);
    if (on) {
      if (!this.wobbling[id]) this.events.push({ type: 'wobble', who: id, x: s.x, z: s.z });
      s.x = wobbled(deck, s.x, s.radius, this.tick, dt);
    }
    this.wobbling[id] = on;

    // The Tube: step into one station, out at the next. Arriving (or starting) in one, you must step out first.
    const ports = this.stage.portals;
    if (ports) {
      let inside = -1;
      for (let i = 0; i < ports.length && inside < 0; i++) if (Math.hypot(s.x - ports[i].at.x, s.z - ports[i].at.z) <= TUBE_REACH) inside = i;
      const was = this.tubeAt[id] ?? inside;
      this.tubeAt[id] = inside;
      if (inside >= 0 && inside !== was && this.tubeCool[id] <= 0) {
        this.warp(s, inside);
        return;
      }
    }

    // The London Eye: into the capsule at the bottom, any size (one capsule, one ride).
    const eye = sp.eye.board;
    if (this.eyeCool[id] <= 0 && Math.hypot(s.x - eye.x, s.z - eye.z) < s.radius + 0.9) {
      s.carried = { by: 'eye', until: this.tick + EYE_RIDE, pier: -1 };
      s.x = eye.x;
      s.z = eye.z;
      s.immune = Math.max(s.immune, 0.5);
      this.events.push({ type: 'ride', who: id, by: 'eye', on: true, x: eye.x, z: eye.z });
      return;
    }

    // The river bus: on at a pier while it is tied up there (and not about to cast off).
    if (this.boatCool[id] <= 0) {
      boatAt(this.tick, sp, BOAT);
      const pier = BOAT.dock >= 0 ? sp.piers[BOAT.dock] : null;
      if (pier && BOAT.leaveIn >= 60 && Math.hypot(s.x - pier.board.x, s.z - pier.board.z) < s.radius + 1) {
        s.carried = { by: 'boat', until: -1, pier: BOAT.next };
        s.immune = Math.max(s.immune, 0.5);
        this.events.push({ type: 'ride', who: id, by: 'boat', on: true, x: pier.board.x, z: pier.board.z });
      }
    }
  }

  /** Down the Tube at station `i`, up at the next one, facing the way its body lies free. "Mind the gap!" */
  private warp(s: Snake, i: number): void {
    const ports = this.stage.portals!;
    const j = (i + 1) % ports.length;
    const to = ports[j].at;
    s.placeAt(to.x, to.z, this.exitHeading(to.x, to.z, s.length));
    s.immune = Math.max(s.immune, TUBE_GRACE);
    s.touchingWall = s.wasTouchingWall = false;
    this.tubeCool[s.id] = TUBE_COOL;
    this.tubeAt[s.id] = j;
    this.events.push({ type: 'warp', who: s.id, from: i, to: j, x: to.x, z: to.z });
  }

  /** The heading out of a spot whose body (laid straight behind) crosses the least: the first of the best. */
  private exitHeading(x: number, z: number, length: number): number {
    let best = 0;
    let fewest = Infinity;
    for (let k = 0; k < 16 && fewest > 0; k++) {
      const heading = wrapAngle((k * Math.PI) / 8);
      let blocked = 0;
      for (let d = 1; d <= Math.min(length, 20); d += 1) {
        if (!isFree(this.stage, x - Math.cos(heading) * d, z - Math.sin(heading) * d, 0.4, this.hazards)) blocked++;
      }
      if (blocked < fewest) {
        fewest = blocked;
        best = heading;
      }
    }
    return best;
  }

  /** On a ride: the Eye holds you up in its capsule till the turn is done; the boat carries you to its next pier. */
  private carry(s: Snake, sp: SetPieceSpots): void {
    const c = s.carried!;
    s.immune = Math.max(s.immune, 0.5);
    s.dashing = false;
    if (c.by === 'eye') {
      if (this.tick >= c.until) this.alight(s, sp.eye.exit.x, sp.eye.exit.z, sp.eye.heading);
      return;
    }
    boatAt(this.tick, sp, BOAT);
    if (BOAT.dock === c.pier) {
      const p = sp.piers[c.pier];
      this.alight(s, p.board.x, p.board.z, p.out);
      return;
    }
    s.follow(BOAT.x, BOAT.z, BOAT.heading);
  }

  /** Off the ride, onto free ground near (x, z), with a little bonus for the trip. */
  private alight(s: Snake, x: number, z: number, heading: number): void {
    const by = s.carried!.by;
    const at = this.landing(x, z, heading, s.radius + 0.3);
    s.placeAt(at.x, at.z, heading);
    s.carried = null;
    s.immune = Math.max(s.immune, 1.5);
    s.touchingWall = s.wasTouchingWall = false;
    if (by === 'eye') {
      this.eyeCool[s.id] = EYE_COOL;
      s.gain(EYE_GROWTH);
      s.score += EYE_SCORE;
    } else {
      this.boatCool[s.id] = BOAT_COOL;
      s.gain(BOAT_GROWTH);
      s.score += BOAT_SCORE;
    }
    this.events.push({ type: 'ride', who: s.id, by, on: false, x: at.x, z: at.z });
  }

  // ---------------------------------------------------------------- snake on snake

  /**
   * The only real danger in the playground: run your head into another snake's body and you are
   * bonked. Nobody can be bonked while blinking, or under the blue sail.
   */
  private bonkSnakes(): void {
    for (const a of this.snakes) {
      // A hidden snake (Fox Trick) is seen by no one: it can neither be bonked nor bonk into others.
      if (!a.alive || a.immune > 0 || this.unseen(a) || (this.stage.sanctuary !== null && inBox(this.stage.sanctuary, a.x, a.z))) continue;
      for (const b of this.snakes) {
        if (b === a || !b.alive || b.immune > 0 || this.unseen(b)) continue;
        const gap = Math.hypot(a.x - b.x, a.z - b.z);
        if (gap > b.length + 3) continue;

        let hitX = 0;
        let hitZ = 0;
        let struck = false;
        // Head to head: the lighter snake comes off worse (the higher id, if they weigh the same).
        if (gap < a.radius + b.radius && (a.mass < b.mass || (a.mass === b.mass && a.id > b.id))) {
          struck = true;
          hitX = b.x;
          hitZ = b.z;
        }
        // Nose to nose, mass alone decides (above). Without this the heavier snake could be
        // struck on the lighter one's neck, which sits only two radii behind its head.
        const noseToNose = gap < a.radius + b.radius;
        const reach = a.radius + b.radius * BODY_HIT + b.spikes;
        for (let i = 0; i < b.bodyCount && !struck && !noseToNose; i++) {
          const dx = a.x - b.body[i * 2];
          const dz = a.z - b.body[i * 2 + 1];
          if (dx * dx + dz * dz >= reach * reach) continue;
          struck = true;
          hitX = b.body[i * 2];
          hitZ = b.body[i * 2 + 1];
        }
        if (!struck) continue;

        const risen = this.rise(a); // the phoenix, first: it is the one that wears off
        if (risen || a.helmetReady) {
          // The phoenix or the helmet takes it: bounce straight back the way it came.
          if (!risen) {
            a.helmetReady = false;
            a.helmetIn = a.helmetRecharge;
            a.immune = HELMET_GRACE;
          }
          a.heading = Math.atan2(a.z - hitZ, a.x - hitX);
          resolveCircle(this.stage, a.x + Math.cos(a.heading) * 0.6, a.z + Math.sin(a.heading) * 0.6, a.radius, this.hit, this.hazards);
          a.x = this.hit.x;
          a.z = this.hit.z;
          // London: the bounce must not land the head in a parked bus (it is blinking now: a nudge, never a bonk).
          if (this.vehicles.length > 0) this.meetVehicles(a, STEP);
          if (!risen) this.events.push({ type: 'helmet', who: a.id, x: a.x, z: a.z });
        } else {
          this.bonk(a, b);
        }
        break;
      }
    }
  }

  private bonk(victim: Snake, by: Snake): void {
    const lost = victim.dropUpgrades(BONK_UPGRADE_LOSS);
    this.events.push({ type: 'bonk', who: victim.id, by: by.id, x: victim.x, z: victim.z, lost });
    victim.cards = null;
    const n = Math.min(BONK_PELLETS, Math.max(3, Math.ceil(victim.length / 1.5)));
    // Back to the tank means back to the start: a Wiggly Worm again, whoever you were.
    this.shed(victim, victim.mass, BONK_RETURN, n);
    victim.mass = 0;
    victim.alive = false;
    victim.bodyCount = 0;
    victim.respawnIn = RESPAWN_AFTER;
    by.gain(BONK_REWARD);
  }

  private respawn(s: Snake): void {
    this.dropIn(s);
    s.alive = true;
    s.immune = RESPAWN_GRACE;
    s.teaStep = s.teaCool = 0;
    s.speedFactor = 1;
    s.touchingWall = s.wasTouchingWall = false;
    // London: a fresh start at the Tube, the Eye and the boat (a respawn by a station is not stepping in).
    if (this.sp) {
      this.tubeAt[s.id] = undefined; // unknown: where it lands is noted, not taken as stepping in
      this.tubeCool[s.id] = this.eyeCool[s.id] = this.boatCool[s.id] = 0;
    }
    this.events.push({ type: 'respawn', who: s.id, x: s.x, z: s.z });
  }

  /**
   * Put a snake down somewhere open, well away from every other snake, facing a way that lets
   * its whole body lie on open ground: a body laid through a wall looks wrong, and would bonk
   * people from inside the building once its grace ran out.
   */
  private dropIn(s: Snake): void {
    let bestX: number = this.stage.snakeSpawn.x;
    let bestZ: number = this.stage.snakeSpawn.z;
    let bestHeading = 0;
    let fewest = Infinity;
    const length = s.length;
    const B = this.stage.bounds;
    for (let tries = 0; tries < 60 && fewest > 0; tries++) {
      const x = this.rng.range(B.minX, B.maxX);
      const z = this.rng.range(B.minZ, B.maxZ);
      // Later tries settle for less elbow room rather than giving up.
      if (!isFree(this.stage, x, z, 2.5, this.hazards) || !this.clearOfSnakes(x, z, tries < 40 ? SNAKE_CLEARANCE : 5)) continue;
      // London: never pop out in the road (a bus could be parked right there).
      if (this.stage.routes && this.stage.routes.some((r) => distanceToLoop(r.path, x, z) < 3)) continue;
      const turn = this.rng.range(0, Math.PI * 2);
      for (let k = 0; k < DROP_HEADINGS && fewest > 0; k++) {
        const heading = wrapAngle(turn + (k * Math.PI * 2) / DROP_HEADINGS);
        let blocked = 0;
        for (let d = 1; d <= length; d += 1) {
          if (!isFree(this.stage, x - Math.cos(heading) * d, z - Math.sin(heading) * d, 0.4, this.hazards)) blocked++;
        }
        if (blocked >= fewest) continue;
        fewest = blocked;
        bestX = x;
        bestZ = z;
        bestHeading = heading;
      }
    }
    s.placeAt(bestX, bestZ, bestHeading);
  }
}
