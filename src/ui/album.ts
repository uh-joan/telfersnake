import { track } from '../meta/analytics';
import { SKINS } from '../meta/catalogue';
import { ALL_CARDS, LANDMARK_CARDS, type Postcard, RARE_CARDS } from '../meta/postcards';
import { refreshSave, type Save } from '../meta/save';
import { CARD_H, CARD_W, paintPostcard, type Photobomber, releasePostcardRenderer } from '../render/postcardArt';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export interface AlbumSounds {
  pick(): void;
}

/**
 * The Postcard Album: London's postcards pinned up on a corkboard, the landmarks first, then the rare
 * ones. A card not found yet is a grey silhouette. Tap (or Enter on) a card to see it big: it flips
 * over from its back. Every card is a button with a short label for screen readers.
 */
export class Album {
  private readonly root = $('album');
  private readonly board = $('album-board');
  private readonly count = $('album-count');
  private readonly zoom = $('postcard-zoom');
  private readonly zoomCard = $('postcard-zoom-card');
  private readonly zoomClose = $('postcard-zoom-close');
  private painting = 0;
  /** The card that opened the big view, to give focus back to. */
  private opener: HTMLElement | null = null;

  constructor(private readonly save: Save, private readonly sounds: () => AlbumSounds | null, private readonly onClose: () => void) {
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.zoom.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('album-close').addEventListener('click', () => this.close());
    this.zoom.addEventListener('click', () => this.unzoom());
    this.zoomClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.unzoom();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.key !== 'Escape') return;
      e.stopPropagation();
      if (this.zoom.classList.contains('show')) this.unzoom();
      else this.close();
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('show');
  }

  open(): void {
    refreshSave(this.save); // cards another tab (or the HD build) kept since this one loaded
    const have = new Set(this.save.postcards);
    const found = ALL_CARDS.filter((c) => have.has(c.id)).length;
    this.count.textContent = `${found}/${ALL_CARDS.length}`;
    this.count.setAttribute('aria-label', `${found} of ${ALL_CARDS.length} postcards`);
    track('album', { n: found });

    const skin = SKINS.find((s) => s.id === this.save.skin) ?? SKINS[0];
    const who: Photobomber = { head: skin.head, pattern: skin.pattern };
    const got = (id: string) => have.has(id);

    // Blank cards straight away; the pictures are painted in a few at a time, in short slices.
    const tiles: [Postcard, HTMLCanvasElement][] = [];
    const tile = (card: Postcard, i: number) => {
      const owned = have.has(card.id);
      const button = document.createElement('button');
      button.className = `postcard${owned ? '' : ' missing'}${card.rare ? ' rare' : ''}`;
      button.style.setProperty('--tilt', `${[-3, 2, -1.5, 3, -2.5, 1.5][i % 6]}deg`);
      button.setAttribute('aria-label', owned ? `${card.name} postcard` : card.rare ? 'Secret postcard' : 'Postcard to find');
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      button.append(canvas);
      button.addEventListener('click', () => this.zoomIn(canvas, card, owned, button));
      tiles.push([card, canvas]);
      return button;
    };
    const star = document.createElement('div');
    star.className = 'album-divider';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '⭐ ⭐ ⭐';
    this.board.replaceChildren(...LANDMARK_CARDS.map(tile), star, ...RARE_CARDS.map((c, i) => tile(c, i + 1)));

    this.root.classList.add('show');
    this.root.setAttribute('aria-hidden', 'false');
    (this.board.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true });

    const run = ++this.painting;
    let next = 0;
    const paintSome = () => {
      if (run !== this.painting) return; // closed (or reopened): stop this round
      // As many cards as fit in a slice of a frame, so a slow phone still scrolls smoothly.
      const until = performance.now() + 12;
      do {
        const item = tiles[next++];
        if (!item) {
          releasePostcardRenderer();
          return;
        }
        const [card, canvas] = item;
        const c = canvas.getContext('2d');
        if (c) paintPostcard(c, card, have.has(card.id), who, got);
      } while (performance.now() < until);
      window.setTimeout(paintSome, 0); // yield, so taps and scrolling stay quick between slices
    };
    window.setTimeout(paintSome, 0);
  }

  private close(): void {
    this.painting++;
    releasePostcardRenderer();
    this.unzoom();
    this.board.replaceChildren(); // let the painted canvases go
    this.zoomCard.replaceChildren();
    this.root.classList.remove('show');
    this.root.setAttribute('aria-hidden', 'true');
    this.sounds()?.pick();
    this.onClose();
  }

  /** Show one card big: it flips over from its back (stamp and lines) to the picture. */
  private zoomIn(canvas: HTMLCanvasElement, card: Postcard, owned: boolean, opener: HTMLElement): void {
    this.sounds()?.pick();
    this.opener = opener;
    const big = document.createElement('canvas');
    big.width = CARD_W;
    big.height = CARD_H;
    big.getContext('2d')?.drawImage(canvas, 0, 0);
    big.className = 'front';
    const back = document.createElement('div');
    back.className = 'back';
    back.innerHTML = '<i class="back-stamp">👑</i><i class="back-line"></i><i class="back-line"></i><i class="back-line"></i>';
    this.zoomCard.replaceChildren(back, big);
    this.zoomCard.classList.toggle('missing', !owned);
    this.zoom.setAttribute('aria-label', owned ? `${card.name} postcard` : 'Postcard to find');
    this.zoom.classList.remove('show');
    void this.zoom.offsetWidth; // restart the flip
    this.zoom.classList.add('show');
    this.zoomClose.focus({ preventScroll: true });
  }

  private unzoom(): void {
    if (!this.zoom.classList.contains('show')) return;
    this.zoom.classList.remove('show');
    this.opener?.focus({ preventScroll: true });
    this.opener = null;
  }
}
