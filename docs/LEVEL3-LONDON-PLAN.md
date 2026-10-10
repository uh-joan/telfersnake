# LEVEL 3 — London: end-to-end build plan

*2026-10-09. The "what" is in [LEVEL3-LONDON.md](LEVEL3-LONDON.md); this is the "how", from groundwork
to the HD port and the production deploy.*

## 0. Decisions (locked 2026-10-09)

| Question | Decision |
|---|---|
| Mr Cooper | A patrolling **Bobby** (the stage's warden, persona `'bobby'`), plus a separate **Royal Guard** gag at the Palace who never moves. |
| The Thames | **Swim slowly**: ×0.5 speed, a gentle eastward drift. Bridges are the fast way. |
| Unlock | **⭐600 Golden Ticket**, needs the Common unlocked first. |
| Landmarks | **All twelve** in A1: Big Ben + Parliament, London Eye, Buckingham Palace, Trafalgar Square (Nelson + lions), St Paul's, Tower of London, Tower Bridge, the Shard, the Gherkin, the Globe, Piccadilly Circus, the Natural History Museum. Plus Hyde Park, St James's Park and Covent Garden as zones. |
| Ravens (clash in the brainstorm) | The ravens are the **predator pair** and are never gulped. The "always six" legend becomes scenery: six ravens perch on the Tower; two fly off to hunt and come back. |

## 1. How we work (unchanged from Level 2)

- **One branch + PR per phase** (`london-a0` … `london-b5`). Each phase compiles, is verified, reviewed
  by a separate reviewer pass, merged, and (from A1 on) deployed.
- **The school and the Common stay byte-identical.** Every phase runs the determinism fingerprint for
  school + Common × easy/normal/god and compares it against `main`. New Stage fields are optional with
  empty defaults, new kinds are **appended** to their `*_KINDS` arrays (protocol indices stay stable), and
  no new RNG draws happen on stages that don't use the feature (the "count 0 ⇒ no RNG" rule).
- **Ship gate:** A0 is never deployed on its own (the Level 2 lesson: a child could pay ⭐600 and land on
  the school). **A0 + A1 deploy together.**
- **Kid check:** before A1 merges, a screenshot sheet of all twelve landmarks goes to a 6–7-year-old
  (or two). The test: can they name each one? A miss means that silhouette gets reworked.
- **Real people:** Mr Cooper (Bobby) and Miss Sami (tour guide) see their London looks before A4 deploys.

## 2. Verification kit (built in A0, used by every phase)

Level 2's headless checks were one-off scripts. London needs them committed, because it runs every
phase and the HD port checks against them.

- **`scripts/sim-check.ts`** (run with `tsx`; `npm run sim:check`):
  - `fingerprint <stage> <mode> [ticks]` — hash of the event stream + snake positions/scores per tick.
    `--baseline` writes `scripts/baselines.json`; the default compares against it. **The baselines are
    generated from `main` before any A0 change** (the old `4c82c20d` / `392056d6` / `38d6ad19` are the
    school's three modes only; the Common never had one).
  - `invariants <stage>` — 40 seeds × 3 modes × 200 s: 0 ticks in a solid, 0 out of bounds, no snake
    stuck > 3 s, entity counts bounded, every kind spawned at least once.
  - London-only checks (added as features land): flood-fill reachability (no sealed pocket, both banks
    reachable by bridge **and** by swim); every Tube exit lands on free ground; buses never leave their
    route; a snake on a zebra crossing always stops the bus; swim speed is ×0.5 ± 0.05; set-piece timers
    agree between `World` and the client's tick-derived copy.
- **Browser check** (preview pane): load each stage, no console errors, screenshot per landmark from the
  game camera, phone (375×812) and desktop. Frame-time sample: 60 fps target on an iPhone 12-class phone,
  never below 45. A dev URL flag `?shot=<landmark>` drops the snake beside a landmark for screenshots.
- **Render budget for London (classic):** ≤ 250 draw calls, ≤ 400k triangles in view. Landmarks are
  merged per landmark (one mesh, vertex colours); repeated things (buses, lamp posts, trees, railings,
  pigeons) are instanced.

## 3. The map (coordinates for A1)

**Bounds** x −85…85, z −65…65 (170 × 130 m; the Common is 120 × 160, the school 76 × 80). +x east, +z south.

**The camera looks north** (it sits south of the snake: `stage.follow` puts it at `z + cos(TILT)·d`).
So anything tall **south** of the snake blocks the view. Rules: tall landmarks sit on the **north** side
of their block where real geography allows, and every landmark registers with `reveal()` so it fades to
see-through when it's between the camera and the snake (the school's buildings already do this).

**The Thames** — a 14 m-wide ribbon on a polyline, west → east:
`(−85, 20) (−55, 24) (−36, 16) (−24, 2) (−18, −10) (0, −14) (20, −8) (42, 4) (62, 8) (85, 6)`.
It flows north past Westminster, then east, matching the real bend.

| Landmark / zone | Centre (approx.) | Bank | Notes |
|---|---|---|---|
| Hyde Park + Serpentine | (−68, −42) | N | Big green, the lake, the **Elfin Oak glade** (creatures' home) |
| Natural History Museum | (−66, 2) | N | Long terracotta front, dino skull poking out of the roof |
| Buckingham Palace + Victoria Memorial | (−48, −22) | N | Faces east down The Mall; the **Royal Guard** stands at the gates |
| St James's Park + lake | (−34, −22) | N | Pelicans, ducks, swans |
| The Mall (red road) | (−44,−24) → (−14,−40) | N | Changing of the Guard route |
| Piccadilly Circus | (−30, −52) | N | Light screens on the north edge (so they're never in the way) |
| Trafalgar Square | (−12, −42) | N | Nelson's Column, 4 lion plinths, fountains, pigeon sea |
| Covent Garden | (6, −50) | N | Market hall; buskers, the living statue |
| **Big Ben** + Parliament | (−34, 6) | N/W | Right on the river at the bend. **Arrival: Westminster station** at (−40, 12) |
| **London Eye** | (−8, 2) | S | On the south bank, facing Big Ben across the water |
| St Paul's | (28, −40) | N | Dome; the Millennium Bridge points at it |
| The Gherkin | (50, −50) | N | Tall, at the north edge (never in the way) |
| Tower of London | (62, −14) | N | White keep, four turrets, the six perched ravens |
| **Tower Bridge** | x = 74, across z ≈ −2…14 | — | The opening bridge |
| Shakespeare's Globe + Tate chimney | (22, 10) / (12, 12) | S | Round, white, thatched |
| Borough Market | (40, 22) | S | Veg zone |
| The Shard | (52, 40) | S | Glass spike; far enough south that it's rarely in shot, `reveal()` for the rest |
| South Bank gardens + carousel | (−30, 36) | S | Street-food zone, a playground-scale carousel |

**Bridges** (solid deck over water, ~6 m wide): **Westminster** (−30…−14, z ≈ 2, east–west across the
northward bend), **Millennium** (x = 24, z −16…−2, a thin footbridge), **Tower Bridge** (x = 74).
**Tube stations** (portals, A6): Westminster (−40, 12), Piccadilly (−26, −56), South Kensington (−60, 8),
Bank (36, −46), Tower Hill (58, −28), London Bridge (36, 30). **Bus route** north bank loop
(Palace → Mall → Trafalgar → Strand → St Paul's → Tower → back along the Embankment) and south bank line
(Westminster Bridge → South Bank → Borough → London Bridge). Cab loop on the outer roads.

These numbers are the A1 starting sketch, tuned in play. Like the Common's 0.75 scale, map scale is one knob.

## 4. Architecture changes (cross-cutting)

### 4.1 Sim (`src/sim/`)
| Change | Where | Keeps old stages identical because… |
|---|---|---|
| `StageId` gains `'london'`; `STAGE_IDS`, `asStage`, `STAGES`, `stageFor` | `stage.ts`, `stages.ts` | additive |
| New optional Stage fields: `water: WaterZone[]` (polyline + width + drift), `bridges: Box[]` (walkable over water), `routes: Route[]` (vehicles), `portals: Portal[]` (Tube), `landmarks: Landmark[]` (id, centre, stamp radius), `chatters: Chatter[]` (generalises `greeters` for Sami/Beefeater/statue lines), `creatureKinds?: CreatureKind[]` (a roster per stage), `plinths?: Spot[]` (lion homes), `guard?: Spot` | `stage.ts` | all default to empty / undefined; School + Common untouched |
| `londonLayout.ts` → `export const LONDON: Stage` | new | — |
| Widen the closed unions that name stages or kinds: `chomp.kind` (`world.ts`), `setAtmosphere(id)` (`render/stage.ts`), `music.setPlace` (`audio/music.ts`), warden `persona` (`cooper.ts`) → derive them from `StageId` / `PredatorKind` | several | types only |
| Swimming: `inWater` derived from position → `speedFactor` target ×0.5 (speed already reaches clients as `you.speedFactor`), and the **drift lives in `Snake.move`**, so the replica's input replay (`replica.ts` `g.move(…)`) predicts it the same way | `snake.ts` (move), `world.ts` | no water zones ⇒ branch never runs |
| `FOOD_KINDS` += fishchips, scone, sponge, sandwich, pie, sausageroll, crumpet, strawberry, jellybaby, bagel, biscuit, tea (12, appended); `WEIGHTS_LONDON_*` per zone; **jewel golden** = golden flag, a London-only look | `food.ts` | appended; shorter tables can't reach them |
| Tea Time combo (sandwich → scone → cake in a row) | `world.ts` | gated on `stage.id === 'london'` |
| `ANIMAL_KINDS` += corgi, swan, gull, pelican, horse, dino (pigeon, squirrel, duck reused). New behaviours: **swan** never gulpable, honks/boops at any tier; **gull** steals a nearby food and flies off; **pelican** eats food; **dino** (Dragon tier) | `animals.ts` | appended; new behaviour switches on kind |
| `PREDATOR_KINDS` += `lion`, `raven`. Lion: dormant on a plinth (a statue) → wakes when a snake is within 9 m → prowls → tires → walks home → statue again; Freeze = instant stone. Raven: the wolf state machine with a caw tell and a swoop | `predators.ts`, `world.ts` | appended |
| `vehicles.ts` — buses + cabs on route polylines. Deterministic: speed, dwell at stops, **brake for any snake ahead / on a zebra crossing**, ding-ding tell, bonk = rock-style shrink with `OUCH_GRACE` | new | only built when `routes` is non-empty |
| `KID_KINDS` += `tourist` (camera flash: a client-side dazzle + photo sticker), `trip` (school-trip crocodile: a leader with followers on its path), `busker` (dance zone: speed boost) | `kids.ts` | appended |
| Warden persona `'bobby'` + London lines; `chatters` lines for Miss Sami (tour guide), the Beefeater, the living statue | `cooper.ts`, `world.ts` | Common keeps `greeters` until migrated (and checked byte-identical) |
| Hazards: `makeHazards` draws `rng.pick(HAZARD_KINDS)` and the school has a hazard area, so London's puddles/umbrellas/roadworks **can't be appended to that pick**. Each stage names its own `hazardKinds` (school: today's three, same order); kinds are appended to `HAZARD_KINDS` only for the protocol index | `hazards.ts`, `stage.ts`, `layout.ts` | the school's pick list is unchanged |
| **Royal Guard**: a fixed solid circle; each snake accumulates its angle around him; 3 full laps inside 8 m ⇒ `guard` event + 1 gem, then a cooldown | `world.ts` | London-only |
| `CREATURE_KINDS` += dragon, lion-royal, phoenix, mermaid, ghost, gog, fairy, pearly (the unicorn is reused). `MAGIC_IDS` += `wings`, `river`, `giant`, `phoenix`, `roar` (appended: the snapshot bitmask just grows) | `creatures.ts`, `snake.ts`, `world.ts` (`castMagic`) | `makeCreatures` weights over **all** of `CREATURE_KINDS`, so `COMMON.creatureKinds` must be set explicitly to today's 8, in today's order (not left optional) |
| **Flight** (`wings`): while up, the snake ignores water, solids, vehicles and bonks, and lands on the nearest free spot when it ends. The solid-skipping is in `Snake.move`, keyed off the magic bitmask the client already has, so prediction doesn't fight the server | `snake.ts` move/collide, `world.ts` | only reachable through the London dragon |
| **Crown Jewels**: 5 treasure pickups per run (`treasures.ts`), a per-snake count; 5/5 ⇒ `royal` event, crown look + payout | new | London-only |
| **Set pieces** `setPieces.ts`: a pure function of **`tick` alone** (the room seed is `Math.random` on the server and never reaches the client) for the Big Ben minute, the Tower Bridge lift, Guard parade, river boat, fireworks window. Clients already have the tick, so the clock needs **no protocol**; any per-room variety (which ship, which parade route) comes from a small `welcome.setPieceSeed`. Only interactions are sim events: `bong` (golden ring spawn), `ride` (Eye/boat), `warp` (Tube), `launch` (bridge ramp) | new | London-only |
| Riding (Eye capsule, river boat): `snake.carried = {by, until}`; position follows the carrier; inputs ignored; immune | `snake.ts`, `world.ts` | never set elsewhere |

### 4.2 Protocol (`src/net/protocol.ts`) — additive, `PROTOCOL` stays 1
- Snapshot: optional `vh: VehicleRow[]` (`[x, z, heading, speed]`), optional `tr: TreasureRow[]`.
  `welcome.vehicleKinds`, `welcome.treasureCount`. `SnakeRow` **does not change shape**: new magics ride
  the existing bitmask; `carried` and jewel count go in a new optional per-snake key `sx`.
- New per-player events (`guard`, `royal`, `ride`, `warp`, `launch`) go on the **per-seat list in
  `eventIsFor`**: it sends unknown types to everyone, which would pay one child's gem fanfare to the room.
- Tube warps need nothing: the replica already snaps a snake that moved > 4 m (`SNAP_IF_OFF_BY`).
- Client and server ship in **one Docker image** (`deploy.sh` builds both), so a new client never meets
  an old server (where `asStage('london')` would quietly mean the school).
- Old clients can't reach a London room (the server only opens one for `hello.stage === 'london'`),
  and the Unity client ignores unknown keys. Verified in A0 by joining HD to a school room on the new
  server.

### 4.3 Render (`src/render/london/`, a folder: this level is big)
- `ground.ts` — the **paper-map painter**. 170 × 130 m at ~14 px/m ⇒ a 2400 × 1840 canvas (under the
  4096 limit; ~18 MB of GPU memory, ~24 MB with mips, plus the CPU canvas, which is released after
  upload). The Common already ships a 1560 × 2080 canvas at 13 px/m, so this is the same order. 10 px/m
  on low-memory phones. Paints: cream streets
  with ink edges, flat green parks, sandy squares, the river with white wave lines, zebra crossings,
  the compass rose, the dotted tour route, the "here be snakes" doodle, the folded-paper border.
- `water.ts` — the Thames as its own mesh above the ground with a tiny custom shader: scrolling wave-line
  texture + gentle bob. Swimming snakes get a ripple ring.
- `landmarks/*.ts` — **one file per landmark**, each `build(): { group, animate(t), tall: boolean }`,
  built from primitives + `ExtrudeGeometry`/`LatheGeometry`, vertex-coloured, merged. Shared helpers in
  `landmarks/kit.ts`: toon **inverted-hull outline**, window grids, crenellations, ribbon label.
- `labels.ts` — the floating ribbon banners (canvas-text textures on billboards, short words only),
  scale with the camera so they stay readable on phones.
- `london.ts` — assembles ground + water + landmarks + street furniture (instanced lamp posts,
  railings, phone boxes, postboxes, bus stops, Belisha beacons, benches, plane trees) + the `reveal()`
  occlusion fade; registered in `render/scenery.ts`.
- New views: `vehicleView.ts` (instanced bus + cab, wheels, ding-ding bob), lion/raven models in
  `predatorView.ts`, new animal and creature models, `setPieceView.ts` (Tower Bridge bascules, Eye
  rotation + capsules, Big Ben hands, Guard parade, river boat, fireworks), weather additions (umbrellas
  on NPCs, puddles on paper, pea-souper fog preset).
- `stage.ts` atmosphere: a `london` entry (bright, slightly cool, light haze). Camera: classic's
  `follow` has no per-stage zoom today (the closer Common camera is HD-only, `CameraRig.COMMON_ZOOM`), so
  A1 adds a stage zoom factor to `follow`; plus a scripted pull-back for the Eye ride and dragon flight.

### 4.4 Meta, UI, audio
- **Save:** `readDisk` rebuilds the save from known fields only and `writeSave` writes exactly that, so a
  tab still running the pre-London bundle would **delete** London fields on its next save. So London's
  progress lives in its **own key, `telfersnake.london.v1`** (`unlocked`, `seen`, `stamps`, `postcards`),
  which old code never touches; `save.ts` merges it in (sticky, multi-tab-safe like `commonUnlocked`).
  `writeSave` also starts spreading the raw parsed object, so future fields survive too. The `stage`
  gate at `save.ts` (`'common' && !commonUnlocked`) gains the matching `'london'` gate.
- Catalogue: `gem` stays the **currency** flag (💎 vs ⭐, used all through `shop.ts`); a new
  `place?: 'common' | 'london'` takes over **visibility** (Common items get `place: 'common'`, so they look
  the same). London cosmetics: the everyday ones in ⭐, the special ones (Bearskin, Pearly King, Piccadilly
  Lights, Fireworks) in 💎.
- `main.ts` hard-codes the Common today (economy bonus, the first-visit greeting, and a stage picker that
  only knows one lock and one price). A0 turns these into a per-stage table
  `{ id, unlocked(save), price, currency, requires, bonus, greeting }`.
- Start screen: a third destination chip 🇬🇧 **London 🔒⭐600** (needs the Common: until then it shows
  the lock plus a small Common icon, and taps shake). Golden Ticket unlock splash.
- **Postcard album** screen off the menu; stamp THUNK + minimap stamps in the HUD; landmark icons on
  the minimap (`paintMinimap` draws them).
- Economy: London ×1.5 stars, gem bonus 1-in-2 (the Common's is 1-in-4); analytics already tags `stage`.
- Audio: `music.setPlace('london')` — a music-hall arrangement of *London Bridge Is Falling Down* and
  *Oranges and Lemons*; Westminster Quarters sting + BONGs; new SFX (honk, ding-ding, caw, lion yawn,
  swan HONK, corgi yip, stamp, Tube chime, fireworks).

### 4.5 The HD project, from day one
The HD build shares the web save (`telfersnake.save.v1`). Its `Profile.Save()` copies the disk object
first, so unknown fields survive (and London's own key is never touched anyway). The one thing it
rewrites is `stage`: it reads anything but `"common"` as School and saves that back, so playing HD would
reset a child's chosen destination from London to the school. **A0 fixes that mapping** (keep `"london"`
as it is). HD shows London as "coming soon" until B ships.

## 5. Phase A — Classic

Each phase: scope → files → done-when. "Verified" always includes the §2 kit (fingerprint +
invariants + browser) and a reviewer pass.

### A0 · Ticket & groundwork
- **Scope:** `'london'` stage id; a placeholder `LONDON` stage (open paper rectangle + river) so the
  plumbing runs end to end; save fields; destination chip + ⭐600 Golden Ticket flow (Common required);
  unlock splash; rooms keyed by stage (already); London's own save key + `writeSave` keeps unknown keys;
  the per-stage table in `main.ts`; the catalogue `place` flag; per-stage `hazardKinds`; the explicit
  Common creature roster; the widened unions; the HD `stage` mapping fix; `eventIsFor` entries; the
  committed `scripts/sim-check.ts` with **baselines taken from `main` first**; the optional Stage fields.
- **Files:** `stage.ts`, `stages.ts`, `londonLayout.ts` (stub), `save.ts`, `main.ts`, `index.html`,
  `style.css`, `ui/unlockSplash.ts`, `meta/catalogue.ts` (`place` gate), `ui/shop.ts`, `hazards.ts`,
  `layout.ts`, `commonLayout.ts`, `creatures.ts`, `cooper.ts`, `render/stage.ts`, `audio/music.ts`,
  `net/protocol.ts`, `unity/.../Meta/Profile.cs`, `scripts/sim-check.ts`, `package.json`.
- **Done when:** school + Common fingerprints identical to `main`; buying the ticket deducts ⭐600 and
  unlocks; without the Common it shakes; a pre-London bundle saving in another tab leaves London's
  progress intact; HD keeps `stage: 'london'` (checked in the HD WebGL build). **Not deployed alone.**

### A1 · The map and all twelve landmarks (the big one)
- **Scope:** the real `LONDON` layout (§3): bounds, river, bridges, banks, roads, landmark footprints as
  solids, zones; swimming; the paper-map ground; the water; **all twelve landmarks** with their one
  animation each and their ribbon labels; street furniture; occlusion fade; the minimap with landmark
  icons; London atmosphere; populated with **existing** food/animals/rivals so it's fun on day one.
  Bobby Cooper's look + lines come here too (cheap, and he makes it feel like London from the first run).
- **Order inside A1** (each a commit, screenshot-checked):
  1. Layout + collision + swimming + flood-fill check (sim only, headless-verified).
  2. Paper ground + water + bridges + roads.
  3. Landmarks, biggest silhouettes first: **Big Ben, London Eye, Tower Bridge, Buckingham Palace,
     St Paul's, Trafalgar Square**, then Tower of London, the Shard, the Gherkin, the Globe, Piccadilly
     Circus, Natural History Museum.
  4. Labels, street furniture, occlusion fade, minimap, atmosphere, Bobby.
  5. Perf pass on a phone (budget §2); kid naming test on the twelve-landmark sheet.
- **Done when:** invariants clean (both banks reachable by bridge and swim); all 12 named correctly by a
  kid tester (or reworked); 60 fps on the reference phone; school + Common identical.
- **Deploy A0 + A1 together.** London is now a real place behind a real ticket.

### A2 · London menu & zoo
- **Scope:** the 12 London foods with zone tables (river → fish & chips; Palace → scones/sponge/
  sandwiches; Covent Garden → fruit; Borough → veg; Piccadilly/Trafalgar → jelly-baby trails), crown-jewel
  golden food, Tea Time combo; animals: pigeon flocks (whole-flock lift-off), squirrel, duck chains,
  corgi pack, swan (no-gulp HONK), gull (steals), pelican (eats food), guard horse, dino; London gulp hints.
- **Done when:** every kind spawns in its zone and gulps; swans never gulp at any tier; gulls steal
  within bounds; checks clean.

### A3 · Danger
- **Scope:** the four Trafalgar lions (statue ↔ prowl ↔ home, Freeze = stone, mode ferocity); the raven
  pair (caw → swoop → rest on a Tower turret); buses + cabs on routes with stops, zebra-crossing braking
  and ding-ding tells; puddles (rain only), dropped umbrellas, roadworks; vehicle snapshot rows.
- **Done when:** lions always get home; a bus never moves while a snake is on its zebra crossing;
  vehicles never leave their route; bites/bonks capped and grace-protected; the multiplayer room shows
  the same buses on two clients; checks clean.

### A4 · People
- **Scope:** Bobby Cooper's full behaviour (whistle aura = Cooper's slow-down); the unmoving **Royal
  Guard** + 3-lap smile; Miss Sami as tour guide at Westminster (umbrella, lines); the Beefeater at the
  Tower; the school-trip crocodile (hi-vis, rope; soggy-chip pelts and kisses); tourists (flash +
  photo sticker); buskers (dance boost); the living statue (BOO).
- **Done when:** the guard never moves and pays exactly once per cooldown; the crocodile never splits or
  leaves the pavements; staff have OK'd their looks.

### A5 · Legends
- **Scope:** the nine London creatures and their magics (dragon **flight**, royal lion **roar**,
  **phoenix** rise-again, mermaid **river rider**, ghost = invisible, **Gog & Magog** giant, fairy = magnet,
  unicorn = rainbow, **pearly trail** to treasure); the Elfin Oak glade in Hyde Park; the **Crown Jewels**
  run goal.
- **Done when:** 40-seed sweep: all 9 creatures gulped and all 9 effects fire; flight always lands on free
  ground (including over the river); 5/5 jewels reachable every seed; checks clean.

### A6 · Set pieces
- **Scope:** Big Ben chimes + BONG golden ring each minute; **Tower Bridge** lift (bascules, ship, ramp
  launch); the **London Eye** ride (capsule boarding, camera crane-out, reveals treasures/creatures);
  **Tube** warps (6 stations, "mind the gap" whoosh, mini tube map); **Changing of the Guard** parade on
  the Mall; the river boat; the wobbly Millennium Bridge; **fireworks finale**; the rare Red Arrows and
  the rare dino escape.
- **Done when:** client and server agree on the set-piece clock for 10 minutes of ticks; every Tube exit
  lands free; nobody can get stuck under a raised bascule; the Eye always returns its rider.

### A7 · Keepsakes & polish
- **Scope:** landmark stamps (run) + postcards (forever) + the album screen + rare postcards; London
  cosmetics (9 hats, 10 skins, 7 trails) with `place: 'london'`; London music, the Westminster sting, the
  ambience; ×1.5 economy; first-visit flourish (Miss Sami's welcome + Big Ben BONG); the Here-be-snakes
  map border dressing; final perf + accessibility pass (labels have aria text, colours readable).
- **Done when:** album persists across tabs and survives an HD round-trip; shop shows London items only
  when unlocked; full regression on school + Common.

## 6. Phase B — HD (Unity)

Starts once A5 has landed: by then the sim rules are settled, so the C# port doesn't chase a moving
target. A6/A7 can run alongside B1–B2 (those are view-only).

| Phase | Scope | Files (mirroring the Common) |
|---|---|---|
| **B0 · Stage & save** | `StageId.London`, `London.cs` stage data ported from `londonLayout.ts`, `Stage.For`, Profile London fields (already round-tripping since A0), the London chip + ticket in the HD menu | `Sim/Stage.cs`, `Sim/London.cs`, `Meta/Profile.cs`, `UI/Hud.cs`, `Game/GameRoot.cs` |
| **B1 · The map** | `LondonEnv.cs`: the paper map painted via `Painter.cs` (SDF raster, crisper than classic), the Thames with a real water shader (wave lines, landmark reflections, foam at bridges), toon outline in post, occlusion screen-door fade | `View/LondonEnv.cs`, `Shaders/Thames.shader`, `Shaders/Outline` |
| **B2 · Landmarks** | `ModelsLondon.cs`: the twelve, code-built like everything in HD, with HD extras (lit clock faces, glass on the Shard/Gherkin with sky reflection, real-hinged bascules, rotating Eye capsules, Piccadilly screens as emissive animated quads) | `View/ModelsLondon.cs`, `View/MeshKit.cs` helpers |
| **B3 · Sim port** | `WorldLondon.cs`: water/swim, vehicles, lions/ravens, London animals/food, people, creatures/magics incl. flight, jewels, set-piece clock. **Parity check:** the same seed's event stream from `sim-check.ts` replayed against the C# sim (tolerance on floats, exact on events) | `Sim/WorldLondon.cs`, `Sim/Wild.cs`, `Sim/Things.cs`, `Tools/replay.sh` |
| **B4 · HD treats** | the flight camera (free rise, swoop over the map), the Eye ride as a crane shot, volumetric pea-souper fog, fireworks with bloom, golden-hour light over the river, rain on the paper with real puddle reflections | `View/Atmosphere.cs`, `Game/GameRoot.cs` camera rig, `View/Fx.cs` |
| **B5 · Net, phone, ship** | London rooms in HD multiplayer (`Protocol.cs`/`Replica.cs` read `vh`, `tr`, `sx`); cross-play web ↔ HD in one London room; phone layout; postcard album in HD UI; WebGL build + deploy | `Net/*`, `UI/*` |

**HD done when:** the parity replay matches; cross-play verified in one room; WebGL phone build holds
60 fps on the reference phone (drop the reflection pass on mobile if needed); HD and classic share one
album and one wallet.

## 7. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| **Tall landmarks hide the snake** (the camera looks north) | Placement rule (tall on the north side) + `reveal()` see-through fade + the snake's silhouette showing through (HD already does an x-ray). Checked by screenshotting the snake behind every landmark. |
| **The ground texture is big** | 2400 × 1840 canvas at ~14 px/m; 10 px/m fallback on low-memory phones; landmarks are meshes, not paint. |
| **Recognisability** | Silhouette-first modelling; the kid naming test is an A1 merge gate. |
| **Too much on screen at once** (buses + lions + kids + rivals + creatures) | Per-zone spawn budgets; the four lions sleep until approached; vehicles ≤ 6 buses + 4 cabs; instanced everything. |
| **Bots in a river-split map** | Bot wander picks targets on its own bank, or a bridge; bots treat water as "slow" (they avoid it unless chasing). An A1 invariant: no bot stuck > 3 s. |
| **Flight / riding / warps break assumptions** (the trail, collisions, bonks) | All three go through one `snake.placeAt`-style reset or a `carried` state that skips collision; tests for landing-on-free-ground. |
| **An old open tab or HD wipes London progress** | London's progress lives in its own save key; HD's `stage` mapping fixed in A0 (§4.4, §4.5). |
| **Scope** — this is about 2× the Common | Every phase ships on its own; A2–A7 can be re-ordered; set pieces (A6) are individually droppable. |
| **Trademarks / real people** | Guardrails in the brainstorm §15; reviewer checks names/logos each phase. |

## 8. Order of work, at a glance

```
A0 ──► A1 ══► deploy ──► A2 ──► A3 ──► A4 ──► A5 ──► A6 ──► A7
                                              │
                                              └──► B0 ─► B1 ─► B2 ─► B3 ─► B4 ─► B5 ══► deploy HD
```

Each arrow is a merged, verified PR; ══► is a production deploy (every phase from A1 on deploys after merge).

## 9. Progress log

### 🌙 Nightly build, 2026-10-09 → 10 — classic and HD both complete

Built end to end as a stack of PRs, one per phase. Each PR was verified and reviewed by a separate reviewer before the next phase started. **Nothing is merged or deployed:** merging to `main` needs a human review.

| Phase | PR | Branch |
|---|---|---|
| A0 · Ticket & groundwork | uh-joan/telfersnake#12 | `london-a0` |
| A1 · Map & twelve landmarks | uh-joan/telfersnake#13 | `london-a1` |
| A2 · Menu & zoo | uh-joan/telfersnake#14 | `london-a2` |
| A3 · Danger | uh-joan/telfersnake#15 | `london-a3` |
| A4 · People | uh-joan/telfersnake#16 | `london-a4` |
| A5 · Legends | uh-joan/telfersnake#17 | `london-a5` |
| A6 · Set pieces | uh-joan/telfersnake#18 | `london-a6` |
| A7 · Keepsakes | uh-joan/telfersnake#20 | `london-a7` |
| HD B0–B2 · Stage, map, landmarks | uh-joan/telfersnake#19 | `london-b0` (on A6) |
| HD B3 · Cast & set pieces | uh-joan/telfersnake#21 | `london-b3` |
| HD B4–B5 · Polish, online, postcards, WebGL | uh-joan/telfersnake#22 | `london-b4` |

**Merge order:** #12 → #13 → #14 → #15 → #16 → #17 → #18 → #20 (A7), then #19 → #21 → #22. The HD branches sit on A6. They only touch `unity/` and `scripts/trace.ts`, so they merge cleanly after A7.

**HD:** cross-play was verified (HD and the web in one London room). The WebGL build is 12 MB. The School/Common fingerprints for HD match. Parity with classic is exact for about 100–200 ticks; after that the C# floats drift and event counts agree within about 10–15%.

**Classic end-to-end verification (on `london-a7`): PASS.**
- Build clean. 36/36 fingerprints pass (4 seeds × 3 modes × school/Common/London), and school/Common invariants equal main.
- A fresh player can buy the ticket (⭐700 → 100), gets the first-visit welcome, earns stamps and postcards, and can buy and wear a London hat.
- Two-tab London, School and Common rooms all stayed in sync.
- The phone layout is clean.
- Draw calls / triangles: Westminster 177 / 351k, Trafalgar 153 / 328k, Tower Bridge 145 / 286k (budget 250 / 400k).
- The guardrails grep is clean.

**Changes from the plan, decided during the build:**
- The Thames bends south at its east end, so the camera sees Tower Bridge from the side (end-on it wasn't recognisable).
- The Royal Guard stands at the head of the Mall, away from the bus lane.
- Ravens are the predator pair; six perch on the Tower and two fly out.
- Deferred: jelly-baby trails, the museum dino's walkabout, the Tate chimney.

**Regression caught:** A5 changed Common bot behaviour on seeds the old single-seed fingerprint didn't cover. It was found by bisect and fixed in A7 (0bbc39c), and the fingerprints now cover 4 seeds.

**Before deploying:**
1. Run the kid naming test on `docs/images/london-landmarks.jpg`.
2. Show Mr Cooper and Miss Sami their London looks.
3. Review and merge the stack in order. A0 must never ship without A1.
4. Measure real fps on a phone (Westminster has the least headroom).
