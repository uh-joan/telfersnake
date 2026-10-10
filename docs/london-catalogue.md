# London cosmetics and postcards (A7) — for the HD build

The classic game's Tuck Shop gained London's collection in A7 (`src/meta/catalogue.ts`). The HD build keeps
its own catalogue (`unity/Assets/Telfersnake/Scripts/Meta/Catalogue.cs`); add these entries there with the
**same ids, kinds, prices and currencies**, so an item bought in one build is owned, worn and sold the
same in the other (the save stores ids only).

All of them have `place: 'london'`: shown in the shop only once London is unlocked. Currency: ⭐ = stars,
💎 = blue gems (`gem: true`). Colours are 0xRRGGBB, the skin pattern runs from the neck back, repeating.

## Skins (10)

| id | name | price | currency | head | pattern |
|---|---|---:|---|---|---|
| `black-cab` | Black Cab | 150 | ⭐ | 0x1d1f24 | 0x1d1f24, 0x1d1f24, 0x1d1f24, 0xffc93c |
| `union-jack` | Union Jack | 200 | ⭐ | 0x1f3fa8 | 0xc8102e, 0xffffff, 0x1f3fa8, 0xffffff |
| `royal-guard` | Royal Guard | 180 | ⭐ | 0x1c1c1f | 0xd8342c, 0xd8342c, 0xf2c230, 0xd8342c, 0xd8342c, 0x1c1c1f |
| `postbox` | Postbox Red | 90 | ⭐ | 0xd62d20 | 0xd62d20, 0xd62d20, 0xd62d20, 0x1c1c1f |
| `corgi` | Corgi | 120 | ⭐ | 0xe39b4c | 0xe39b4c, 0xe39b4c, 0xfff6e8, 0xe39b4c |
| `tower-blue` | Tower Bridge Blue | 110 | ⭐ | 0xd9cdb3 | 0x8cc8ec, 0x8cc8ec, 0xffffff, 0x8cc8ec |
| `thames` | The Thames | 140 | ⭐ | 0x1f8a96 | 0x1f8a96, 0x2fa6b0, 0x6fd0cf, 0x2fa6b0, 0xffffff |
| `trafalgar-bronze` | Trafalgar Bronze | 160 | ⭐ | 0x9a7444 | 0x9a7444, 0xb88a52, 0xd1aa70, 0xb88a52 |
| `pearly-king` | Pearly King | 45 | 💎 | 0x1c1c1f | 0x1c1c1f, 0xfffaf0, 0x1c1c1f, 0x1c1c1f, 0xfffaf0 |
| `piccadilly-lights` | Piccadilly Lights | 60 | 💎 | 0x2b1d4e | 0xff3fa4, 0xffd23f, 0x3fb6ff, 0x5cff8a, 0xff7a2f, 0xb36bff |

`piccadilly-lights` is animated (`shimmer: true`): the classic build chases the pattern from head to tail,
one segment every 1/8 s (segment `i` shows `pattern[(i - floor(t * 8)) mod n]`). The server sends the
flag inside the snake's `look` (`look.shimmer`); a client that ignores it simply shows the still pattern.

## Hats (9)

| id | name | price | currency | look |
|---|---|---:|---|---|
| `bowler` | Bowler Hat | 90 | ⭐ | black dome, curled brim |
| `deerstalker` | Deerstalker | 110 | ⭐ | tweed cap, front and back peaks, flaps tied up |
| `bobby` | Bobby Helmet | 120 | ⭐ | tall navy custodian helmet, silver badge |
| `pearly-cap` | Pearly King Cap | 130 | ⭐ | black flat cap covered in pearl buttons |
| `beefeater` | Beefeater Hat | 140 | ⭐ | flat navy Tudor bonnet, red band, red-white-blue rosettes |
| `tiara` | Tiara | 150 | ⭐ | silver arc with jewelled points |
| `union-top-hat` | Union Jack Top Hat | 160 | ⭐ | blue top hat with red/white crosses, red brim |
| `tiny-bigben` | Tiny Big Ben | 220 | ⭐ | honey clock tower, ticking hands; chimes (the Quarters' first phrase, small and high) every 20 s while worn |
| `bearskin` | Bearskin | 50 | 💎 | tall black fur, red plume, gold chin strap |

## Trails (7)

| id | name | price | currency | palette | look |
|---|---|---:|---|---|---|
| `raindrops` | Raindrops | 70 | ⭐ | 0x74c0fc, 0xa5d8ff, 0xe7f5ff | drops fall from ~2.6 m |
| `pigeon-feathers` | Pigeon Feathers | 70 | ⭐ | 0x9aa0aa, 0xc9ced6, 0xffffff, 0x7f8f9a | long feathers tumbling down |
| `tea-bubbles` | Tea Bubbles | 80 | ⭐ | 0xc98a45, 0xf3e3c3, 0xffffff | rising bubbles |
| `bunting` | Bunting | 90 | ⭐ | 0xc8102e, 0xffffff, 0x1f3fa8 | tumbling triangle pennants |
| `thames-spray` | Thames Spray | 100 | ⭐ | 0x1f8a96, 0x6fd0cf, 0xffffff | drops thrown up and out |
| `red-arrows` | Red Arrows | 140 | ⭐ | 0xe8303a, 0xffffff, 0x2f5fd0 | soft smoke puffs |
| `fireworks` | Fireworks | 40 | 💎 | 0xff3fa4, 0xffd23f, 0x3fb6ff, 0x5cff8a, 0xffffff | glowing sparks bursting outward |

## Postcards (`telfersnake.london.v1` → `postcards`)

Kept for ever; `stamps` lists every landmark ever stamped. Both are only ever unioned across builds/tabs.

- **Landmarks** (the first stamp ever of each — within its `LANDMARKS` `radius`): `bigben`, `eye`,
  `palace`, `museum`, `piccadilly`, `trafalgar`, `stpauls`, `globe`, `gherkin`, `tower`, `towerbridge`, `shard`.
- **Rare** (the moment, for the player's own snake, in London):

| id | when |
|---|---|
| `guard` | the Royal Guard's smile (the `guard` gem event) |
| `eyeride` | boarding the London Eye (`ride`, `on`, `by: 'eye'`) |
| `launch` | Tower Bridge's ramp launch (`launch`) |
| `dragon` | gulping the dragon (`magic`, `kind: 'dragon'`) |
| `royal` | all five Crown Jewels (`royal`) |
| `fireworks` | catching a fireworks treat (`treat`) |
| `tube` | a Tube trip (`warp`) |
| `teatime` | Tea Time (`teatime`) |
| `whole` | all 12 landmarks stamped in one run ("WHOLE LONDON!", the gold postcard) |

Analytics beacons: `postcard` (`id`, `n` = cards held) when one is kept, `album` (`n`) when the album opens.
