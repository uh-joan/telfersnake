# Telfersnake — Brainstorm v0

Mobile-first 3D snake roguelite set in the playground of Telferscot Primary School.
Audience: primary-school kids. Tone: silly, warm, zero gore, zero meanness.

## 1. Pitch

> The petting farm has come for the Summer Fair, and someone left the gate open. Sheep in the football cage, chickens on the hopscotch, a goat on the amphitheatre steps. Meanwhile Telfer, the class pet snake, has slipped out of the tank and is VERY hungry. You have until the home-time bell.

Slither.io movement + Katamari size gates + Megabonk run structure (XP, pick 1 of 3 upgrades, builds, evolutions, meta unlocks), all in a 5–8 minute "school day".

The farm visit explains why there are sheep and goats in a London playground, and the fair gives us stalls, bunting and cake.

## 2. The map (from the satellite view)

Stylised low-poly, not photoreal. Arena is everything inside the school fence; roads are scenery only (the snake never goes on the road, a lollipop person at each gate boings you back in).

| Zone | Real feature | Gameplay role |
|---|---|---|
| The Cage | Turquoise fenced sports court, west side | Two entrances only. High-value food, footballs roll around and shove you. Risky with rivals: easy to get trapped. |
| Big Playground | Central tarmac with sprint lanes, hopscotch, target grid | Open hub. Sprint lanes = speed boost strips. Hopscotch = slither 1→10 in order for a combo bonus. Target grid = bullseye where lunchbox chests drop. |
| Blue Lagoon | Blue blob soft-play surface with climbing frame | Bouncy floor: snake hops, can jump over rivals and rocks here. Climbing frame = tunnels to thread through. |
| The Sail | Blue shade canopy | Safe zone. Rivals can't bonk you under it. Short stay timer so nobody camps. |
| Top Playground | Painted loop track, picnic benches, planters, amphitheatre steps | Painted track = lap it for a speed buff. Benches = lunch leftovers spawn here (burgers, sausages, cookies). Steps = cascading ramps. |
| The Green | Artificial grass, big tree, little garden (south-west) | Animal home. Veg patch grows broccoli, carrots, peas. Big tree drops apples and sticks; squirrels live in it. |
| Red Roof Hut | Orange-roofed building, south | The farm trailer is parked here: animals respawn from it. |
| Bike Shed Alley | Corrugated roof shed and car park, south-east | Brick and stone heavy. Narrow. Shortcut with a price. |
| The Old School | Victorian brick building, centre-east | Giant wall you route around. Doorways as short tunnels (enter one, pop out another). |
| Rooftops (late unlock) | Solar panel roofs | Bonus layer reached via a drainpipe with the Springs upgrade. Pigeons and golden food. |

Day variants (same map, new rules): Rainy Day (puddles slide you, snails and worms everywhere), Snow Day (ice drift, snowballs), Sports Day (cones, lanes, medals, egg-and-spoon chickens), Summer Fair (default: stalls, bouncy castle), Spooky Disco (night, glow skins, torch cone).

## 3. Core loop

1. Steer, eat, grow. Bigger = faster (as requested) but also wider turning circle and a bigger target, so big snakes are powerful but clumsy.
2. XP bar fills → game pauses → pick 1 of 3 upgrade cards.
3. Size tiers unlock bigger prey (Katamari rule).
4. School-day clock advances; spawns and rivals ramp up.
5. Bell rings → final showdown → results screen → stars, stickers, unlocks.

### Controls
- One thumb. Drag anywhere = floating joystick, snake steers toward it. Always moving.
- Second thumb (optional): Dash button (spends a little length, like slither) and one Ability button when you own an active.
- Portrait by default, landscape supported. Left-handed toggle.
- Camera: chase cam, ~55° tilt, pulls back as you grow. Minimap in the corner.

### Size tiers
| Tier | Name | Can now eat |
|---|---|---|
| 1 | Wiggly Worm | Food, snails, ladybirds |
| 2 | Grass Snake | Chickens, ducks, frogs |
| 3 | Python | Rabbits, squirrels, pigeons |
| 4 | Anaconda | Sheep, pigs |
| 5 | MEGA Telfersnake | Goats, the pony, boss snacks |

Too small for an animal? It boops you away (goat headbutt = comedy "boing", no damage).

## 4. Things to eat

### Static food
- Treats: burger, sausage, cookie, chips, fish finger (Fridays!), jam sandwich, custard pot. Big points, tiny Sugar Rush speed burst.
- Healthy: broccoli, carrot, peas, apple, banana, satsuma, sweetcorn. Steady growth plus a small timed buff (broccoli = tough skin, carrot = bigger view, banana = dash refill).
- Balanced Lunch combo: eat one treat, one veg, one fruit in a row → multiplier. Parents and teachers will approve.
- Golden food: rare, sparkly, lots of XP.
- Lunchbox chests: land on the target grid. Circle it fully with your body to open → free upgrade (Megabonk chest).

### Moving animals
| Animal | Speed | Behaviour |
|---|---|---|
| Snail | very slow | Leaves a slime trail that is a mini speed strip |
| Ladybird | slow | Wanders planters |
| Chicken | medium, erratic | Panics in random directions, flaps |
| Duck | medium | Walks in a line of ducklings: eat the chain for a combo |
| Frog | hops | Only out on rainy days |
| Rabbit | fast zigzag | Dives into burrows on The Green |
| Squirrel | very fast | Runs up the big tree if chased too long |
| Pigeon | flies off | Lands elsewhere; sneak up slowly (no dash) |
| Sheep | slow, flocks | Moves as a herd, flees as a group |
| Pig | medium | Goes for the same food you do |
| Goat | medium, stubborn | Charges you when you are small |
| Pony | fast | Tier 5 only, laps the painted track |
| Golden Chicken | ridiculous | Legendary. Appears once per run. Whole server chases it. |
| Hedgehog | slow | Do NOT eat. Prickly = shrink. Teaches kids to read shapes. |

Round-up mechanic: fully encircle animals with your body to scoop them all at once for a bonus. Sheep flocks are made for it.

**Kid-safe eating:** animals go "gulp!" with a pop and a puff of sparkles, then travel down the snake as a funny bump. They simply vanish; no gore, no remains.

## 5. Things that shrink you (never kill)

Rocks, sticks, stones, bricks (as requested, low frequency), plus: PE cones, hedgehogs, conkers, chewing gum (slows instead of shrinks), puddles (slide), stray footballs from The Cage (shove).

On hit: comedy "bonk", snake hiccups out 2–5 tail segments as snack pellets that anyone can re-eat. So a mistake is a setback you can partly recover, and rivals can steal it.

## 6. Rival snakes (the only real threat)

- Rule: your head into another snake's body = you get bonked. Their head into yours = they do.
- Bonked = stars round the head, snake bursts into a confetti of snacks, "Back to the tank!" → respawn small after 3 seconds. Default mode never ends your run; you lose length and your streak, not the game. (Hard mode: 3 hearts.)
- AI personalities: Noodle (timid, flees), Sir Hiss-a-lot (greedy, beelines for golden food), Slinky (circler, tries to trap), Danger Noodle (dasher), Spaghetti (huge, slow, oblivious).
- Bosses at clock milestones, framed as contests not fights:
  - Morning break: The Giant Goose (chases you honking, make it bump your body 3 times).
  - Lunchtime: Hoover-saurus, the caretaker's runaway vacuum, sucks up all the food; out-eat it.
  - Home time: The Mega Python of Hyde Farm, final showdown.

## 6b. Mr Cooper, the head teacher

Tall, thin, short white hair, always immaculate in a suit and tie. He sprints around the playground telling everyone not to run, in the politest British accent imaginable. He is never edible, never harmful, never cross.

- **Lines** (speech bubble only; a spoken text-to-speech voice was tried and removed on 2026-09-21 as annoying): "No running, please!", "Do move along, please.", "Walking feet, thank you!", "Single file, if you'd be so kind.", "Snakes must sign in at the office.", "That is not what the hopscotch is for.", "Splendid. Absolutely splendid. Move along."
- **Walking Feet aura:** within ~6 m of him every snake (you and rivals) is slowed to walking pace and cannot dash. He is a roaming speed bump, and a mobile shield when a rival is chasing you.
- **Bump him:** you bounce off with a boing. "I beg your pardon!" No shrink.
- **He comes looking for you:** about a third of the time his next stop is wherever you are. He gets quicker as the day goes on, still yelling "no running".
- Later ideas: whistle that freezes all animals for 2 seconds; confiscates the Golden Chicken and walks it to the office (chase him!); tips his imaginary hat when you hit tier 5 ("Goodness. You have grown. Still no running."); Tuck Shop unlock "Head Teacher's Award" sticker for a run with zero bumps into him.
- If he is based on the real head: keep it affectionate (it is) and get his blessing before a public release.

## 7. Upgrades (Megabonk-style)

Level up → choose 1 of 3 cards. Rarities: common / rare / epic / legendary. Each stacks to level 5. Max 4 actives + 4 passives per run, so builds matter. Rerolls and skips are earnable.

**Headgear (defence)**
- Bike Helmet: absorbs one bonk, recharges. (Wear your helmet, kids.)
- Hard Hat: rocks and bricks no longer shrink you.
- Swim Goggles: puddles don't slide you.

**Body**
- Hedgehog Spikes: rivals touching your body bounce off and drop segments.
- Roller Skates: more top speed. Springs: hop button, jump rocks and rivals.
- Magnet Tail: food drifts toward you.
- Stretchy Belly: more growth per bite.
- Bubble Wrap: first hit each minute is free.

**Breath (auto-fires forward, like Megabonk weapons)**
- Dragon Breath: cartoon flame puff. Toasts food ahead (toasted = double points), spooks animals into a stampede, rivals it touches shrink with a puff of smoke and a singed-tail "yowch". No burning animals ever: they just run.
- Ice Breath: freezes rivals and animals in an ice cube for 2 seconds.
- Bubble Breath: traps small animals in bubbles that float to you.
- Rainbow Breath: turns rocks ahead into sweets.
- Mega Burp: fizzy-drink shockwave, pushes everything away. Kids will lose it.

**Auto helpers**
- Long Tongue: frog-style, grabs nearby food automatically.
- Tail Whip: periodic spin that bats rocks away.
- Bee Buddies: orbiting bees fetch food.
- Hatchlings: leave eggs that hatch into baby snakes that collect for you.
- Sheepdog Whistle: animals nearby freeze for a moment.

**Passives (tomes)**: Homework Book (+XP), Lunch Money (+stars), Four-leaf Clover (+luck/rarity), Carrot Vision (+camera range), Second Breakfast (+growth).

**Evolutions** (two maxed upgrades combine):
- Helmet + Spikes → Stegosaurus Armour
- Dragon Breath + Springs → full Dragon form with little wings, short glides
- Magnet Tail + Long Tongue → Hoover Mode
- Roller Skates + Springs → Pogo Skates
- Bee Buddies + Hatchlings → The Conga Line
- Ice + Dragon Breath → Steam Train (whistle stuns, leaves a fog trail)

## 8. Meta progression (between runs)

- Gold stars earned per run → spend in the Tuck Shop on skins, hats, trails, starting perks.
- Sticker album ("Snake-o-pedia"): one sticker per food, animal, upgrade, evolution and boss discovered. Completion is the long-term goal.
- Skins: school jumper, football kit, tiger, dino, robot, sock puppet, sausage dog, caterpillar, rainbow, Loch Ness, bendy bus, Tube train, liquorice, Chinese New Year dragon.
- Hats: party hat, crown, wizard, bobble hat, propeller cap, pirate.
- Characters with different starts (Megabonk style): Telfer the corn snake (balanced), Nessie (starts with Bubble Breath), Sir Scales (starts with Helmet), Turbo the slow-worm (fast, tiny), Granny Python (big, slow, magnet).
- Quests: "Eat 20 broccoli", "Round up 5 sheep in one circle", "Finish a run without hitting a rock", "Catch the Golden Chicken".
- House points: pick one of four houses; every run adds to your house total on a shared board. Gives a team feeling without direct competition.
- Daily Playtime: same seed for everyone each day, one leaderboard.

## 9. Multiplayer

Phased so the single-player game ships first but nothing has to be rewritten.

1. **v1: bots that feel like players.** Same rules as multiplayer, so the simulation is already "N snakes in an arena".
2. **v1.5: async.** Daily seed leaderboard, house points, ghost replays of friends.
3. **v2: real-time rooms.** 4-letter room code, up to 8 snakes, bots fill empty seats. Server-authoritative sim at ~20 Hz over WebSockets (Colyseus or PartyKit style), clients interpolate. Host on Railway.
   - Playtime (free-for-all, longest snake at the bell wins, bonked = respawn, no elimination)
   - House Battle (2v2 / 4v4, team length total)
   - Round-up (co-op: herd all the animals into the trailer before the bell)
   - Tag (one snake is "it", glowing; bonk passes it on)
   - Golden Chicken Chase (one chicken, everyone after it)

Architecture consequence now: keep game logic deterministic and separated from rendering (fixed timestep, input → sim → render), so the same sim runs on a server later.

## 10. Kid safety and good manners

- No chat, ever. Preset emotes only (wave, laugh, "gg", "oops").
- No accounts, no real names: generated nicknames (PurplePython42). No personal data stored; progress in local storage.
- No ads, no purchases, no loot-box-for-money. Aim to meet the UK Children's Code.
- Words: "bonked", "back to the tank", "gulp". Never "kill", "die", "dead".
- Little Ones mode: no rivals, no shrinking, just eat and grow.
- Gentle "time for a break?" nudge after a few runs. Colour-blind safe palette, icon-first UI (early readers), optional voiced prompts.
- It is a real school: keep it stylised, no real people or names, and worth a friendly heads-up to the school before any public release under its name.

## 11. Look, sound, feel

- Chunky low-poly, bright saturated palette, blob shadows, googly eyes on everything. Snake body squashes and stretches; food bump travels down it.
- Juice: screen-shake-lite, confetti on level-up, number pop-ups, combo announcer ("BALANCED LUNCH!", "ROUND-UP!", "MEGA BURP!").
- Audio: kazoo-and-ukulele playground theme that adds layers as you grow; school bell marks phases; each animal has a silly voice.
- Assets: CC0 packs (Kenney food kit has burger/sausage/broccoli/cookie; Quaternius has animated farm animals) to get moving fast, custom hero snake.

## 12. Tech proposal

- Three.js + TypeScript + Vite, shipped as an installable offline PWA. Capacitor wrapper later if app stores matter.
- Snake = head with steering + position-history buffer; segments sample the buffer (smooth slither-style, cheap). Instanced meshes for segments, food and props.
- No physics engine: circle colliders + spatial hash grid.
- Map authored as a JSON layout (zones, walls, spawners) blocked out from the satellite image, roughly 90 m × 80 m.
- Budget: 60 fps on a mid-range phone, < 5 MB first load, < 150 draw calls, DPR capped at 2.
- Fixed-timestep deterministic sim, isolated from rendering (see multiplayer).

## 13. Milestones

- **M0 Toy (done):** joystick steering, follow cam, playground blockout, food, grow + speed up, Mr Cooper.
- **M1 Playground (done, except zone gimmicks):** 8 animals with behaviours (snail, ladybird, chicken, duck, rabbit, sheep, pig, goat), size tiers gate what can be gulped, too-big animals boop you (goats charge), rocks/sticks/stones/bricks shrink you and drop re-eatable pellets, score, HUD, minimap. Still to do from M1: zone gimmicks (sprint-lane boost, hopscotch combo, bouncy lagoon, safe sail), round-up circling, squirrels/pigeons/pony/Golden Chicken.
- **M2 Roguelite (upgrades and rivals done):** XP bar and 3-card level-ups that pause the game; 11 upgrades (Roller Skates, Stretchy Belly, Homework Book, Bubble Wrap, Magnet Tail, Long Tongue, Bike Helmet, Four-leaf Clover, Hedgehog Spikes, Dragon Breath, Bee Buddies) plus Snack Pack filler and golden food; 4 rival bots (Noodle, Sir Hiss-a-lot, Danger Noodle, Spaghetti) on the same rules as the player, head-into-body bonk, burst into pellets, respawn small after 3 s with 3 s of blinking grace, safe under the Sail; leaderboard and name tags. Rivals level up but get no cards and have size caps. Still to do from M2: optional School Day clock, a boss, upgrade evolutions, Slinky the circler.
- **M3 Keep playing (skins, Tuck Shop, sounds done):** stars earned per run (1 per 100 points, +10 per size reached, +5 per rival bonked), banked to a local save as you play; pause button and "Home time!" results screen; Tuck Shop with 12 skins, 5 hats and 4 trails bought with stars only (no real money anywhere); generative playground tune that adds melody, shaker, drums and glockenspiel as you grow; animal voices, school bell, whooshes and clacks, all synthesised; sound button cycles everything / effects only / off. UI rule from playtest feedback: picture-first with short labels, no sentences, never icons-only. Still to do from M3: sticker album, quests, installable PWA.
- **Playtest tuning (2026-09-21):** food 140 → 42 and animals 36 → 17; XP per level is `20 + 14·L + 2·L²`; goats charge once per goat; a bonk sends you back to the smallest size, wipes all upgrades and resets the level so cards come quickly again (`BONK_UPGRADE_LOSS` in `src/sim/world.ts`: 'all' | 'one-level' | 'none'), which makes the Bike Helmet the insurance policy. Upgrades now show in the world: dragon flame and embers, magnet rings plus a horseshoe on the tail, tongue lash, bubble-wrap shell, belly bulges, skate dust, clover twinkles, stars over dazzled animals.
- **M4 Together (first version done):** Play always joins a shared playground; bots sit in every empty seat (6 seats), a joining player takes a bot's seat and hands it back on leaving; with no connection the same game runs on the phone alone. One Node server (`server/`, WebSocket at `/play`) runs the unchanged sim at 60 Hz as the only authority, sends 15 snapshots a second (about 17 KB/s per player) and also serves the built game. Phones predict their own snake with the sim's own `move()` and replay unacknowledged inputs on each snapshot; everyone else is drawn 7 ticks in the past, blended between snapshots; bodies are never sent, each phone lays them from the head it shows. Level-up cards freeze your snake (untouchable) for up to 8 s then auto-pick; menus do the same for up to 30 s ("away"). Names are picked from word lists (30 x 22 + two digits), never typed, and re-checked by the server; no chat. Skins, hats, trails and name can be changed mid-game from the pause menu and everyone sees it at once. Catalogue: 25 skins, 16 hats, 12 trails. Run it: `npm run server` beside `npm run dev`, or `npm run build && npm start` for one process on one port. **Live at https://telfersnake.joans.cat** Installable to the home screen: web manifest + a home-screen icon (a golden bead-snake, in the game's own style, coiled around a white 'T' and wearing the Wizard Hat — `public/icon.svg`, rebuild the PNGs with `npm run icons`, needs the dev-only `sharp`). The Wizard Hat is now the game's most expensive item (2000 stars). since 2026-09-21: one container behind the shared Caddy on the deploy box, see `deploy/README.md`; redeploy with `deploy/deploy.sh`. Still to do: private rooms for friends (the server supports codes, the UI does not offer them), house points board.

- **Difficulty modes (done, 2026-09-21):** three ways to play, chosen on the start screen. A mode is a small `Rules` bundle (`src/sim/modes.ts`) handed to the `World` — rival personalities, food count, and a `botsGetUpgrades` flag — so the whole engine is reused.
  - **🐣 Easy** — rivals shrunk (mass cap ×0.5), slowed (≤0.8), made timid and oblivious (no hunting, no dashing), and a bit more food (55): a five-year-old is soon the biggest snake in the yard.
  - **⚡ Normal** — exactly the tuning the game shipped with (rivals unchanged, food 42). The reference.
  - **🧙 God** — rivals faster than a fresh player (≤1.15), greedier and cannier, and they **take level-up cards too** (the one `if (bot) s.pendingCards = 0` in `world.step()` is flipped; bots auto-grab the scariest card via `botCardChoice`, never freezing). The secret challenge: hidden until you own **both** the Golden Snake skin (500★) and the Wizard Hat (2000★), then it reveals itself once with a little flourish. Guarded in `save.ts` so a hand-edited save can't force it. Easy and Normal are always available.
  - Multiplayer: the chosen mode rides the `hello` message; the server pools rooms per mode (an Easy room full of dumb little bots, a God room full of fire-breathers). Bots still fill empty seats, so every mode always feels alive. Old clients with no mode field default to Normal and never cross-contaminate a pool.

## 13b. Real Telferscot details (from telferscot.co.uk, 2026-09-21)

- Colours: navy blue + yellow (navy sweatshirt, yellow/navy polo, blue/yellow gingham). PE kit: white polo + navy shorts. Used for the app icon, the map crest, the School Jumper and PE Kit skins.
- The head really is **David Cooper** (Headteacher) — Mr Cooper is affectionate and accurate; get his blessing before any public promotion under the school's name.
- Centenary: "100 Years of Learning" (on the wall mosaic) — painted into the ground crest.
- Six "principles for learning": Motivate & Challenge, Creative & Inspirational, Life Long Learning, Equal Opportunities, Collaboration & Family Learning, Respect & Resilience — a few now colour Mr Cooper's lines; good source for future house names / quests.
- App icon + favicon: the blue/yellow tile badge with a white "T" and a yellow-and-navy snake, echoing the school's "TELFER SCOT" mosaic. The mosaic crest is painted on the tarmac in front of the Old School. Neighbourhood terraces now have brick walls. Regenerate the icon with `npm run icons`.

- Map (2026-09-21): the school's Old School wings use a brick texture (`brick: true` on the Building, painted via `brickTexture()`), and the terraced houses have brick walls too. (Enterable classrooms and a west-perimeter gate were tried and reverted — the east stays one solid brick mass, `oldMain` + `oldNorthEast`.)

## 14. Decisions (settled 2026-09-21)

1. Run format: the timed school day is **optional**. Mode select: Free Play (endless, default) or School Day (timed, bosses).
2. Bonk consequence: **respawn small**. No lives.
3. Eaten animals **simply vanish** with a gulp and a pop. No end-of-run reappearance.
4. Orientation: **portrait-first, landscape must work**.
5. Multiplayer: **after M3**. Sim stays deterministic and render-free so it can move to a server.
6. Stack: **Three.js + TypeScript + Vite**, PWA in M3. Procedural low-poly models first, CC0 packs where they save time.
