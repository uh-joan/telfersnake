# Telfersnake HD (Unity)

A Unity 6 / URP remaster of Telfersnake, built alongside the web game in the parent folder:
the school and the Common, the gem powers, magic creatures and the Tuck Shop. Same rules,
same places, same cast — rendered with real lighting.

Everything on screen is **made in code at start-up**: there are no imported models,
textures or sounds. The only asset files are the shaders, a font and the (empty) scene.

## Run it

- **Editor:** open this folder with Unity **6000.6.4f1**, open
  `Assets/Telfersnake/Scenes/Main.unity` (or use *Telfersnake ▸ Open Main Scene*) and press Play.
  `GameRoot` boots itself in any scene via `RuntimeInitializeOnLoadMethod`.
- **Builds:** *Telfersnake ▸ Build ▸ WebGL / macOS*, or headless:

  ```bash
  Unity -batchmode -projectPath unity -executeMethod Telfer.EditorTools.Builder.WebGL -quit
  ```

  Output goes to `Builds/` (git-ignored). The WebGL build uses Brotli with the
  decompression fallback, so any static server works (`python3 -m http.server`).

### Controls

| | |
|---|---|
| Mouse | the snake chases the pointer; hold a button to dash |
| Touch | drag anywhere (floating stick); second finger or the ⚡ button dashes |
| Keys | WASD / arrows, Space or Shift to dash, 1–3 pick a card, Esc pauses |
| Gamepad | left stick, A / right trigger to dash, Start pauses |

## How it is put together

```
Assets/Telfersnake/
  Scripts/Sim/     the rules: a straight C# port of src/sim (school stage, solo play)
  Scripts/View/    everything you see, modelled in code
  Scripts/UI/      the HUD (UGUI built from code) and the 3D icon photographer
  Scripts/Audio/   the web game's Web Audio recipes, synthesised into AudioClips
  Scripts/Game/    GameRoot (boot + fixed-step loop + events → juice), input, dev captures
  Resources/Shaders  the house shaders
```

- **Sim** (`Sim/`) — `World`, `Snake`, `Bot`, `Animals`, `Cooper`, `Hazards`, `Upgrades` mirror
  `src/sim/*.ts` constant for constant. Fixed 1/60 s steps, seeded RNG, no Unity types, events out.
  Sim space is metres with +x east, +z south; `View.W` maps it to Unity (+z north).
- **Ground** (`View/Ground.cs`, `View/Painter.cs`) — an anti-aliased SDF rasteriser that paints the
  playground plan exactly as `ground.ts` does on its canvas: court, lagoon, hopscotch, lanes, crest
  (in a little blocky bitmap font), plus stains, cracks, drains and paving.
- **Scenery** (`View/Scenery.cs`) — buildings with brick and tiled gable roofs, windows, chimneys,
  the solar roof and a slatted pergola, the chain-link Cage (cut out in the shader, so it casts
  dappled shadows), the shade sail, the climbing platform, benches, trees, cars, railings,
  bunting and the terraced streets. Buildings and trees between the camera and your snake
  screen-door fade; your snake also shows as an x-ray silhouette behind walls.
- **Snake** (`View/SnakeView.cs`, `Shaders/Snake.shader`) — a tube rebuilt every frame along the
  sim's trail, tapering to the tail and bulging where a gulp travels down it. The skin shader draws
  chevrons, belly, scales with a fake bump, a wet gloss and a dash pulse from the tube's uvs alone.
  The head is modelled: big eyes that blink and look where you steer, a flicking forked tongue,
  a helmet and a dragon crown when earned, Bee Buddies orbiting on the sim clock.
- **Lighting** (`Shaders/TelferCommon.hlsl`, `View/Atmosphere.cs`) — soft wrapped light, cool
  shadow tint, hemisphere ambient, gloss and rim; drifting cloud shadows and wind are global.
  Post: bloom, neutral tonemapping with a warm grade, vignette, a tilt-shift depth of field on
  the snake (Bokeh on desktop, Gaussian on WebGL/mobile), and chromatic/lens punches on hits
  and tier-ups.
- **Grass** (`View/Nature.cs`) — instanced tufts and wildflowers on the Green that sway and part
  around snakes, animals and Mr Cooper (`_TelferPushers`), plus butterflies, pigeons and pollen.
- **Juice** (`View/Fx.cs`, `Game/GameRoot.cs`) — crumbs that bounce off the tarmac, sparkles,
  dust, confetti, shockwave rings, screen shake, slow-mo on tier-ups, food flying into the mouth.
- **The Common** (`View/CommonEnv.cs`, `View/TreeField.cs`, `View/WildViews.cs`) — level 2,
  unlocked for ⭐300: the painted meadow and roads, instanced woods, the Telferscot Road
  terraces, Emmanuel Road with parked cars, the playground, the fallen log and the Glade. Bears,
  wolves, kids with pebbles and kisses, Miss Sami, the park keeper and eight magic creatures.
- **Meta** (`Meta/`, `UI/Shop.cs`) — the saved profile (stars, blue gems, unlocks, best scores)
  and the Tuck Shop catalogue: skins, 18 hats and trails, shown on your snake in play.
- **HUD** (`UI/`) — visual first, short words, no sentences: score, size bar with the next
  animals you can gulp *here*, gem counter, magic timers (the creature, a ring that runs down),
  XP bar, a minimap shaped to the place (gulpable animals yellow, too-big pink, predators red,
  kids cyan, creatures violet while Owl Eyes lasts), leaderboard, rival name tags, speech
  bubbles, level-up cards with a 💎 price on the powers, and a "Home time!" screen with the
  stars and gems won. Every picture is the game's own 3D model, photographed by `Icons`.

## Driving it from the command line

The `Tools/` scripts drive a running editor through the Unity CLI's Pipeline package
(`com.unity.pipeline`): `replay.sh` (stop, recompile, play), `shot.sh name` (render the game
camera with the HUD to `Screenshots/`), `ev.sh 'C#'` and `uconsole.sh`. A headless editor works:

```bash
Unity -batchmode -projectPath "$PWD" -logFile Logs/batch-editor.log &   # stays resident
Tools/replay.sh
Tools/ev.sh 'Telfer.Game.GameRoot.Autopilot = true; return "ok";'
Tools/shot.sh title
```

`GameRoot.Autopilot` lets a bot drive your snake; `GameRoot.LookAt` / `LookAtFn` point the camera.

## Playing online

Play first looks for a seat on the same Node server as the web game (`npm run server`, port
8787), so Unity and web players share rooms; with no server it quietly starts a solo run.
`Scripts/Net` speaks the server's JSON protocol (`src/net/protocol.ts`) and `Replica` ports
`src/net/replica.ts`: the server runs the world, other snakes are drawn a few ticks behind, and
your own snake is predicted. The server address comes from:

- the editor and dev builds: `ws://localhost:8787/play`
- a WebGL page: its own host, or that host on port 8787 when served from another port
- a release desktop build: `wss://telfersnake.joans.cat/play`
- an override: `-server <url>` on the command line or `?server=<url>` on the page

The live server only accepts the site's origin. Desktop builds send it explicitly; a WebGL
build hosted anywhere else needs adding to `ALLOWED_ORIGINS` on the server.

Font: Fredoka (SIL Open Font License, see `Resources/Fredoka-OFL.txt`).
