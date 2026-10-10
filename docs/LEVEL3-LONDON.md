# LEVEL 3 — London

*Brainstorm, 2026-10-09. Companion to [BRAINSTORM.md](BRAINSTORM.md) and [LEVEL2-THE-COMMON.md](LEVEL2-THE-COMMON.md).*

> **Status: brainstorm, decisions locked** (§17). Plan: [LEVEL3-LONDON-PLAN.md](LEVEL3-LONDON-PLAN.md). Nothing built yet. Phase A is the classic (three.js) game; Phase B is the
> Unity HD port. Same rules as Level 2: each phase ships on its own, the school and the Common stay
> byte-identical, kid-safe throughout.

## 1. Vision

The school was tarmac and a petting farm. The Common was green, wild and magic. **London is a picture book.**

You don't play *in* London, you play **on the tourist map of London**: the one every kid has seen on a
museum wall or a tea towel. A huge illustrated map spread across the floor, the Thames a fat blue ribbon
winding through it, and the famous buildings **popping up out of the page** like a pop-up book: oversized,
chunky, bright, each one instantly recognisable from its shape alone. Big Ben is taller than it should be.
The London Eye turns slowly. Tower Bridge opens. Red buses trundle along painted streets. Pigeons everywhere.

The story: Telfer has eaten their way across the Common and hopped on the **Northern line at Tooting Bec**
(the real Tube station at the Common, true to the map). Next stop: London. Telfer pops out of the
Underground at Westminster, right under Big Ben, and the whole city is lunch.

One-line pitch for kids: **"Eat your way round London."**

## 2. The look: a tourist map you can slither on

The art direction is the whole point of this level, so it gets rules.

### 2.1 Recognisability rules (for a 6–7 year old)
1. **Silhouette first.** Every landmark has one defining shape that reads from the game camera, from far
   off, at phone size. If you squint and can't tell it's Big Ben, it's wrong.
2. **One colour story each.** Big Ben = honey-gold stone + a glowing white clock face. Tower Bridge =
   grey towers + sky-blue walkways. Buckingham Palace = cream + gold gates + red guards. The Shard =
   glass blue. The Gherkin = pickle green. St Paul's = pale grey dome + golden cross. London Eye = white.
3. **Oversized, pop-up scale.** Landmarks are ~2× too big against the streets, like an illustrated map.
   Streets and houses are small and simple; the famous things are huge and detailed.
4. **Alive.** Each landmark does *one* thing: the clock hands move, the Eye turns, the bridge opens, the
   palace flag flutters, the Piccadilly screens flash, the fountains splash. Never static.
5. **Labelled with a ribbon, one word or two.** A floating paper banner over each landmark: **BIG BEN**,
   **LONDON EYE**, **TOWER BRIDGE**. Short words only, never sentences (the house rule). The picture
   carries the meaning; the word teaches it. Kids will learn the names by playing.

### 2.2 The map surface
- **Ground = the printed map.** Warm cream paper streets with crisp ink edges, bright flat green parks,
  sandy squares, the Thames in deep teal with **white wavy lines** painted on it (the cartoon water).
- **Map furniture painted on the floor:** a big **compass rose** in a square, a dotted **"tour route"**
  line linking the sights (a gentle hint of where to go), little drawn sailing boats on the river, a
  **"Here be snakes"** sea-serpent doodle in the corner like an old map.
- **Edge of the world = the edge of the map.** No invisible walls: the map ends in a folded paper border
  with **Union Jack bunting**, a cartouche with "LONDON" in big letters, a scale bar. Beyond: the table
  it's lying on (a hint of a giant teacup and a red-pen circle, as if a child planned the trip).
- **Toon outlines** on landmarks (an inverted-hull outline pass in classic, a proper outline in HD) so they
  look *drawn*, not modelled.
- **Weather is London weather.** Sunny spells, then a cartoon shower: umbrellas pop open on every NPC,
  puddles appear on the paper (they're slippy). A rainbow after. Occasionally a pea-souper fog rolls up
  the Thames and the landmarks loom out of it (spooky but friendly, never dark).

### 2.3 The minimap
The minimap finally *is* a map: a tiny tourist map with **landmark icons** instead of blank shapes, and a
stamp mark on the ones you've visited this run.

## 3. Geography: real London, folded to fit

Real London, honest about who's next to whom, but squashed so everything is a short slither apart. The
Thames does its real lazy S from west to east and **splits the map into north and south banks**. North up,
+x east, +z south (same convention as the Common).

| Area | Landmarks | Role |
|---|---|---|
| **Westminster** (centre-west, north bank, at the bend) | **Big Ben** + the Houses of Parliament, Westminster Abbey, the Tube exit | **Arrival.** You pop out of the Underground here. Big Ben bongs. |
| **South Bank** (opposite Big Ben) | **The London Eye**, the street-food market, a carousel | The Eye ride (§7). Street food. |
| **The Royal West** (west) | **Buckingham Palace** + golden Victoria Memorial, **The Mall** (a long red road), **St James's Park** with the lake | Royal Guards, corgis, pelicans, **Changing of the Guard** parade. |
| **Hyde Park** (far west / north-west) | The Serpentine lake, rowing boats, the **Elfin Oak** | The "green lung": the Glade of this level (§6). |
| **Museums** (south-west) | **Natural History Museum** with a dinosaur skeleton poking out of the roof | A dino egg treasure, a dino-bone food. |
| **Trafalgar Square** (north, centre) | **Nelson's Column**, the **four stone lions**, fountains, a sea of pigeons | Pigeon chaos; the lions are the level's "bears" (§5). |
| **Piccadilly Circus** (north-west of Trafalgar) | Flashing screens, the little winged statue on its fountain | Night-light colours; a dance-floor speed strip. |
| **Covent Garden** (north) | Market hall, street performers, the living statue | Fruit market; buskers. |
| **The City** (north-east) | **St Paul's Cathedral**, the **Gherkin**, the walkie-talkie, silver dragon boundary statues | Legends live here: the dragon, the phoenix (§6). |
| **Bankside** (south, centre) | **Shakespeare's Globe** (round, white, thatched), Tate Modern's chimney, the **wobbly Millennium Bridge** | The bridge actually wobbles. |
| **London Bridge & Borough** (south-east) | **The Shard**, Borough Market | Veg and cheese market. |
| **The Tower** (east, north bank) | **Tower of London** (white keep, four turrets), the **ravens**, a Beefeater, the Crown Jewels | Ravens; the jewel treasure. |
| **Tower Bridge** (far east) | Two towers, blue walkways, **lifts to let ships through** | The signature event (§7). |

**Bridges are the plot.** The Thames is the big new idea in level design: the map has two halves and you
cross at **Westminster Bridge**, the **Millennium Bridge** and **Tower Bridge** (plus a river boat, §7).
Bridges are chokepoints: where rivals meet, where buses rumble across, where you get cornered or escape.

**The river rule (recommended):** the snake **can swim**, but slowly (a paddling wiggle, ×0.5 speed) and
the current gently carries it east. So the river is never a wall that frustrates a 6-year-old, but
bridges are always the fast way. Swans and ducks live on it. *(Alternative: river is solid and bridges
are the only way. Cleaner, but the first time a child is stuck on the wrong bank it feels like a bug.)*

**Scale.** Bigger than the Common: about **170 × 130 m**, wide rather than tall, because the Thames runs
east–west. Tall landmarks sit mostly along the **north edge** of each bank block so the chase camera
looks *at* them, not through them; anything that gets between camera and snake fades to a see-through
ghost (needed for Big Ben and the Shard).

## 4. Food: a London menu

Zone-based like the Green and the Common's woods. Every food is a thing a London kid would point at and
say "I've had that!".

| Food | Where | Notes |
|---|---|---|
| 🐟🍟 **Fish & chips** (in paper) | along the river | Big value. Seagulls want it too (§5). |
| 🫖 **Scone with jam & cream** | Palace, Covent Garden | |
| 🍰 **Victoria sponge** slice | Palace garden party | The fancy one. |
| 🥪 **Cucumber sandwich** (crusts off) | Palace | Small, many. |
| 🥧 **Pie** | Borough, the City | |
| 🌭 **Sausage roll** | everywhere (picnic litter) | Replaces the sausage. |
| 🍞 **Crumpet** with butter | South Bank | |
| 🍓 **Strawberries & cream** | parks | |
| 🍎🍊🍌 **Fruit** | Covent Garden market | The healthy zone. |
| 🥕🥦 **Veg** | Borough Market | Greens still pay like chips (house rule). |
| 🍬 **Jelly babies** | Piccadilly, Trafalgar | Tiny, scattered in trails: a breadcrumb path. |
| 🍮 **Jelly & custard** | anywhere | Wobbles. |
| 🥯 **Bagel** | the City | |
| 🍪 **Biscuit**, and a 🫖 **cuppa tea** | everywhere | The tea is a 2-second little warm-up glow (tiny speed burst). |

**Golden food → Crown Jewel food.** Golden food becomes gem-studded and crowned: a golden scone, a
jewelled crumpet. Same double points, but on this map it twinkles with a tiny crown.

**Afternoon tea combo** (the London version of the old "balanced lunch"): eat a sandwich, a scone and a
slice of cake in a row → **"TEA TIME!"** banner, a cake-stand pops up with a burst of bonus food.

## 5. Animals and dangers

### 5.1 London animals (reuse the animal system)
| Animal | Tier | Behaviour | Why it's London |
|---|---|---|---|
| 🐦 **Pigeon** | 0 | Huge flocks in Trafalgar Square; the whole flock lifts off at once when you dash in | The most London thing there is. |
| 🐿️ **Grey squirrel** | 0 | Parks; finally does the deferred **run-up-a-tree** trick | |
| 🦆 **Duck** | 1 | Lakes, a line of ducklings: eat the chain for a combo | St James's Park |
| 🐶 **Corgi** | 1 | Zoomy, waddly, travels in a little pack from the Palace; *yips* when chased | Royal dogs, every kid loves them |
| 🦢 **Swan** | — | **Can't be gulped**: "The King's swans!" — HONK, it boops you away (any tier). A funny rule kids love to repeat | Real (swans are royal) |
| 🦅 **Seagull** | 2 | Steals food: swoops at a fish & chips near you and flies off with it. The deferred crow-steal, finally | Every South Bank picnic ever |
| 🦊 **Urban fox** | 2 | Night-ish, sly, circles you, raids the bins | Real London |
| 🐦‍⬛ **Raven** | 2 | Only at the Tower. There are always **six**: gulp one and a new one hops back ("The Tower must have six!") | Real legend |
| 🦩→**Pelican** | 3 | St James's Park; big beak, waddles, *gulps food itself* (a rival eater!) | Real: the park has pelicans |
| 🐴 **Guard horse** | 4 | Big, shiny, plumed rider-less horse trotting the Mall; Mega-tier prize | Household Cavalry |
| 🦖 **Dino skeleton** (escaped from the museum) | 5 (Dragon) | Clatters about, bones rattling; the Dragon-tier showpiece gulp | Natural History Museum |

### 5.2 Dangers (London has no bears)
The Common's lesson: *things that come for you* are the best part. London's versions:

- 🦁 **The Trafalgar Lions wake up.** The four bronze lions at Nelson's Column are statues… until you get
  close. Then one **stretches, yawns and prowls after you** (the bear, reborn: slow, heavy, a big capped
  bite), then gets tired and goes back to its plinth and freezes into a statue again. Kids will *love*
  watching the plinths to see which lion is missing. Freeze Puff turns it back to stone instantly.
- 🐦‍⬛ **Raven pair** from the Tower: the wolves, reborn. A **CAW!** tell, a swooping dive, a 4 s chase, a
  rest on a turret. They steal a bit of tail and a gem.
- 🚌 **Red double-decker buses** run the painted roads on fixed routes (they're on a timetable!). A bus
  doesn't chase, it's a moving wall: **DING DING!** and a honk as warning, and if it catches you it's a
  rock-style bonk ("Mind the bus!"). Bus stops on the route = safe, the bus pauses there. Teaches road
  sense in a silly way.
- 🚕 **Black cabs** zip faster on the bigger roads, shorter warning, smaller bonk. Fewer of them.
- ☔ **Puddles** (only in showers): slide like ice. 🌂 **Dropped umbrellas** replace sticks. 🚧
  **Roadworks** (cones and a barrier) replace rocks. 🦅 Seagulls (above) are the mischief layer.
- **Rocks/stones are gone**, like the Common.

All kid-safe: a bonk is a shrink + a funny popup. A lion caught you? It licks you and a bit of tail
falls off, "OOPS!". Nobody is ever hurt.

## 6. Mystical London: the legends come alive

London is full of real legends, statues and stories. These are this level's fantastic creatures: rare,
shy, they flee, gulp by touch at any tier, each grants a magic. They gather in **Hyde Park around the
Elfin Oak** (a real carved tree full of fairies) and along the river at dusk.

| Creature | Rarity | Magic | The real thing behind it |
|---|---|---|---|
| 🐉 **The Silver Dragon of the City** | mythic (the stag's slot) | **Dragon Wings** — 12 s of *flight*: you rise up, cross the Thames anywhere, glide over buses, see the whole map. The single best feeling in the game. | The silver dragon statues guarding the City of London's borders |
| 🦄 **The Royal Unicorn** | very rare | **Rainbow Rush** (golden bites + rainbow trail), now in red, white and blue | The unicorn on the royal coat of arms |
| 🦁 **The Royal Lion** (golden, crowned) | rare | **Mighty Roar** — a big golden ring: every predator and rival nearby is blown back and runs away | The lion on the royal coat of arms |
| 🔥 **The Phoenix of St Paul's** | rare | **Rise Again** — your next bonk or bite is undone with a burst of flame-feathers, and you pop back *bigger* | The phoenix carved over St Paul's door, "I will rise again" |
| 🧜 **The Thames Mermaid** | rare | **River Rider** — 20 s the river becomes a fast lane, the current pushes *you* | River legends |
| 🧚 **Elfin Oak Fairy** | uncommon | **Fairy Dust** — super-magnet | The Elfin Oak in Kensington Gardens |
| 👻 **The Friendly Tower Ghost** (a tiny sheet ghost in a ruff collar) | rare | **Boo!** — 15 s invisible to predators and rivals | The Tower's ghost stories, made cute |
| 🗿 **Gog & Magog** (two tiny giants) | rare | **Giant Snake** — 15 s you're the next tier up *and* twice as wide; buses bounce off *you* | The City's guardian giants at the Guildhall |
| ✨ **The Pearly Lights** | — | Not a buff: a trail of glowing pearl buttons appears. **Follow it** to a treasure (a Crown Jewel or a creature). The deferred "will-o'-the-wisp as a light to follow", finally built | Pearly Kings & Queens' buttons |

**The Crown Jewels.** Five jewels hidden around the map each run (one at the Tower, the rest moved by the
ravens and the seagulls). Collect all five in one run → **"ROYAL!"**: a crown appears on your head for the
rest of the run and a big star/gem payout. A whole-run goal that pulls kids across both banks.

## 7. The big set pieces

Each landmark should *do* something. These are the moments kids will tell their friends about.

1. **🔔 Big Ben bongs.** Every minute of the run, the Westminster Quarters chime plays, then BONG × the
   minute. On each BONG a ring of golden food bursts out across the map. The run's finale is Big Ben
   striking the hour.
2. **🌉 Tower Bridge opens.** Every so often a tall ship sails up the Thames, bells ring, and the bridge
   **lifts**: the road splits and tilts up. Be on it as it rises and you **slide down the ramp** with a
   speed boost (or tumble into the river, giggle). A timing game.
3. **🎡 Ride the London Eye.** Slither into the open capsule at the bottom: the Eye carries you up and
   round. The camera pulls back to a **bird's-eye view of the whole map** with every treasure, jewel and
   creature shown, then drops you back at the bottom with a little candy bonus. A breather and a scout.
4. **🚇 The Tube.** Roundel signs at ~5 landmarks are **Tube entrances**: slither in, "Mind the gap!",
   the screen does a quick tunnel whoosh with a mini tube map, and you pop out at another station. The
   in-world portal idea the Common deferred, done here as a teleport *within* one stage (no stage swap).
5. **💂 The Changing of the Guard.** Twice a run, a band and a column of guards march down the Mall from
   the Palace with a drum beat. A moving wall of bearskins. Follow behind the band and food drops like
   confetti. Cut through the line and you get politely pushed aside ("Ahem!").
6. **🎆 Fireworks finale.** In the last 30 s the sky dims a touch and fireworks burst over the Thames, the
   Eye lights up in rainbow colours. Every firework drops a gem.
7. **🌉 The Wobbly Bridge.** The Millennium Bridge wobbles from side to side whenever a big snake crosses.
   Pure comedy, nudges you about.
8. **✈️ Red-Arrows fly-past** (rare): three jets streak over and paint red-white-blue smoke trails in the
   sky; any snake underneath gets a free red-white-blue trail for the rest of the run.
9. **⛵ The river boat.** A little river bus shuttles along the Thames stopping at piers (Westminster,
   Bankside, Tower). Hop on, ride, hop off: a slow, safe ferry with a view.
10. **📸 Tourist selfie flash.** Tourists take photos: a flash briefly dazzles the screen edges (a funny,
   harmless "CLICK!"), and you *pose*, getting a "photo" sticker.
11. **🦖 The dinosaur escape.** Rarely, the dinosaur skeleton climbs out of the Natural History Museum roof
    and goes walkabout across the map. Only a Dragon-tier snake can gulp it. Legendary.

## 8. The people

### 8.1 Mr Cooper becomes a London Bobby 👮
**Recommended:** Mr Cooper patrols London as a **friendly Bobby**: the tall custodian helmet with the
silver star, a whistle, white gloves for directing traffic, hands behind his back. He's still Mr Cooper
(same face, same politeness), just on duty in town. He blows his whistle at speeding snakes, and on a big
bump you hear the classic: *"'Ello 'ello 'ello! What's all this, then?"*

Lines (keeping his voice: polite, dry, a bit grand):
- "'Ello, 'ello, 'ello. What's all this, then?"
- "No slithering on the Mall, please."
- "Mind the gap. And the buses. And the pigeons."
- "Has anyone seen a snake? Last seen on the Northern line."
- "The King's swans are not for eating, thank you."
- "Single file across the bridge, if you'd be so kind."
- "Walking feet. Even in London."
- "Lovely manners, everyone. Carry on sightseeing."
- "Who let the corgis out?"
- "I say. You've grown since Tooting."

(Bubbles only, no voice — Mr Cooper's voice was removed for good.)

### 8.2 The Royal Guard who never moves 💂
A **Royal Guard** in red tunic and bearskin stands in front of the Palace gates and **must not move,
whatever happens**. That's the game: circle him, bump him, zoom round him, and he stays perfectly still.
Wiggle around him **three full laps** and he… cracks… the tiniest smile, his eyes flick to you, and a gem
pops out of his bearskin. Then straight face again. A secret every kid will discover and share.

### 8.3 More London faces
- **Miss Sami becomes a tour guide** with a raised umbrella on a stick: "Keep together, everyone!" She
  meets you at the Tube exit and stands under Big Ben. Her umbrella is where the Pearly Lights start.
- **Mr Bramble the park keeper** → a **Beefeater** at the Tower (same keeper persona, red-and-gold robe,
  flat hat): "Mind the ravens. They bite. Politely."
- **The school trip.** A crocodile of kids in **hi-vis vests holding a long rope**, with a teacher at the
  front, snaking through the streets. A living conga line, untouchable, a moving wall. The nice kids
  wave ❤️; the naughty ones throw… **soggy chips** (the pebble, reborn).
- **Tourists** with maps and selfie sticks (the flash, §7).
- **Buskers** playing a tune at Covent Garden: slither past and your snake dances, a little speed boost
  while the music plays.
- **The living statue** — a silver street performer who freezes. Get close and he *moves*: "BOO!" Then
  freezes again. Harmless jump-scare comedy.
- **A royal wave.** Very rarely, the Palace balcony doors open and a **crowned silhouette** gives the royal
  wave, with corgis. Generic and cartoon, never a likeness of a real royal.

## 9. Spots and props

- **Red phone box** = the sanctuary (the Sail's job). Duck in and the phone rings: "Hello? Oh, it's for
  you!" and a gem drops out. Short stay timer.
- **Red postbox** — slither past and post a letter: it spits out a postcard of the nearest landmark (§10).
- **Bus stops** — a safe spot on bus routes.
- **Benches, lamp posts, black railings, bollards, Belisha beacons** (orange flashing zebra-crossing
  globes), **zebra crossings** painted on the roads: buses always stop for a snake on a zebra crossing
  (road safety lesson, sneaked in).
- **Fountains** at Trafalgar and Piccadilly: a splash zone that bounces food out.
- **Deckchairs** in the parks, **rowing boats** on the Serpentine.

## 10. The postcard album (the meta loop)

The landmarks become a **collection**, which is exactly what 6–7 year olds love:

- Reaching a landmark the first time in a run stamps it: a **rubber-stamp THUNK** on screen and a little
  inked stamp on the minimap.
- Each landmark has a **postcard** (a bright illustration of it, with the snake photobombing). Get it the
  first time you visit, ever. Stamp all the landmarks in one run → a **"WHOLE LONDON" gold postcard**.
- A **Postcard Album** screen off the menu: a fridge door full of postcards, the empty slots show a grey
  silhouette of the landmark you haven't found (the silhouette *is* the hint: no reading needed).
- Rare postcards: the Royal Guard smiling, the dinosaur escape, the dragon flight, a Tower Bridge leap,
  fireworks. These are the stories kids will brag about.

## 11. Cosmetics: the London collection

Shown only once London is unlocked (like the Common's). Some ⭐, some 💎.

**Hats:** 💂 Bearskin, 👮 Bobby Helmet, 🎩 Union Jack Top Hat, Beefeater Hat, 🎩 Bowler Hat, 👑 Tiara,
a Deerstalker (detective cap), a Pearly King Cap, a Tiny Big Ben (a clock-tower hat that chimes).

**Skins:** 🚕 Black Cab, 🇬🇧 Union Jack, 💂 Royal Guard (red + gold buttons), 📮 Postbox Red, 🐶 Corgi,
🌉 Tower Bridge Blue, 🌊 The Thames, ✨ Pearly King (black with pearl buttons), 🦁 Trafalgar Bronze,
🌃 Piccadilly Lights (animated neon). *(The Tube Train and Bus skins already exist and finally feel at home.)*

**Trails:** 🎆 Fireworks, 🎏 Bunting, ☔ Raindrops, 🫖 Tea Bubbles, ✈️ Red-Arrows smoke (red/white/blue
ribbons), 🕊️ Pigeon Feathers, 🫧 Thames Spray.

## 12. Sound

- **Westminster Quarters** (the Big Ben chime — public domain) as the stage's sting and the minute bell.
- **Music variation** built on **"London Bridge Is Falling Down"** and **"Oranges and Lemons"** (both
  traditional, public domain, and both about London — and *Oranges and Lemons* is literally about the
  bells of London churches). A jaunty brass-band/music-hall take on the synth.
- Ambience: pigeon coos, bus engine + **ding ding**, a distant ship horn, seagulls, Tube **"Mind the gap"**
  chime (a synth beep-boop, no voice line), rain on umbrellas.
- SFX: lion yawn/roar (soft), raven caw, swan HONK, corgi yip, Guard's band drums, bridge bells, stamp THUNK.

## 13. Access and economy

- **Unlock:** buy a **Golden Tube Ticket** (an Oyster-card-ish golden card) on the destination picker:
  🏫 School · 🌳 The Common · 🇬🇧 **London 🔒 ⭐600**. Must have unlocked the Common first (it's the next stop
  on the line). Unlock splash: the ticket *beeps* on a gate, the gate swings open, a Tube train whooshes
  through, and Big Ben rises out of the floor with a BONG.
- **Arrival scene:** each run starts with Telfer popping out of Westminster station under Big Ben.
- **×1.5 stars and gems** (the Common is ×1.25), so it's the place to get rich.
- **Difficulty modes still apply:** Easy = sleepy lions, slow buses; God = lions *and* ravens *and*
  laser-eyed rivals, and buses that run on time.

## 14. Size tiers in London

Same six tiers (consistency for kids), with London gulp hints in the HUD:
- Wiggly Worm: 🐦🐿️ · Grass Snake: 🦆🐶 · Python: 🦅🦊 · Anaconda: 🐦‍⬛ raven, pelican · MEGA: 🐴 · Dragon: 🦖

## 15. Guardrails

- Kid-safe as ever: no gore, nobody hurt, predators only shrink you with a giggle.
- **No real people's likenesses.** No King, no named royals: a crowned silhouette waves, that's all. Mr
  Cooper and Miss Sami are real staff: they keep their faces and gentle personas, and they should see
  their London costumes before anything ships.
- **No trademarks.** No Paddington, no Mary Poppins, no TfL logo (an original red-ring-and-bar *style*
  sign, our own), no Oyster branding (a "golden ticket"), no Peter Pan (the Elfin Oak fairies instead),
  no Doctor Who box, no brand-named foods.
- Traditional songs only (public domain).
- Road safety as a quiet bonus: buses stop at zebra crossings, bus stops are safe.

## 16. Phased plan

### Phase A — Classic (three.js), each phase shippable

| Phase | Ships | The work |
|---|---|---|
| **A0 · Ticket** | London on the picker as a locked goal, ⭐600 Golden Ticket, needs the Common. | `StageId 'london'`, `save.londonUnlocked`, picker chip, unlock splash. Registry still falls back (don't deploy alone, the Level 2 lesson). |
| **A1 · The map** | You can play on a beautiful tourist map. | `londonLayout.ts` (bounds, Thames, bridges, banks, roads, solids for landmark footprints); `render/london.ts`: the paper-map ground painter (streets, parks, river with wave lines, compass rose, tour route, border + bunting); **the landmarks** (Big Ben, Eye, Palace, Tower Bridge, Tower, St Paul's, Shard, Gherkin, Nelson + lions, Globe, NHM, Piccadilly) as chunky toon models with ribbon labels and their one animation each; occlusion fade; swim rule; landmark minimap. Populated with existing food/animals so it's fun day one. |
| **A2 · Menu & zoo** | It *tastes* and *sounds* like London. | London food kinds + zones + Crown-Jewel golden food + Tea Time combo; pigeons (flocks), corgis, swans (no-gulp HONK), seagulls (steal), ravens (always six), pelicans, guard horse, dino skeleton; London gulp hints. |
| **A3 · Danger** | Something comes for you. | Lions (wake, prowl, back to plinth, Freeze = stone), raven pair; buses + cabs on route splines (timetable, ding-ding tell, zebra-crossing stops); puddles/umbrellas/roadworks. |
| **A4 · People** | London is alive. | Bobby Cooper (+ lines), the unmoving Royal Guard (3-lap smile), Miss Sami the tour guide, Beefeater Bramble, the school-trip crocodile (soggy chips & kisses), tourists (flash), buskers (dance boost), living statue. |
| **A5 · Legends** | Wonder. | The 9 creatures + magics, incl. new **flight** (Dragon Wings) and **river rider**; the Pearly Lights trail; the Crown Jewels run goal; the Elfin Oak glade. |
| **A6 · Set pieces** | The moments. | Big Ben bongs + golden ring; Tower Bridge opening; London Eye ride + bird's-eye; Tube teleports; Changing of the Guard; river boat; wobbly bridge; fireworks finale; Red Arrows. |
| **A7 · Keepsakes** | A reason to come back. | Stamps + postcard album; London cosmetics; Westminster chimes + London music + ambience; ×1.5 economy; first-visit flourish; analytics stage tag. |

Multiplayer as before: rooms keyed by `(mode, stage)`; buses, lions, ravens, guards and creatures are
server-authoritative snapshot rows; set-piece timers are seeded so solo and server agree. **Determinism
check every phase: school and Common byte-identical.**

### Phase B — Unity HD

Mirror the classic, in the HD project's structure:
- **B1** `LondonEnv.cs` (like `CommonEnv.cs`): the map ground as a high-res painted texture with real
  normal/paper grain, a proper water shader for the Thames (scrolling wave lines, reflections of the
  landmarks), toon outline post-process.
- **B2** Landmark models in `ModelsLondon.cs`: code-built like today, but with the HD budget — lit clock
  faces, glass on the Shard/Gherkin, the Eye's capsules, Tower Bridge's real lifting bascules.
- **B3** Sim port (`WorldLondon.cs`): buses, lions, ravens, set pieces, creatures, mirroring the TS sim.
- **B4** HD-only treats: a real **flight camera** for Dragon Wings, volumetric fog for the pea-souper,
  fireworks with bloom, the Eye ride as a cinematic crane shot, golden-hour light over the river.
- **B5** Phone layout + the shared save (one wallet, one album across Classic and HD).

## 17. Decisions (2026-10-09)

Resolved: Mr Cooper is a patrolling **Bobby**, with a separate unmoving **Royal Guard**; the Thames is
**swimmable slowly**; London costs a **⭐600 Golden Ticket** and needs the Common first; **all twelve
landmarks** ship in the first map phase. The ravens are the predator pair (six perch on the Tower as
scenery). The build plan is in [LEVEL3-LONDON-PLAN.md](LEVEL3-LONDON-PLAN.md).
