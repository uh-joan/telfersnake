import type { Snake } from '../sim/snake';
import { type CardId, UPGRADES } from '../sim/upgrades';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/** Taps landing sooner than this after the cards appear are ignored: the thumb was still steering. */
const ARM_AFTER_MS = 450;

const el = (tag: string, className: string, text = ''): HTMLElement => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

/**
 * The "pick one of three" screen shown on every level-up; the game is paused behind it.
 * Each card is a big picture, the upgrade's name, a pictogram of what it does and level pips.
 * No sentences: the players are young. The sentence version is the card's aria-label.
 */
export class CardPicker {
  private readonly root = $('cards');
  private readonly title = $('cards-title');
  private readonly row = $('cards-row');
  private shownAt = 0;

  constructor(private readonly onPick: (index: number) => void) {
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get open(): boolean {
    return this.root.classList.contains('show');
  }

  hide(): void {
    this.root.classList.remove('show');
  }

  show(cards: CardId[], snake: Snake): void {
    this.title.textContent = String(snake.level);
    this.row.replaceChildren(
      ...cards.map((id, index) => {
        const def = UPGRADES[id];
        const owned = id === 'snack' ? 0 : snake.levelOf(id);

        const card = el('button', `card ${def.rarity}`);
        card.setAttribute('aria-label', `${def.name}: ${def.blurb(owned + 1)}`);
        card.append(el('div', 'card-icon', def.icon), el('div', 'card-name', def.name), el('div', 'card-hint', def.hint));

        // One pip per level: green for owned, a glowing yellow one for the level on offer.
        if (Number.isFinite(def.max)) {
          const pips = el('div', 'pips');
          for (let i = 0; i < def.max; i++) pips.append(el('i', i < owned ? 'on' : i === owned ? 'new' : ''));
          card.append(pips);
        }

        card.addEventListener('click', () => {
          if (performance.now() - this.shownAt < ARM_AFTER_MS) return;
          this.root.classList.remove('show');
          this.onPick(index);
        });
        return card;
      }),
    );
    this.shownAt = performance.now();
    this.root.classList.add('show');
  }
}
