import type { SnakeLook } from '../sim/snake';

/**
 * Everything the Tuck Shop sells. Paid for with stars earned by playing, and nothing else:
 * there is no real money anywhere in this game.
 */

export type ItemKind = 'skin' | 'hat' | 'trail';

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  /** In stars, or in blue gems when `gem` is set. */
  price: number;
  icon: string;
  /** Bought with blue gems instead of stars (the currency only: `place` decides who sees it). */
  gem?: boolean;
  /** Only shown in the shop once this place is unlocked. Unset: everyone sees it. */
  place?: 'common' | 'london';
}

export interface Skin extends Item {
  kind: 'skin';
  head: number;
  /** Segment colours from the neck back, repeating. */
  pattern: number[];
  /** The pattern chases along the body like a string of lights (Piccadilly Lights). */
  shimmer?: boolean;
}

export interface Trail extends Item {
  kind: 'trail';
  palette: number[];
}

const repeat = (color: number, n: number) => Array<number>(n).fill(color);

export const SKINS: Skin[] = [
  { id: 'telfer', kind: 'skin', name: 'Classic Telfer', price: 0, icon: '🐍', head: 0x57c955, pattern: [...repeat(0x4cbb4a, 4), 0xf2d94a] },
  { id: 'jumper', kind: 'skin', name: 'School Jumper', price: 40, icon: '🧥', head: 0x1b3a86, pattern: [...repeat(0x1b3a86, 3), 0xffd21f] },
  { id: 'pe', kind: 'skin', name: 'PE Kit', price: 40, icon: '🎽', head: 0xffffff, pattern: [0xffffff, 0xffffff, 0x1b3a86] },
  { id: 'bumble', kind: 'skin', name: 'Bumblebee', price: 60, icon: '🐝', head: 0xffd43b, pattern: [0xffd43b, 0xffd43b, 0x1c1c1f, 0x1c1c1f] },
  { id: 'tiger', kind: 'skin', name: 'Tiger', price: 80, icon: '🐯', head: 0xff922b, pattern: [0xff922b, 0xff922b, 0xff922b, 0x1c1c1f] },
  { id: 'candy', kind: 'skin', name: 'Candy Cane', price: 80, icon: '🍭', head: 0xffffff, pattern: [0xe03131, 0xe03131, 0xffffff, 0xffffff] },
  { id: 'dino', kind: 'skin', name: 'Dinosaur', price: 120, icon: '🦕', head: 0x2f9e44, pattern: [0x2f9e44, 0x2f9e44, 0x9c36b5] },
  { id: 'sausage', kind: 'skin', name: 'Sausage Dog', price: 150, icon: '🌭', head: 0x8a5a3a, pattern: [0xa86b42] },
  { id: 'robot', kind: 'skin', name: 'Robot', price: 180, icon: '🤖', head: 0xced4da, pattern: [0xadb5bd, 0xadb5bd, 0x22b8cf] },
  { id: 'rainbow', kind: 'skin', name: 'Rainbow', price: 200, icon: '🌈', head: 0xff6b6b, pattern: [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x9775fa] },
  { id: 'bus', kind: 'skin', name: 'Bendy Bus', price: 250, icon: '🚌', head: 0xd62828, pattern: [0xd62828, 0xa5d8ff, 0xd62828, 0xd62828] },
  { id: 'tube', kind: 'skin', name: 'Tube Train', price: 250, icon: '🚇', head: 0xe03131, pattern: [0xf1f3f5, 0xf1f3f5, 0x1c4fa3, 0xf1f3f5, 0xe03131] },
  { id: 'caterpillar', kind: 'skin', name: 'Caterpillar', price: 50, icon: '🐛', head: 0xe03131, pattern: [0x8ce99a, 0x51cf66] },
  { id: 'zebra', kind: 'skin', name: 'Zebra', price: 70, icon: '🦓', head: 0xffffff, pattern: [0xffffff, 0xffffff, 0x1c1c1f] },
  { id: 'ladybird', kind: 'skin', name: 'Ladybird', price: 70, icon: '🐞', head: 0x1c1c1f, pattern: [0xe03131, 0xe03131, 0x1c1c1f, 0xe03131] },
  { id: 'watermelon', kind: 'skin', name: 'Watermelon', price: 90, icon: '🍉', head: 0x2f9e44, pattern: [0xff6b81, 0xff6b81, 0x1c1c1f, 0xff6b81, 0x2f9e44] },
  { id: 'football', kind: 'skin', name: 'Football Kit', price: 90, icon: '⚽', head: 0xffffff, pattern: [0x1971c2, 0x1971c2, 0xffffff] },
  { id: 'ice', kind: 'skin', name: 'Ice Pop', price: 110, icon: '🧊', head: 0xe7f5ff, pattern: [0xa5d8ff, 0xd0ebff, 0xffffff] },
  { id: 'lava', kind: 'skin', name: 'Lava', price: 130, icon: '🌋', head: 0x2b2d42, pattern: [0x2b2d42, 0xff4500, 0xffb703, 0xff4500] },
  { id: 'camo', kind: 'skin', name: 'Camouflage', price: 130, icon: '🌿', head: 0x5c7c3a, pattern: [0x5c7c3a, 0x3d5a2a, 0x8a9a5b, 0x4a3f2a] },
  { id: 'allsorts', kind: 'skin', name: 'Allsorts', price: 160, icon: '🍬', head: 0x1c1c1f, pattern: [0xff8fab, 0x1c1c1f, 0xffd43b, 0x1c1c1f, 0xffffff, 0x1c1c1f, 0x4dabf7, 0x1c1c1f] },
  { id: 'unicorn', kind: 'skin', name: 'Unicorn', price: 220, icon: '🦄', head: 0xffffff, pattern: [0xffc9de, 0xe5dbff, 0xc5f6fa, 0xfff3bf] },
  { id: 'galaxy', kind: 'skin', name: 'Galaxy', price: 280, icon: '🌌', head: 0x3b1d6e, pattern: [0x1b1340, 0x3b1d6e, 0x5f3dc4, 0x22b8cf, 0x3b1d6e] },
  { id: 'nessie', kind: 'skin', name: 'Loch Ness', price: 300, icon: '🦕', head: 0x0b7285, pattern: [0x0b7285, 0x0b7285, 0x15aabf] },
  { id: 'gold', kind: 'skin', name: 'Golden Snake', price: 500, icon: '🏆', head: 0xffe066, pattern: [0xffd43b, 0xfab005, 0xffe066] },
  // Common-only, bought with blue gems: forest and magic looks.
  { id: 'fox', kind: 'skin', name: 'Sly Fox', price: 30, gem: true, place: 'common', icon: '🦊', head: 0xd9662a, pattern: [0xd9662a, 0xd9662a, 0xf3ead3] },
  { id: 'toadstool', kind: 'skin', name: 'Toadstool', price: 25, gem: true, place: 'common', icon: '🍄', head: 0xd23b32, pattern: [0xd23b32, 0xffffff, 0xd23b32, 0xd23b32] },
  { id: 'stag', kind: 'skin', name: 'White Stag', price: 45, gem: true, place: 'common', icon: '🦌', head: 0xf3efe6, pattern: [0xe9e4d8, 0xe6c766, 0xe9e4d8] },
  // London-only (A7): everyday ones in stars, the special ones in blue gems. Ids and prices are
  // mirrored in the HD build's Catalogue.cs (docs/london-catalogue.md).
  { id: 'black-cab', kind: 'skin', name: 'Black Cab', price: 150, place: 'london', icon: '🚕', head: 0x1d1f24, pattern: [0x1d1f24, 0x1d1f24, 0x1d1f24, 0xffc93c] },
  { id: 'union-jack', kind: 'skin', name: 'Union Jack', price: 200, place: 'london', icon: '🇬🇧', head: 0x1f3fa8, pattern: [0xc8102e, 0xffffff, 0x1f3fa8, 0xffffff] },
  { id: 'royal-guard', kind: 'skin', name: 'Royal Guard', price: 180, place: 'london', icon: '💂', head: 0x1c1c1f, pattern: [0xd8342c, 0xd8342c, 0xf2c230, 0xd8342c, 0xd8342c, 0x1c1c1f] },
  { id: 'postbox', kind: 'skin', name: 'Postbox Red', price: 90, place: 'london', icon: '📮', head: 0xd62d20, pattern: [0xd62d20, 0xd62d20, 0xd62d20, 0x1c1c1f] },
  { id: 'corgi', kind: 'skin', name: 'Corgi', price: 120, place: 'london', icon: '🐶', head: 0xe39b4c, pattern: [0xe39b4c, 0xe39b4c, 0xfff6e8, 0xe39b4c] },
  { id: 'tower-blue', kind: 'skin', name: 'Tower Bridge Blue', price: 110, place: 'london', icon: '🌉', head: 0xd9cdb3, pattern: [0x8cc8ec, 0x8cc8ec, 0xffffff, 0x8cc8ec] },
  { id: 'thames', kind: 'skin', name: 'The Thames', price: 140, place: 'london', icon: '🌊', head: 0x1f8a96, pattern: [0x1f8a96, 0x2fa6b0, 0x6fd0cf, 0x2fa6b0, 0xffffff] },
  { id: 'trafalgar-bronze', kind: 'skin', name: 'Trafalgar Bronze', price: 160, place: 'london', icon: '🦁', head: 0x9a7444, pattern: [0x9a7444, 0xb88a52, 0xd1aa70, 0xb88a52] },
  { id: 'pearly-king', kind: 'skin', name: 'Pearly King', price: 45, gem: true, place: 'london', icon: '✨', head: 0x1c1c1f, pattern: [0x1c1c1f, 0xfffaf0, 0x1c1c1f, 0x1c1c1f, 0xfffaf0] },
  { id: 'piccadilly-lights', kind: 'skin', name: 'Piccadilly Lights', price: 60, gem: true, place: 'london', icon: '🌃', head: 0x2b1d4e, pattern: [0xff3fa4, 0xffd23f, 0x3fb6ff, 0x5cff8a, 0xff7a2f, 0xb36bff], shimmer: true },
];

export const HATS: Item[] = [
  { id: 'no-hat', kind: 'hat', name: 'No hat', price: 0, icon: '🚫' },
  { id: 'party', kind: 'hat', name: 'Party Hat', price: 40, icon: '🥳' },
  { id: 'bobble', kind: 'hat', name: 'Bobble Hat', price: 60, icon: '🧶' },
  { id: 'propeller', kind: 'hat', name: 'Propeller Cap', price: 80, icon: '🧢' },
  { id: 'wizard', kind: 'hat', name: 'Wizard Hat', price: 2000, icon: '🧙' }, // the legendary one: dearer than anything else
  { id: 'flower', kind: 'hat', name: 'Flower', price: 50, icon: '🌼' },
  { id: 'cat-ears', kind: 'hat', name: 'Cat Ears', price: 60, icon: '🐱' },
  { id: 'bunny-ears', kind: 'hat', name: 'Bunny Ears', price: 70, icon: '🐰' },
  { id: 'chef', kind: 'hat', name: 'Chef Hat', price: 80, icon: '👨‍🍳' },
  { id: 'cone', kind: 'hat', name: 'Traffic Cone', price: 80, icon: '🚧' },
  { id: 'cowboy', kind: 'hat', name: 'Cowboy Hat', price: 110, icon: '🤠' },
  { id: 'top-hat', kind: 'hat', name: 'Top Hat', price: 120, icon: '🎩' },
  { id: 'pirate', kind: 'hat', name: 'Pirate Hat', price: 130, icon: '🏴‍☠️' },
  { id: 'viking', kind: 'hat', name: 'Viking Helmet', price: 140, icon: '🪓' },
  { id: 'halo', kind: 'hat', name: 'Halo', price: 160, icon: '😇' },
  { id: 'crown', kind: 'hat', name: 'Crown', price: 150, icon: '👑' },
  // Common-only, bought with blue gems.
  { id: 'acorn', kind: 'hat', name: 'Acorn Cap', price: 20, gem: true, place: 'common', icon: '🌰' },
  { id: 'flower-crown', kind: 'hat', name: 'Flower Crown', price: 25, gem: true, place: 'common', icon: '🌸' },
  { id: 'antlers', kind: 'hat', name: 'Antlers', price: 30, gem: true, place: 'common', icon: '🦌' },
  // London-only (A7).
  { id: 'bowler', kind: 'hat', name: 'Bowler Hat', price: 90, place: 'london', icon: '🎩' },
  { id: 'deerstalker', kind: 'hat', name: 'Deerstalker', price: 110, place: 'london', icon: '🔍' },
  { id: 'bobby', kind: 'hat', name: 'Bobby Helmet', price: 120, place: 'london', icon: '👮' },
  { id: 'pearly-cap', kind: 'hat', name: 'Pearly King Cap', price: 130, place: 'london', icon: '🧢' },
  { id: 'beefeater', kind: 'hat', name: 'Beefeater Hat', price: 140, place: 'london', icon: '🏰' },
  { id: 'tiara', kind: 'hat', name: 'Tiara', price: 150, place: 'london', icon: '👸' },
  { id: 'union-top-hat', kind: 'hat', name: 'Union Jack Top Hat', price: 160, place: 'london', icon: '🇬🇧' },
  { id: 'tiny-bigben', kind: 'hat', name: 'Tiny Big Ben', price: 220, place: 'london', icon: '🕰️' },
  { id: 'bearskin', kind: 'hat', name: 'Bearskin', price: 50, gem: true, place: 'london', icon: '💂' },
];

export const TRAILS: Trail[] = [
  { id: 'no-trail', kind: 'trail', name: 'No trail', price: 0, icon: '🚫', palette: [] },
  { id: 'sparkle', kind: 'trail', name: 'Sparkles', price: 60, icon: '✨', palette: [0xffd84a, 0xfff3b0, 0xffffff] },
  { id: 'bubbles', kind: 'trail', name: 'Bubbles', price: 60, icon: '🫧', palette: [0xa5d8ff, 0xe7f5ff, 0xffffff] },
  { id: 'leaves', kind: 'trail', name: 'Autumn Leaves', price: 60, icon: '🍂', palette: [0xe8590c, 0xf59f00, 0x8a5a3a] },
  { id: 'hearts', kind: 'trail', name: 'Love Hearts', price: 70, icon: '💖', palette: [0xff8fab, 0xff4d6d, 0xffc2d1] },
  { id: 'snow', kind: 'trail', name: 'Snowflakes', price: 70, icon: '❄️', palette: [0xffffff, 0xe7f5ff, 0xd0ebff] },
  { id: 'slime', kind: 'trail', name: 'Slime', price: 80, icon: '🟢', palette: [0x94d82d, 0x66a80f, 0xc0eb75] },
  { id: 'embers', kind: 'trail', name: 'Embers', price: 100, icon: '🔥', palette: [0xff4500, 0xffb703, 0xffe066] },
  { id: 'ocean', kind: 'trail', name: 'Sea Spray', price: 100, icon: '🌊', palette: [0x15aabf, 0x66d9e8, 0xffffff] },
  { id: 'confetti', kind: 'trail', name: 'Confetti', price: 120, icon: '🎉', palette: [0xffd84a, 0xff6b6b, 0x4dabf7, 0x8be36a, 0xf783ac, 0xffffff] },
  { id: 'stardust', kind: 'trail', name: 'Stardust', price: 140, icon: '🌟', palette: [0xfff3bf, 0xffd43b, 0x748ffc, 0xffffff] },
  { id: 'rainbow-trail', kind: 'trail', name: 'Rainbow Dust', price: 150, icon: '🌈', palette: [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x9775fa] },
  // Common-only, bought with blue gems.
  { id: 'petals', kind: 'trail', name: 'Petals', price: 25, gem: true, place: 'common', icon: '🌸', palette: [0xffc9de, 0xff8fab, 0xffffff] },
  { id: 'fireflies', kind: 'trail', name: 'Fireflies', price: 30, gem: true, place: 'common', icon: '💫', palette: [0xfff6a0, 0xc0eb75, 0xffffff] },
  { id: 'magic-dust', kind: 'trail', name: 'Magic Dust', price: 40, gem: true, place: 'common', icon: '🔮', palette: [0x9775fa, 0xc0ffe6, 0xffd43b, 0xffffff] },
  // London-only (A7).
  { id: 'raindrops', kind: 'trail', name: 'Raindrops', price: 70, place: 'london', icon: '☔', palette: [0x74c0fc, 0xa5d8ff, 0xe7f5ff] },
  { id: 'pigeon-feathers', kind: 'trail', name: 'Pigeon Feathers', price: 70, place: 'london', icon: '🕊️', palette: [0x9aa0aa, 0xc9ced6, 0xffffff, 0x7f8f9a] },
  { id: 'tea-bubbles', kind: 'trail', name: 'Tea Bubbles', price: 80, place: 'london', icon: '🫖', palette: [0xc98a45, 0xf3e3c3, 0xffffff] },
  { id: 'bunting', kind: 'trail', name: 'Bunting', price: 90, place: 'london', icon: '🎏', palette: [0xc8102e, 0xffffff, 0x1f3fa8] },
  { id: 'thames-spray', kind: 'trail', name: 'Thames Spray', price: 100, place: 'london', icon: '🫧', palette: [0x1f8a96, 0x6fd0cf, 0xffffff] },
  { id: 'red-arrows', kind: 'trail', name: 'Red Arrows', price: 140, place: 'london', icon: '✈️', palette: [0xe8303a, 0xffffff, 0x2f5fd0] },
  { id: 'fireworks', kind: 'trail', name: 'Fireworks', price: 40, gem: true, place: 'london', icon: '🎆', palette: [0xff3fa4, 0xffd23f, 0x3fb6ff, 0x5cff8a, 0xffffff] },
];

export const CATALOGUE: Record<ItemKind, Item[]> = { skin: SKINS, hat: HATS, trail: TRAILS };

/** The look of a skin. `name` is what other players read over your head. */
export function skinLook(id: string, name = 'You'): SnakeLook {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0];
  const look: SnakeLook = { name, body: skin.pattern[0], stripe: skin.pattern[skin.pattern.length - 1], head: skin.head, pattern: skin.pattern };
  if (skin.shimmer) look.shimmer = true;
  return look;
}

export function trailPalette(id: string): number[] {
  return TRAILS.find((t) => t.id === id)?.palette ?? [];
}

/** Stars for a run: a steady trickle for points, plus treats for growing up and for bonking rivals. */
export function starsFor(score: number, highestTier: number, rivalsBonked: number): number {
  return Math.floor(score / 100) + 10 * highestTier + 5 * rivalsBonked;
}
