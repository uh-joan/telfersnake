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

### ✅ Phase 0 complete 2026-09-26 — on branch `level2-phase0`, NOT deployed

**Done and verified.** The Stage refactor is finished and compiles; the school is untouched.
- `tsc --noEmit` clean; full `npm run build` (client + 218 kB server bundle) clean.
- **School byte-identical:** a deterministic fingerprint of a school room over 3600 ticks (every event + snake positions/scores) is identical on this branch and on `main`, across easy/normal/god. The refactor changed plumbing only, so multiplayer determinism is safe.
- **Destination picker works** (verified in the browser): 🏫 School / 🌳 Common; paying 100 gems unlocks + selects the Common (gems 150→50); with too few gems the tile shakes and nothing changes; selection persists.

**Do NOT deploy Phase 0 on its own.** The Common is buyable but still falls back to the school (the registry maps `common → SCHOOL` until Phase 1), so a child could pay 100 gems and get the school again. Ship it together with Phase 1, or gate the Common tile as "Soon" first. The live game is untouched (PR #1, build 19:32).

**Original resume checklist (all done):**

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

### ✅ Phase 1 core complete 2026-09-26 — the Common is a real, playable place (on branch, NOT deployed)

**Done and verified.**
- **Sim:** `commonLayout.ts` — the `COMMON` stage: bounds −60…60 / −100…60; Telferscot Road corridor + Emmanuel Road; a wooded meadow with copses; no rocks (`hazardArea: null`), no Cooper (`cooper: null`); ×2 food for the bigger map (new per-stage `foodScale`). Wired into `stages.ts`. Headless: **0 in-solid ticks, 0 out-of-bounds, no stuck snakes** over 3 min; the **school stays byte-identical** to `main`.
- **Render:** `render/common.ts` paints the meadow, roads (with lane markings), the footpath and darker woods, and builds instanced trees (woods + copses) and terraced houses. `render/scenery.ts` bundles each stage's ground + scenery behind one `School` shape; `main.ts` caches and **swaps scenery in `mountWorld`**. Verified in the browser: the Common renders and plays as a green meadow with copses; the school is unchanged.
- **Playable today** with the existing food, animals and rivals (forest life is Phase 2).

**Deferred out of Phase 1 (by design):**
- The **in-world fence-gap portal** (physically slithering school→Common mid-run) — that means a mid-run stage transition, which breaks the one-world-per-run model. Access is the **menu destination picker** (already built). Revisit as its own feature if we want it.
- **Miss Sami + the mum at the gap** — they're NPCs; they land with the NPC framework in Phase 4.

**Found & handled during Phase 1:** a stale dev `tsx server/index.ts` (pre-Stage code) was squatting on :8787, so dev Play connected to it and served a school room. Killed it; dev Play now falls to the offline Common. For dev multiplayer, run `npm run server` (new code). The live Docker server is separate and untouched.

**Ship gate unchanged:** still NOT deployed (per request). When we do, deploy Phases 0 + 1 together — the Common is now a real payoff for the 100 gems.

### ✅ Phase 2 complete 2026-09-26 — forest life (on branch, NOT deployed)

**Done and verified.** Per-stage animals + food, so the school is untouched.
- **Stage.animals** — each stage names its animal kinds; `SCHOOL_ANIMALS` (the eight) vs `COMMON_ANIMALS` (squirrel, crow, deer, hedgehog, fox, pigeon + rabbit, duck). The world constructor spawns `stage.animals`.
- **New animals** (specs + models + gaits): 🐿️ squirrel (fast, darty, woods), 🐦‍⬛ crow (flies — baked elevated, tier 2), 🦌 deer (bolts far, big prize, tier 3), 🦔 hedgehog (woods), 🦊 fox (woods), 🐦 pigeon (flock). `'woods'` home draws them near the copses.
- **New food** (values + models): 🍄 mushroom, 🍅 tomato, 🫐 berry, 🌰 acorn — appended to `FOOD_KINDS` (indices stable for the protocol). The Common uses `WEIGHTS_COMMON` (mostly forest food); the school's 6-long tables can't reach the new kinds.
- **Verified:** headless — all forest kinds spawn, **0 in-solid / 0 out-of-bounds** over 3 min, **school byte-identical** to `main`; browser — berries/tomatoes/mushrooms/acorns and the animals render on the Common, gulped normally.

**Simplified vs the original pitch (behaviours, not creatures):** squirrels don't yet climb-and-vanish, crows don't steal, hedgehogs don't curl — they're distinct via stats (bolt = high flee, etc.) and models. Those signature behaviours are cheap follow-ups if we want them; noted for later.

### ✅ Phase 3 complete 2026-09-26 — danger: bears & wolves (on branch, NOT deployed)

**Done and verified.** The Common's dangers *come for you* — no rocks there, live predators instead.
- **`src/sim/predators.ts`** — `PREDATOR_KINDS = ['bear', 'wolf']`, per-kind `PredatorSpec`, the `Predator` runtime state, `makePredators(stage, rng)` (spawns `stage.predators`, clear of the player's start), and `blankPredator()` for the client to fill from snapshots.
  - 🐻 **Bear** — lumbers (roam 0.9 / chase 2.1), always hunts the nearest snake in a 16 m sight, a big slow bite (18% of mass, cap 22, every 2.6 s).
  - 🐺 **Wolf** — fast (roam 1.7 / **sprint 5.6**) but in bursts: a warning **howl**, a 4 s charge, then a 5 s slink-off rest. Smaller, quicker bites (10%, cap 12).
- **`Stage.predators`** — the school's is `[]` (so nothing there changes); the Common's is `1 bear + 2 wolves`. `World` spawns them, `updatePredators(dt)` runs them after the animals; bites `shed()` mass and puff pellets exactly like a rock bonk, with `OUCH_GRACE` immunity so they can't chain-bite.
- **Mode ferocity** (`Rules.predatorFerocity`: easy 0.7 / normal 1 / god 1.3) — scales wolf sprint speed and bite size, and shortens their rest. Measured max speed easy 3.9 → normal 5.6 → god 7.3.
- **Power counterplay** — Freeze Puff **roots** a predator (frozen 1.4 s); Dragon Breath, Zap Ring, Stink Cloud and Laser Eyes **spook** them into fleeing (`scaredFor`, turn tail and bolt). Powers now fire at a lone predator too, not only at rivals. New `howl` / `chomp` game events drive a snarl SFX + dust and a 🐻/🐺 "OUCH!" popup; red danger dots on the minimap (bigger for the bear).
- **Multiplayer** — `PredatorRow [x,z,heading,speed]` in snapshots, `welcome.predatorKinds` fixes each index's kind once; the `Replica` reconstructs blanks and blends them like animals. Positions are server-authoritative; the flee/freeze state lives sim-side only.
- **Verified:** typecheck + full build clean; headless — predators bite & howl, **0 in-solid / 0 out-of-bounds** over 200 s in all three modes, ferocity scales as designed; counterplay — freeze roots, breath scares; **school byte-identical** to the Phase 2 baseline (`4c82c20d` / `392056d6` / `38d6ad19`); browser — bear + wolf models render (2 instanced meshes, 1 + 2 instances), road/meadow scenery, 3 red minimap dots.

### ✅ Phase 4 complete 2026-09-26 — the kids + Miss Sami (on branch, NOT deployed)

**Done and verified.** The Common is *alive*: a crowd of children running about, and a friendly grown-up.
- **`src/sim/kids.ts`** — `KID_KINDS = ['naughty', 'nice', 'runner']`, the `Kid` runtime state, `makeKids(stage, rng)`, `blankKid()`, and the `Projectile` (pebble / kiss) type. Untouchable, deterministic, and a no-op on the school (empty roster ⇒ no RNG drawn there).
  - **runner** — tears about, roaming wild and sometimes freezing mid-dash to stare: the whimsy.
  - **naughty** — lobs a **pebble** at a snake within reach (a small capped shrink, "oops! a pebble", the school's stones reborn as mischief).
  - **nice** — blows a **kiss** (a floating ❤️): a little gift — growth, and a 1-in-4 chance of a gem.
- **Aiming** — kids lead the target a little (70%), and a pebble/kiss can strike anywhere along its flight, so throws connect ~30% of the time: dodgeable but real (measured ~20–30 pelts + ~8–11 kisses per 200 s from ~70–90 throws).
- **Bumping a kid** is a gentle nudge — the snake is deflected, the child scatters, an "oops!" popup; nobody is ever hurt.
- **Miss Sami + a mum** — two figures nattering on the grass just off the Telfer Road mouth (`Stage.greeters`, drawn from `COMMON_GREETERS`). Miss Sami drops a warm, whimsical line now and then through the same speech-bubble as Mr Cooper.
- **Render** — `kidView` (instanced naughty/nice/runner children with a scampering gait), `projectileView` (a tumbling grey pebble and a bobbing heart, arced by flight progress), Miss Sami (teal coat) + mum (purple coat) built into the Common scenery. Cyan kid dots on the minimap (distinct from food-yellow and danger-red).
- **Multiplayer** — `KidRow [x,z,heading,speed]` + `welcome.kidKinds` (kind fixed per index, blended like animals); `ProjectileRow [x,z,kind,t]` sent every snapshot (short list, arc height from `t`). New `lob` / `pelt` / `kiss` events (per-player where they land) drive the FX, popups and the gem on a lucky kiss.
- **Verified:** typecheck + full build clean; headless — 8 kids, pebbles & kisses land, Miss Sami chatters, gentle kid-bumps, **0 in-solid / 0 out-of-bounds** over 200 s in all three modes, projectiles bounded (≤4 in flight); **school byte-identical** to the earlier baseline (`4c82c20d` / `392056d6` / `38d6ad19`); browser — naughty/nice/runner kids scamper the meadow, Miss Sami + mum stand and chat, the heart projectile arcs, minimap shows cyan kid dots, no console errors.

**Simplified vs the pitch:** the fence-gap *portal* stays deferred (access is the menu picker), so Miss Sami greets you from the Common's road mouth rather than the school fence; her "100 gems" gate is moot (the menu handles it). Kid roster is fixed (8) rather than a living crowd that grows/shrinks.

### ✅ Phase 5 complete 2026-09-26 — magic creatures & the Glade (on branch, NOT deployed)

**Done and verified.** The heart of Level 2: shy, ethereal creatures in the south woods that grant magic.
- **`src/sim/creatures.ts`** — `CREATURE_KINDS` (8), per-kind `CreatureSpec` (rarity weight, flee speed, glow), the `Creature` runtime, `makeCreatures(stage, rng)` (a weighted roster — the stag is a lucky-day roll), `creatureSpot()` (the Glade + woods), `blankCreature()`. Deterministic, and a no-op on the school (count 0 ⇒ no RNG there).
- **A magic-buff status system on the snake** — `MAGIC_IDS = ['rainbow','hidden','magnet','owl','halo']` as seconds-left timers (`giveMagic` / `hasMagic` / `tickMagic`), synced to clients as a bitmask (a 10th `SnakeRow` field), so any snake under a spell shimmers/haloes/rainbows.
- **They flee.** Gulped by a touch at **any tier** (no gate), but they bolt from the nearest snake, so catching one is a chase; each fades for 25 s then returns elsewhere in the woods. The **Glade** (`GLADE ≈ (0,46)`, a new `homePoint('glade')` zone) is where they gather.
- **The eight magics** (`World.castMagic`): 🦌 **Stag's Blessing** — leap to the next size tier, a big score, a halo; 🦄 **Rainbow Rush** — 20 s every bite golden + a rainbow trail; 🦉 **Owl Eyes** — 30 s the minimap reveals the creatures, and your next card is epic-or-better; 🐸 **Royal Ribbit** — roots the nearest predator harmless for 10 s; 🦊 **Fox Trick** — 15 s invisible to predators *and* rivals (unseeable, unbonkable); 🧚 **Pixie Dust** — 20 s huge food magnet; 🐿️ **Acorn Hoard** — a burst of mass; 🌟 **Wisp Cache** — a knot of golden food appears around you. Each earns gems.
- **Render** — `creatureView` (8 instanced models — white stag, unicorn, owl, frog, two-tailed kitsune, pixie, golden squirrel, wisp-orb — bobbing, faded when gulped) each trailing its own aura sparkle; a themed `magic` burst + fanfare on the gulp; a rainbow trail, a golden halo, an invisibility shimmer and a magnet/owl glimmer on the snake; violet creature dots on the minimap **only while Owl Eyes is up**.
- **Multiplayer** — `CreatureRow [x,z,heading,speed,present]` + `welcome.creatureKinds` (blended like animals); the snake's magic rides the new bitmask field. `magic` events are per-player (their gems and fanfare).
- **Verified:** typecheck + full build clean; headless across 40 seeds — **all 8 creatures gulp**, and **all 8 effects fire** (rainbow-golden, hidden, magnet, owl lucky-card, stag tier-jump, frog predator-root, wisp golden-cache, squirrel mass), creatures respawn, **0 in-solid / 0 out-of-bounds**; **school byte-identical** (`4c82c20d` / `392056d6` / `38d6ad19`); browser — the unicorn, pixie, frog and golden squirrel render and flee, gulping them rockets the score/tier and earns stars/gems, no console errors.

**Simplified vs the pitch:** the **Wizard Hat tie-in** (creatures approaching instead of fleeing) is deferred — the hat is presentation and isn't plumbed into the sim yet. Frog Prince **roots** the predator rather than spawning a separate gulpable frog; the Will-o'-the-wisp **is** the treasure (its cache) rather than a light you follow. Creatures are drawn normally while `hidden` (a shimmer), not truly translucent.

**Level 2 is feature-complete** through Phase 5. Remaining polish (Phase 6, optional): atmosphere — parked cars & scenery on Emmanuel Road, the playground landmark, ambient sound, and the deferred items above if wanted.
