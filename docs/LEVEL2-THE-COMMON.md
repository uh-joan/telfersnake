# LEVEL 2 — The Common

*Brainstorm and phased plan, 2026-09-25. Companion to [BRAINSTORM.md](BRAINSTORM.md).*

## 1. Vision

Level 1 is the school playground: tidy, tarmac, Mr Cooper, rocks and sticks. **Level 2 is the Common** — big, green, wild and a little bit magic. You leave through a gap in the school fence (where Miss Sami is nattering with a mum), slither down Telfer Road, and the world opens out: meadows, woods, a pond, paths, kids everywhere. New food, new animals, and for the first time **dangers that come for you** (bears and wolves instead of rocks), plus — deep in the woods — fantastic creatures that grant magic.

It is the game's "level up": everything the kids already know (steer, eat, grow, cards, gems, powers) still works, but the place is bigger and stranger and the stakes are higher.

## 2. Access and framing

- **Unlock:** pay **100 blue gems**, once. `save.commonUnlocked = true` (sticky, multi-tab-safe like `mega`). This gives gems a big long-term sink beyond 1-gem power picks — exactly the goal the economy was missing.
- **From the main menu:** a destination picker above Play — **🏫 School** and **🌳 The Common**. Before unlock the Common tile shows **🔒 💎 100** and is tappable: it tells you what it costs, so it's a visible goal from day one ("I need a hundred gems!"). After unlock it's just selectable. Last choice remembered (`save.stage`).
- **Difficulty modes still apply.** Easy / Normal / God are orthogonal to stage: an Easy Common has dumb wolves, a God Common has bears *and* laser-eyed rivals.
- **The fence gap is also a live portal.** In the school world, once unlocked, slithering into the opening in the fence takes you to the Common (a short "down Telfer Road" beat), and the Telfer Road end of the Common leads back. Miss Sami stands at the gap chatting to a mum; if you're not unlocked yet she says so ("The Common? That's a hundred gems for the trip, love.").

## 3. Geography (from the map)

The map (satellite, north up) outlines the whole Level 2 route in green, the school fence in red, and labels the gap "open":

- **The fence opening** is at the school's **south-west corner**, on Telferscot Road, where the west fence ends and the road carries on south. Miss Sami and the mum stand here. In school coordinates: the west fence (x = −38) near its south end (z ≈ +30), a ~6 m gap.
- **Telferscot Road** runs due south from the gap (~80 m real), a narrow road walled by terraced houses on both sides — the approach. It ends at **Emmanuel Road**, an east–west road.
- **The Common** opens out south of Emmanuel Road: a broad heart/triangle ~160 m across at Emmanuel Road, narrowing to a wooded point ~120 m south. Real features to keep: a tree line along Emmanuel Road; a big open meadow; a large copse centre-right and a smaller one centre, plus scattered single trees; a long diagonal path from the Rastell Avenue corner (top-right) to the southern tip; dense woods along the whole west edge and the south; Rastell Avenue's houses along the east; a small structure (playground) low on the west. It looks like the northern tip of Tooting Bec Common. **There is no pond** on this stretch — the lagoon stays a school thing.

**In-game scale.** To scale, the Common alone is ~3× the school's area and would play sparse. Plan: build it at about **0.75× real** — big, but a snake can cross it — as **one stage with the road as its entrance**:

| Feature | Game coords (+x east, +z south) |
|---|---|
| Stage bounds | x −60…60, z −100…60 (120 × 160 m; the school is 76 × 80) |
| Telferscot Road (arrival, heading south) | x −5…5, z −100…−40; terraced houses solid either side; you arrive at (0, −98) |
| Emmanuel Road | a band z −40…−32, full width; parked cars as scenery |
| Emmanuel Road tree line | z −32…−26, trees with path gaps |
| The Meadow | roughly x −40…40, z −20…30 — the main arena |
| Copses | large at (30, −12), small at (5, −5); singles near (−20, 20) and (10, 18) |
| The diagonal path | (55, −30) → (0, 55), a tarmac ribbon — the fast lane |
| West woods / south woods | x < −40, and z > 30 narrowing to the tip at (0, 60): solid trees shape the heart |
| Playground / landmark | (−15, 32) |
| **The Glade** | a hidden clearing in the south woods, around (0, 48) |
| Rastell Avenue houses | x 55…60 |
| Return portal | the road's north end, back to the school gap |

The playable region is the heart; the rectangular bounds outside it are filled with impassable woods and houses, so nothing ever feels like an invisible wall. The 0.75 scale is a single tuning knob.

## 4. World structure: one stage each, joined by a portal

Two ways to build "school connected to the Common":

1. **One giant world** (school + road + common in a single sim). True to the fiction, but it means one huge ground texture, one enormous entity count, one multiplayer room for everything, and it un-tunes the school (the whole game is balanced around a 150 m square).
2. **Two stages joined by a portal** *(recommended)*. Each stage is its own `World` with its own layout, bounds, spawn tables and painter. The fence gap (school side) and the Telfer Road end (Common side) are portals between them. The fiction is intact — you physically go through the fence, past Miss Sami, down the road — but each stage stays independently tuned, the multiplayer rooms stay small, and the existing school code is untouched.

The enabling refactor is a **`Stage`** abstraction: `{ id, bounds, solids, zones, spawns (food kinds + weights, animals, predators, kids, creatures), npcs, paintGround(), buildScenery(), minimap }`. The school becomes Stage 1 with no visible change; the Common is Stage 2. `World` takes a stage; `ground.ts` / `school.ts` become per-stage painters/builders; rooms are keyed by `(mode, stage)`; `hello` carries the stage.

## 5. The cast

### New animals (forest) — reuse the animal system
- **🐿️ Squirrel** — fast, darty; runs *up the nearest tree* when you get close (vanishes, comes back later). Low tier, small value, satisfying to catch.
- **🐦‍⬛ Crow** — flies; only gulpable once you're Python-sized; swoops and *steals a food item* now and then (mischief).
- **🦌 Deer** — big, elegant, bolts when approached; Anaconda-tier gulp, big value. The "wow, I caught a deer" moment.
- Also: hedgehog (curls up: briefly un-gulpable), fox (sly, circles you), pigeons (flock that scatters). Rabbits and ducks carry over.

### New food
- **🍄 Mushrooms** (woods) — some are *golden* (spotted) for double points. **🍅 Tomatoes** (by the café/allotment). Plus **🫐 berries** (bushes), **🌰 acorns / conkers** (under trees). Zone-based spawns like the Green's veg today.

### Active dangers: predators (replace rocks and sticks in the Common)
A new entity type. Less frequent than rocks (3–5 on the whole common) but **they come for you**:
- **🐻 Bear** — slow, huge, lumbers about; a big detection bubble; if it catches you it "gobbles a bit of your tail" (a rock-sized capped shrink + pellets), then wanders off content. Easy to outrun, hard to get past.
- **🐺 Wolf** — faster, roams in a pair, *chases* when you're near for a few seconds then gives up (like the goat's charge, but repeatable on a cooldown). Howls first — a tell.
- They also go for **rival snakes** (chaos you can exploit), and they can be countered with powers: **freeze a wolf, zap a bear**. In Easy they're sleepier; in God they're relentless.
- **Kid-safe:** cartoon, no gore. Being caught is a shrink + "OOPS!" and a satisfied bear burp; nobody is hurt.

### The kids (NPCs, untouchable)
A crowd of children running around the Common — atmosphere first, light interaction second. Snakes can never hurt them; bumping one is just a gentle "oops!" nudge.
- **Naughty kids** throw *pebbles*: a small lobbed projectile that shrinks you a touch if it hits ("oops, a pebble!"). The stones-danger from Level 1, reborn as mischief.
- **Nice kids** blow *kisses*: a floating ❤️ that, if it reaches you, gives a little growth (or a gem) — a tiny gift.
- **Runners** just tear about, unpredictable — spinning, stopping to stare, chasing butterflies. Not knowing what they'll do next is the point: it adds the mysticism.
- Built on a generalised NPC framework grown out of Mr Cooper's class.

### Fantastic creatures and magic (the Glade)
Rare, shy, ethereal things deep in the woods. They can be gulped by touch at any size (no tier gate) but they *flee*, so catching one is a chase. Each grants a **timed magic buff** (30–60 s) with its own FX — a new status system on the snake, alongside `slowed`, synced to clients via snapshot.

| Creature | Rarity | Magic |
|---|---|---|
| 🦌 **The White Stag** | mythic (one per world, sometimes) | *Stag's Blessing* — grow straight to the next size tier, a big gem payout, a halo. The legend of the Common. |
| 🦄 **Unicorn** | very rare | *Rainbow Rush* — 20 s where every food is golden (double points) and you leave a rainbow trail. |
| 🦉 **Wise Owl** | rare | *Owl Eyes* — 30 s: predators, rivals and creatures all show on the minimap; your next card draw is all epic-or-better. |
| 🐸 **Frog Prince** | rare | *Royal Ribbit* — the nearest predator or rival is turned into a harmless frog for 10 s (it hops off… and can be gulped). |
| 🦊 **Kitsune** (magic fox) | rare | *Fox Trick* — 15 s invisibility: predators and rivals can't see you. |
| 🧚 **Pixie** | uncommon | *Pixie Dust* — 20 s super-magnet: food from far away zooms to you. |
| 🐿️ **Golden Squirrel** | uncommon | *Acorn Hoard* — a burst of acorns (mass) and a few gems. |
| 🌟 **Will-o'-the-wisp** | — | Not a buff: a drifting light. Follow it and it leads you to a hidden golden-food cache or a creature. |

**Wizard Hat tie-in:** wearing the Wizard Hat (the priciest cosmetic) makes creatures *less shy* — they approach rather than flee. A second reason, beyond God mode, that it's the legendary item.

## 6. Guardrails

- Primary-school kids, no gore, no aggression: predators are cartoon and only ever shrink you; kids are untouchable; pebbles are "oops"; everyone bounces back.
- Miss Sami is a real member of staff (like Mr Cooper): affectionate, accurate, and worth her blessing before anything public.
- Two currencies stay simple: ⭐ dress-up, 💎 powers + the 100-gem ticket to the Common.

## 7. Economy

- The Common is the premium level: **×1.25 stars and gems** so the 100-gem investment pays back, and it's the fastest place to bank gems (more rivals + predators to bonk).
- Predators and creatures earn gems on a hit/gulp like rivals do.

## 8. Multiplayer

Rooms keyed by `(mode, stage)`; `hello` carries the stage (client-trusted, like mode and powers). Bots fill seats as now. Predators, kids and creatures are server-authoritative entities in the snapshot (new rows), replicated like animals are today. Magic buffs ride snapshot flags/fields.

## 9. Technical risks

- **Ground texture and scale.** The school paints one 2048 px canvas over 150 m. The Common is bigger: either a bigger canvas, tiles, or lower detail. Decide from the map's real size.
- **Entity counts.** More animals + predators + kids + creatures + rivals: keep budgets sane (instanced meshes, like food/animals today) and spawn by zone.
- **Bot AI in a bigger, obstacle-rich map.** Woods are dense; the rival bots' obstacle probing may need a look so they don't get stuck in copses.
- **Active AI is new.** Predators and kids are the first entities that *pursue* or *throw*. Build them on the goat-charge / Cooper patterns, deterministically (seeded RNG), so the server and solo agree.

## 10. Phased build plan

Each phase is independently shippable, verified headless, reviewed, then deployed — the rhythm we've used all along.

| Phase | Ships | The work |
|---|---|---|
| **0 · Groundwork** | The Common appears on the menu as a locked 🔒💎100 goal. | The `Stage` abstraction; the school becomes Stage 1 with zero visible change; stage picker on the start screen; `save.commonUnlocked` + `save.stage`; the 100-gem unlock flow; rooms keyed by stage. |
| **1 · The place** | You can pay 100 gems and *play* a big new map. | The Common's layout from the map (bounds, zones, solids, paths, pond, café, Telfer Road entrance), ground painting, scenery, minimap. Populated with today's food/animals/rivals so it's fun on day one. The fence-gap portal, Miss Sami + mum at the gap. |
| **2 · Forest life** | It feels like a common. | Squirrels (tree-climb), crows (steal), deer (bolt), hedgehog, fox, pigeons; mushrooms (+golden), tomatoes, berries, acorns; zone spawns. |
| **3 · Danger** | Something hunts you. | Predator entity: bear (lumber, big bite) and wolf pair (howl, chase, give up); detection/charge/cooldown; they attack rivals too; freeze/zap counterplay; no rocks in the Common; mode-scaled ferocity. |
| **4 · The kids** | The Common is alive. | NPC framework from Cooper; naughty (pebbles), nice (kisses), runners (random, whimsical); untouchable; pebble/kiss projectiles. |
| **5 · Magic** | Wonder. | The Glade; shy rare creatures; the timed magic-buff system + FX per buff; White Stag as a rare event; Will-o'-the-wisp guide; Wizard Hat tames creatures. |
| **6 · Atmosphere** *(optional)* | Polish. | Dusk lighting and fireflies in the Glade, mist, birdsong/wind ambience, a Common music variation, star/gem ×1.25 tuning, results-screen flourishes for the first visit. |

## 11. Open questions

1. ~~The map~~ — received 2026-09-25; geometry locked in §3.
2. **Portal vs one-world** — recommending two stages joined by the fence portal (§4); the map's corridor-then-common shape fits it naturally. Confirm.
3. **Which common** (looks like Tooting Bec's northern tip) — only for naming and flavour text.
4. **Rewards** — happy with ×1.25 stars/gems for the Common, or keep parity?
5. **Scale** — 0.75× real as the starting knob; tune from play.

## 12. Progress log

### ⏸ Paused 2026-09-26 — Phase 0 about 60% done, mid-refactor

**State of the working tree:** uncommitted, and it does **not** typecheck or build yet (the second half of the threading hasn't landed). That's safe: `deploy/deploy.sh` builds first and aborts on error, so nothing broken can reach the live site. The live game is untouched (last deploy: PR #1, build 19:32). Resume by finishing the "Not yet" list below in order, then typecheck.

**Design landed:** a `Stage` contract (`src/sim/stage.ts`) — `Terrain` (bounds + fixed solids) for collision, plus spawn/home/sanctuary/hazard/Cooper config and a minimap painter. The sim never reads a layout as a module global any more: everything takes the stage it runs on, because the server runs many rooms (of possibly different stages) in one process.

**Done — converted to take the `Stage`/`Terrain`:**
- `src/sim/stage.ts` — new: `Stage`, `Terrain`, `Bounds`, `Spot`, `StageId`, `asStage`, `inBox`.
- `src/sim/collide.ts` — `resolveCircle(t, …)` / `isFree(t, …)` take a `Terrain`.
- `src/sim/snake.ts` — `update()` / `move()` take `terrain`.
- `src/sim/hazards.ts` — `placeHazard(h, rng, stage, …)`, `makeHazards(rng, stage)`; a stage with `hazardArea: null` spawns none (the Common).
- `src/sim/food.ts` — `placeFood(food, rng, stage, …)`; exports `WEIGHTS_YARD` / `WEIGHTS_GREEN` + `pickFoodKind`; kind via `stage.foodKindAt`.
- `src/sim/animals.ts` — `homePoint` delegates to `w.stage.homePoint`; collision + fallback spots via `w.stage`.
- `src/sim/bot.ts` — wander uses `w.stage.bounds` / `isFree(w.stage, …)`.
- `src/sim/cooper.ts` — `new Cooper(config | null)`, `active` flag (inert on a stage he never visits), uses `this.spawn` / `this.beat` and `w.stage`.
- `src/meta/save.ts` — `stage: StageId`, `commonUnlocked: boolean` (sticky; the Common can't be picked unless bought).
- `src/net/protocol.ts` — `hello.stage?`, `welcome.stage`.

**Not yet — in this order (the tree compiles again after the last one):**
1. `src/sim/layout.ts` — imports (`pickFoodKind`, `WEIGHTS_*` from food; `Rng`, `Stage` types) and `export const SCHOOL: Stage`: bounds/solids/spawns; `foodKindAt` = Green→veg else yard; `homePoint` for green/lagoon/yard/anywhere (the old `animals.homePoint` bodies); `sanctuary: SAIL`; `hazardArea` = rough corner `{12…maxX, 8…maxZ}` share 0.4 (the old hazards.ts ROUGH_CORNER); `cooper: {COOPER_SPAWN, COOPER_BEAT}`; `paintMinimap` = the old `hud.paintMapBase` body **including the tarmac background fill**.
2. `src/sim/stages.ts` — new registry: `STAGES`, `stageFor(id)` (the school stands in for any stage not built yet).
3. `src/sim/world.ts` — `readonly stage: Stage`; ctor `(seed, look, rules, stage = SCHOOL)`; `cooper = new Cooper(stage.cooper)` (typed field, no longer `= new Cooper()`); `makeHazards(rng, stage)`; `room(seed, rules, stage)`; thread `this.stage` into: player spawn, both `placeFood` calls, `s.update(…, this.stage, this.hazards)`, `shove` + helmet `resolveCircle`, `placeHazard`, magnet `isFree`, sanctuary (`inBox(SAIL, …)` → `stage.sanctuary && inBox(…)`), `dropIn` (spawn, bounds, both `isFree`). Drop the `BOUNDS/SAIL/SNAKE_SPAWN` import (keep `inBox`).
4. `src/sim/view.ts` — add `stage: Stage` to `WorldView`.
5. `src/net/replica.ts` — ctor `(welcome, stage, sendInput)`, expose `stage`, `ghost.move(…, this.stage, this.hazards)` at both call sites.
6. `src/net/client.ts` — `join(outfit, mode, canBuy, stage, onLost)`; hello sends `stage`; `new Replica(m, stageFor(m.stage), …)`.
7. `server/room.ts` — `Room(code, isPublic, mode, stage)`; `World.room(seed, rules, stageFor(stage))`; welcome carries `stage`.
8. `server/index.ts` — `openRoom(mode, stage)`; hello matches `r.mode === mode && r.stage === stage`.
9. `src/ui/hud.ts` — `setStage(stage)` repaints/resizes the minimap base via `stage.paintMinimap`; `drawMap` uses `stage.bounds`.
10. `src/main.ts` — `makeSolo` → `stageFor(save.stage)`; `mountWorld` → `hud.setStage(next.stage)`; `Connection.join(…, save.stage, …)`; `show('start')` also refreshes the stage picker; the stage picker block (🏫 School / 🌳 The Common 🔒💎100; tapping the locked Common with ≥100 gems pays, unlocks, rebuilds solo; too poor → nope + shake).
11. `index.html` — `#stage-wrap` ("Where to?") above "How hard?".
12. `src/style.css` — stage chips (reuse mode-chip look), `.locked`, `.price`, shake keyframes.
13. Verify: `tsc`; a headless determinism check that the school is **byte-identical** (same seed → same event stream before/after); review pass; branch → PR → merge → deploy.

**Then:** Phase 1 (the Common's geometry from §3, portal, Miss Sami).
