# Telfersnake HD (Unity)

A Unity 6 / URP remaster of the school level of Telfersnake, built alongside the web game
in the parent folder. Same rules, same school, same cast — rendered with real lighting.

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
- **HUD** (`UI/`) — visual first, short words, no sentences: score, size bar with the next
  animals you can gulp, XP bar, live minimap, leaderboard, rival name tags, Mr Cooper's speech
  bubbles, level-up cards and a "Home time!" results screen. Every picture is the game's own
  3D model, photographed by `Icons`.

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

## Not in this cut

The Common (level 2), multiplayer rooms, the Tuck Shop and the gem-priced powers stay in the web
game for now. The sim port keeps the shape of the TypeScript, so they can follow the same way.

Font: Fredoka (SIL Open Font License, see `Resources/Fredoka-OFL.txt`).
