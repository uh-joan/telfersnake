import { CATALOGUE, type Item, type ItemKind, type Skin } from '../meta/catalogue';
import { type Save, writeSave } from '../meta/save';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const el = (tag: string, className: string, text = ''): HTMLElement => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

const SLOT: Record<ItemKind, 'skin' | 'hat' | 'trail'> = { skin: 'skin', hat: 'hat', trail: 'trail' };

export interface ShopSounds {
  pick(): void;
  chaChing(): void;
  nope(): void;
}

/**
 * The Tuck Shop. Stars earned by playing buy skins, hats and trails; there is no real money
 * anywhere. Tap a tile to pick it, then the big button to buy or wear it, so a stray tap never
 * spends anything.
 */
export class Shop {
  private readonly root = $('shop');
  private readonly grid = $('shop-grid');
  private readonly stars = $('shop-stars-value');
  private readonly gems = $('shop-gems-value');
  private readonly buy = $('shop-buy');
  private readonly tabs = [...document.querySelectorAll<HTMLElement>('#shop-tabs button')];
  private kind: ItemKind = 'skin';
  private picked: Item | null = null;
  /** True once anything worn has changed, so the caller knows to rebuild the snake. */
  changed = false;

  constructor(private readonly save: Save, private readonly sounds: () => ShopSounds | null, private readonly onClose: () => void) {
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    for (const tab of this.tabs) {
      tab.addEventListener('click', () => {
        this.kind = tab.dataset.kind as ItemKind;
        this.picked = null;
        this.sounds()?.pick();
        this.render();
      });
    }
    $('shop-close').addEventListener('click', () => {
      this.root.classList.remove('show');
      this.onClose();
    });
    this.buy.addEventListener('click', () => this.act());
  }

  open(): void {
    this.picked = null;
    this.render();
    this.root.classList.add('show');
  }

  private owns(item: Item): boolean {
    return item.price === 0 || this.save.owned.includes(item.id);
  }

  private wearing(item: Item): boolean {
    return this.save[SLOT[item.kind]] === item.id;
  }

  private render(): void {
    this.stars.textContent = String(this.save.stars);
    this.gems.textContent = String(this.save.gems);
    for (const tab of this.tabs) tab.classList.toggle('on', tab.dataset.kind === this.kind);

    this.grid.replaceChildren(
      ...[...CATALOGUE[this.kind]].sort((a, b) => a.price - b.price).map((item) => {
        const owned = this.owns(item);
        const tile = el('button', `item${owned ? '' : ' locked'}${this.wearing(item) ? ' wearing' : ''}${this.picked === item ? ' picked' : ''}`);
        tile.append(item.kind === 'skin' ? this.miniSnake(item as Skin) : el('div', 'item-icon', item.icon));
        tile.append(el('div', 'item-name', item.name));
        if (!owned) tile.append(el('div', 'price', `⭐ ${item.price}`));
        tile.addEventListener('click', () => {
          this.picked = item;
          this.sounds()?.pick();
          this.render();
        });
        return tile;
      }),
    );

    // The one action button: wear it, buy it, or show how many more stars it needs.
    const item = this.picked;
    this.buy.classList.toggle('show', !!item && !this.wearing(item));
    if (!item) return;
    const short = item.price - this.save.stars;
    this.buy.classList.toggle('poor', !this.owns(item) && short > 0);
    this.buy.textContent = this.owns(item) ? '✔ Wear it' : short > 0 ? `⭐ ${short} more` : `Buy  ⭐ ${item.price}`;
  }

  /** A skin drawn as a tiny snake: a head and a run of body beads in its colours. */
  private miniSnake(skin: Skin): HTMLElement {
    const snake = el('div', 'mini-snake');
    const head = el('i', 'head');
    head.style.background = hex(skin.head);
    snake.append(head);
    for (let i = 0; i < 6; i++) {
      const bead = el('i', '');
      bead.style.background = hex(skin.pattern[i % skin.pattern.length]);
      snake.append(bead);
    }
    return snake;
  }

  private act(): void {
    const item = this.picked;
    if (!item) return;
    if (!this.owns(item)) {
      if (this.save.stars < item.price) {
        this.sounds()?.nope();
        const tile = this.grid.querySelector('.picked');
        tile?.classList.remove('shake');
        void (tile as HTMLElement | null)?.offsetWidth;
        tile?.classList.add('shake');
        return;
      }
      this.save.stars -= item.price;
      this.save.owned.push(item.id);
      this.sounds()?.chaChing();
    } else {
      this.sounds()?.pick();
    }
    this.save[SLOT[item.kind]] = item.id;
    this.changed = true;
    writeSave(this.save);
    this.render();
  }
}
