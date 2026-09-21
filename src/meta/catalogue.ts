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
  price: number;
  icon: string;
}

export interface Skin extends Item {
  kind: 'skin';
  head: number;
  /** Segment colours from the neck back, repeating. */
  pattern: number[];
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
];

export const CATALOGUE: Record<ItemKind, Item[]> = { skin: SKINS, hat: HATS, trail: TRAILS };

/** The look of a skin. `name` is what other players read over your head. */
export function skinLook(id: string, name = 'You'): SnakeLook {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0];
  return { name, body: skin.pattern[0], stripe: skin.pattern[skin.pattern.length - 1], head: skin.head, pattern: skin.pattern };
}

export function trailPalette(id: string): number[] {
  return TRAILS.find((t) => t.id === id)?.palette ?? [];
}

/** Stars for a run: a steady trickle for points, plus treats for growing up and for bonking rivals. */
export function starsFor(score: number, highestTier: number, rivalsBonked: number): number {
  return Math.floor(score / 100) + 10 * highestTier + 5 * rivalsBonked;
}
