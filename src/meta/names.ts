/**
 * Snake names. A child may type their own, or shuffle for a random one. Other children see the
 * name over your head, so everything typed is cleaned first — here and again on the server, which
 * is the one that other players actually see. A perfect filter is impossible; this catches the
 * obvious cases and keeps names short, letters-and-numbers only.
 */

const FIRST_WORDS = [
  'Zippy', 'Bouncy', 'Sparkly', 'Wobbly', 'Snazzy', 'Jolly', 'Fizzy', 'Sunny', 'Minty', 'Rosy', 'Golden', 'Purple',
  'Stripy', 'Spotty', 'Speedy', 'Sneaky', 'Giggly', 'Mighty', 'Tiny', 'Super', 'Turbo', 'Cosmic', 'Rainbow', 'Funky',
  'Sleepy', 'Hungry', 'Lucky', 'Cheeky', 'Brave', 'Dizzy',
] as const;

const SECOND_WORDS = [
  'Noodle', 'Python', 'Adder', 'Cobra', 'Wiggler', 'Slinky', 'Boa', 'Viper', 'Mamba', 'Squiggle', 'Hisser', 'Coil',
  'Sausage', 'Spaghetti', 'Pretzel', 'Worm', 'Dragon', 'Ribbon', 'Zigzag', 'Shoelace', 'Rattler', 'Sidewinder',
] as const;

export const NAME_MAX = 16;

/** Rude words and slurs, matched against the name with spaces and digits stripped out. Small on purpose. */
const BLOCK = [
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'dick', 'cock', 'penis', 'vagina', 'boob', 'tit', 'arse', 'ass',
  'wank', 'piss', 'crap', 'sex', 'nazi', 'hitler', 'nigger', 'nigga', 'faggot', 'fag', 'rape', 'slut', 'whore', 'porn',
];

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export function randomName(): string {
  // Keep it within NAME_MAX so it is never truncated mid-word.
  for (let tries = 0; tries < 40; tries++) {
    const name = `${pick(FIRST_WORDS)}${pick(SECOND_WORDS)}${10 + Math.floor(Math.random() * 90)}`;
    if (name.length <= NAME_MAX) return name;
  }
  return `Snake${10 + Math.floor(Math.random() * 90)}`;
}

/**
 * Tidy a typed name into something safe to show, or null if it is empty or blocked. Letters,
 * numbers and single spaces only; capped in length; rude words rejected.
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number} ]/gu, '')
    .replace(/[^\x20-\x7e]/g, '') // keep it to plain ASCII so nothing exotic slips through
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
  if (name.length < 1) return null;
  const bare = name.toLowerCase().replace(/[^a-z]/g, '');
  if (BLOCK.some((word) => bare.includes(word))) return null;
  return name;
}

export const isCleanName = (name: unknown): name is string => cleanName(name) === name;
