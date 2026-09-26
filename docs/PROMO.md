# Telfersnake promo: shot list & beat sheet

*30.4 s · 9:16 (1080×1920) with a 16:9 (1920×1080) cut · 60 fps · for parents, teachers and kids, shared on WhatsApp/Instagram.*

The film is bookended by the school grounds (hook, yard, race to the Dragon, Tuck Shop, end card: about
20 s); the Common (road, splash, weather, friends, bear and wolves, magic: about 10 s) is the adventure in the middle.

Every frame is the real game running in-engine: the game's own renderer, sim, HUD banners, weather, unlock splash
and synth (music and SFX). The director stages it, and the motion graphics are drawn on top. Nothing is faked:
where a moment is staged (a chicken nudged onto the beat, a tier crossed on cue, the sky forced to rain),
it is still the game doing the thing.

## The grid

The game's theme (`src/audio/music.ts`) runs at **142 BPM**: a beat is 0.4225 s and a bar is 1.690 s. The film is
**18 bars = 72 beats = 30.42 s**. Every cut, word and staged hit is placed in beats (`scripts/promo/beats.ts`).
Measured on the final mix, the strong onsets fall a median 19 ms from the sixteenth grid (95% within 37 ms,
about a frame). Staged gulps, boings, tier-ups and fire land within 30 ms of their beat.

## Beat sheet

| Beats | Time | Shot | What happens (all in-engine) | On screen | Sound |
|---|---|---|---|---|---|
| 0–4 | 0.0–1.7 | **Hook** · school yard | The Dragon (top tier: red head, horns, flame) tears across the lanes, the green and the pond, and bursts through the title. Its letters pop and spring back. Fire breath on beat 2. | **TELFER / SNAKE**, both there on frame 0, over a sun-ray burst | Theme at full (level 4) · `tierUp` on 0 · `whoosh` (fire) on 2 |
| 4 | 1.7 | wipe | Yellow and green cut-paper bands | | |
| 4–12 | 1.7–5.1 | **School yard** | A Wiggly Worm on the green: munch (5), **BOING** off a sheep (6), munch (7), crosses into **Grass Snake** on 8 (the game's banner), gulps a chicken on 10 | EAT! 🍪 · BOING! · GROW! · GULP! 🐔 | level 1 · `eat` `boing`+sheep `eat` `tierUp` `gulp` `eat` on the beats |
| 12–20 | 5.1–8.5 | **Up Telferscot Road** · Common | Out of the school gate, down the road between the terraces, dashing from 16.5 | LEVEL 2 🌳 | Common arrangement (birdsong), level 2 · `zip` |
| 16.3–22 | 6.9–9.3 | **Unlock splash** | The game's own splash: the golden lock rattles, **shatters on beat 18**, and the park blooms | (wordless, as in the game) | |
| 20–28 | 8.5–11.8 | **The Common · weather** | The meadow opens out. Sun, then rain rolls in (23.5), a storm, lightning on 26 and 27 | THE COMMON! ☀️ · RAIN! 🌧️ · ⚡ | level 3 · `thunder` on 26 |
| 28–32 | 11.8–13.5 | **Friends** | Children run along with the snake; the nice ones blow it kisses (hearts) | FRIENDS! 💕 | `golden` (a kiss lands) |
| 32–36 | 13.5–15.2 | **Bear & wolves** | A bear blocks the way; on 34 two wolves spot the snake, howl and chase; it dashes off (no bites) | BEAR! 🐻 · WOLVES! 🐺 | `growl` on 34 · `zip` |
| 36–40 | 15.2–16.9 | **Magic** | A unicorn; the snake catches it on 38: *🦄 Rainbow Rush* (the game's banner) and the rainbow trail | MAGIC! ✨ 🦄 | level 2 · `golden` on 38 |
| 40 | 16.9 | wipe | | | |
| 40–52 | 16.9–22.0 | **Race to the Dragon** · school yard | Along the running lanes: Grass Snake (40) → Python (42) → Anaconda (44) → MEGA Telfersnake (46) → **The Dragon** (48), each on the beat with the game's banner and tier bar. Fire breath on 49 and 51, beside the Old School | rings on each tier · **THE DRAGON!** 🐲 | school arrangement again, a layer added per size (levels 1→4, as the game does) · `tierUp` ×5 · `whoosh` ×2 |
| 52 | 22.0 | wipe | | | |
| 52–64 | 22.0–27.0 | **Tuck Shop** · school | An outfit per beat: skins (52–55), hats (56–59), trails (60–63) | TUCK SHOP · SKINS! · HATS! · TRAILS!, plus the item's icon each beat | school arrangement, level 4 · `chaChing` on 52/56/60, `pick` on the rest |
| 64 | 27.0 | wipe | | | |
| 64–72 | 27.0–30.4 | **End card** · school yard | Rainbow-skinned, crowned Dragon with the stardust trail, softly blurred | **Telfer / snake** (the start screen's logo colours) · 🐍 · ▶ telfersnake.joans.cat · star burst on 68 | last note on 68 · the game's school **bell** (home time) |

## Guardrails kept

- **No staff or school name on screen.** Mr Cooper's and the park keeper's figure is not drawn, and his sim is parked
  off-stage. Miss Sami's figure (and the mum's) is hidden, and every speech bubble is dropped. School shots look south,
  away from the TELFERSCOT crest painted on the tarmac. The only text on screen is the promo's own words, the game's
  tier and magic banners, and the URL.
- **Kid-safe.** In-game characters only. No pebbles, no bites. The bear and wolves chase but never catch.
- **Game unchanged.** Nothing in `src/` was modified. The director is a separate page (`scripts/promo/director.html`),
  served only by `vite` in development, gated on `import.meta.env.DEV` and `?director`, and not part of `vite build`.

## Tooling (`scripts/promo/`)

| File | Role |
|---|---|
| `env.ts` | Loaded first: seeds `Math.random`; puts `performance.now`, `Date.now`, timers and CSS animations on a virtual clock |
| `director.html` / `director.ts` | The game's renderer, views and HUD, wired as in `main.ts`, running the shot list one exact frame at a time. It logs every sound the game makes, with its time |
| `shots.ts` | The ten shots: stage, snake pose (`lay`), steering, beat-exact baits, sky, camera |
| `titles.ts` / `overlay.ts` | The words and stickers per beat, and the motion-graphics engine (kinetic letters with knock physics, die-cut stickers, cut-paper plates and wipes, bursts, rings) |
| `audio.ts` | Renders the game's own `Sfx` + `Music` in an `OfflineAudioContext`, sample-exact to the log. Arrangement cues, designed hits, and a +5 dB music-bus lift while the Common's softer arrangement plays |
| `record.mjs` | Playwright (installed Chrome) steps and screenshots every frame into ffmpeg, renders the audio, masters it to −14 LUFS with a −2 dB limiter, and muxes |

```bash
npm run promo                  # promo-9x16.mp4 (30 fps; add -- --fps 60 for the final)
npm run promo:16x9             # promo-16x9.mp4
node scripts/promo/record.mjs stills --beats 0,2,48   # PNGs of chosen beats, for review
node scripts/promo/record.mjs audio                   # the soundtrack alone, in ~2 s
node scripts/promo/record.mjs overview                # top-down plans of both stages
```

A full 30 fps render takes about 2 minutes on an M-series Mac (GPU Chrome). Outputs are git-ignored.
