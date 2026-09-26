import { ANIMALS } from '../sim/animals';
import { SCHOOL } from '../sim/layout';
import type { Stage as PlayStage } from '../sim/stage';
import { TIERS } from '../sim/snake';
import { UPGRADES, xpForLevel } from '../sim/upgrades';
import type { WorldView } from '../sim/view';
import type { ScreenPoint, Stage } from '../render/stage';
import { COOPER_HEAD_Y } from '../render/cooperView';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const MAP_SCALE = 2; // minimap px per metre
const POPUP_LIFE = 0.9;
const BUBBLE_LIFE = 2.6;
const HUD_TOP = 96; // px taken by the XP bar and score at the top of the screen

interface Popup {
  el: HTMLElement;
  x: number;
  z: number;
  age: number;
}

/** Score, tier bar, minimap, "+10" popups and Mr Cooper's speech bubble. All plain DOM over the canvas. */
export class Hud {
  private readonly score = $('score-value');
  private readonly tierName = $('tier-name');
  private readonly tierFill = $('tier-fill');
  private readonly tierNext = $('tier-next');
  private readonly starsValue = $('stars-value');
  private readonly count = $('count');
  private readonly dash = $('dash');
  private readonly dashHint = $('dash-hint');
  /** True until the player has dashed once, ever: the button bounces and a bubble says what to do. */
  teachDash = false;
  private shownCount = '';
  private shownXp = -1;
  private mapIn = 0;
  private readonly chip = $('chip');
  private readonly bubble = $('bubble');
  private readonly labels = $('labels');
  private readonly banner = $('banner');
  private readonly bannerTitle = $('banner-title');
  private readonly bannerSub = $('banner-sub');
  private readonly xpFill = $('xp-fill');
  private readonly xpLevel = $('xp-level');
  private readonly tray = $('tray');
  private readonly board = $('board');
  private readonly toastEl = $('toast');
  private readonly tags: HTMLElement[] = [];
  private shownLevel = -1;
  private shownTray = '';
  private shownBoard = '';
  private boardIn = 0;
  private readonly map = $<HTMLCanvasElement>('minimap').getContext('2d')!;
  private stage: PlayStage = SCHOOL;
  private mapBase!: HTMLCanvasElement;
  private readonly popups: Popup[] = [];
  private readonly sp: ScreenPoint = { x: 0, y: 0, visible: false };
  private readonly mapPoint = { x: 0, z: 0 };
  private bubbleAge = BUBBLE_LIFE;
  private bubbleHalf = 0;
  private bubbleTall = 0;
  private shownProgress = -1;
  private shownScore = -1;
  private shownTier = -1;

  constructor() {
    this.setStage(SCHOOL);
  }

  /** Point the minimap at a stage: size it to that stage's bounds and paint its fixed base once. */
  setStage(stage: PlayStage): void {
    this.stage = stage;
    const B = stage.bounds;
    const w = (B.maxX - B.minX) * MAP_SCALE;
    const h = (B.maxZ - B.minZ) * MAP_SCALE;
    this.map.canvas.width = w;
    this.map.canvas.height = h;
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    stage.paintMinimap(base.getContext('2d')!, (x) => (x - B.minX) * MAP_SCALE, (z) => (z - B.minZ) * MAP_SCALE, MAP_SCALE);
    this.mapBase = base;
  }

  /** `tone` picks the colour: good (points), bad (ouch) or fun (boing). */
  popup(text: string, x: number, z: number, tone: 'good' | 'bad' | 'fun' = 'good'): void {
    const el = document.createElement('div');
    el.className = `popup ${tone}`;
    el.textContent = text;
    this.labels.appendChild(el);
    this.popups.push({ el, x, z, age: 0 });
  }

  say(text: string): void {
    this.bubble.textContent = text;
    this.bubbleAge = 0;
    // Measured here, once per line: reading layout every frame forces a reflow every frame.
    this.bubbleHalf = this.bubble.offsetWidth / 2 + 8;
    this.bubbleTall = this.bubble.offsetHeight + 8;
  }

  /** Stars banked so far this run. */
  setStars(stars: number): void {
    this.starsValue.textContent = String(stars);
  }

  /** A brief pill at the bottom of the screen: a big picture and a short name. */
  toast(icon: string, name: string): void {
    const big = document.createElement('span');
    big.textContent = icon;
    this.toastEl.replaceChildren(big, name);
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
  }

  announce(title: string, sub = ''): void {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the CSS animation
    this.banner.classList.add('show');
  }

  update(world: WorldView, stage: Stage, dt: number): void {
    const s = world.snake;

    if (s.score !== this.shownScore) {
      this.shownScore = s.score;
      this.score.textContent = String(s.score);
    }

    const tier = s.tier;
    if (tier !== this.shownTier) {
      this.shownTier = tier;
      this.tierName.textContent = TIERS[tier].name;
      // The carrot at the end of the bar: what the next size up can gulp.
      this.tierNext.textContent = TIERS[tier + 1]?.gulps ?? '👑';
    }
    const next = TIERS[tier + 1];
    const progress = next ? (s.mass - TIERS[tier].mass) / (next.mass - TIERS[tier].mass) : 1;
    const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    if (percent !== this.shownProgress) {
      this.shownProgress = percent;
      this.tierFill.style.width = `${percent}%`;
    }

    this.chip.classList.toggle('show', s.slowed && s.alive);

    // The dash button shows when it cannot work, and introduces itself until it has been used.
    const canDash = s.canDash;
    this.dash.classList.toggle('off', !canDash);
    this.dash.classList.toggle('teach', canDash && this.teachDash);
    this.dashHint.classList.toggle('show', canDash && this.teachDash);

    const xp = Math.round(Math.min(1, s.xp / xpForLevel(s.level)) * 100);
    if (xp !== this.shownXp) {
      this.shownXp = xp;
      this.xpFill.style.width = `${xp}%`;
    }
    if (s.level !== this.shownLevel) {
      this.shownLevel = s.level;
      this.xpLevel.textContent = `Level ${s.level}`;
    }

    // Back in the tank: count the seconds until you pop out again.
    const count = s.alive ? '' : String(Math.max(1, Math.ceil(s.respawnIn)));
    if (count !== this.shownCount) {
      this.shownCount = count;
      this.count.textContent = count;
    }

    // Owned upgrades, in the order they were picked.
    let tray = '';
    for (const [id, level] of s.ownedUpgrades()) tray += `${id}${level},`;
    if (tray !== this.shownTray) {
      this.shownTray = tray;
      this.tray.replaceChildren(
        ...[...s.ownedUpgrades()].map(([id, level]) => {
          const el = document.createElement('span');
          el.className = 'perk';
          el.textContent = UPGRADES[id].icon;
          const n = document.createElement('i');
          n.textContent = String(level);
          el.appendChild(n);
          return el;
        }),
      );
    }

    this.updateBoard(world, dt);
    this.updateTags(world, stage);

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += dt;
      if (p.age >= POPUP_LIFE) {
        p.el.remove();
        this.popups.splice(i, 1);
        continue;
      }
      const t = p.age / POPUP_LIFE;
      stage.project(p.x, 1 + t * 2, p.z, this.sp);
      p.el.style.visibility = this.sp.visible ? 'visible' : 'hidden';
      p.el.style.transform = `translate(${this.sp.x}px, ${this.sp.y}px) translate(-50%, -50%) scale(${1 + 0.3 * Math.sin(t * Math.PI)})`;
      p.el.style.opacity = String(1 - t * t);
    }

    this.bubbleAge += dt;
    // The bubble sits over whoever does the talking here: Mr Cooper at school, Miss Sami on the Common.
    const talker = this.stage.greeters && !this.stage.cooper ? this.stage.greeters.sami : world.cooper;
    stage.project(talker.x, COOPER_HEAD_Y + 0.9, talker.z, this.sp);
    const showBubble = this.bubbleAge < BUBBLE_LIFE && this.sp.visible;
    this.bubble.classList.toggle('show', showBubble);
    if (showBubble) {
      // Keep the whole bubble on screen even when he is at the edge of view.
      const x = Math.min(Math.max(this.sp.x, this.bubbleHalf), stage.width - this.bubbleHalf);
      const y = Math.max(this.sp.y, this.bubbleTall + HUD_TOP); // stay clear of the score and XP bar
      this.bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }

    // The minimap does not need 60 fps.
    if (--this.mapIn <= 0) {
      this.mapIn = 3;
      this.drawMap(world);
    }
  }

  /** Who is longest right now. Refreshed a few times a second; rebuilt only when it changes. */
  private updateBoard(world: WorldView, dt: number): void {
    this.boardIn -= dt;
    if (this.boardIn > 0) return;
    this.boardIn = 0.5;
    const rows = [...world.snakes].sort((a, b) => b.length - a.length);
    const key = rows.map((r) => `${r.id}:${Math.round(r.length)}`).join();
    if (key === this.shownBoard) return;
    this.shownBoard = key;
    // A bar chart, not a table: each snake is a bar in its own colour, as long as it is.
    const longest = Math.max(1, rows[0].length);
    this.board.replaceChildren(
      ...rows.map((r) => {
        const bar = document.createElement('i');
        bar.className = r.id === world.me ? 'me' : '';
        bar.style.background = `#${r.look.body.toString(16).padStart(6, '0')}`;
        bar.style.width = `${Math.max(12, (r.length / longest) * 100)}%`;
        bar.textContent = r.id === world.me ? 'You' : r.look.name;
        return bar;
      }),
    );
  }

  /** Name tags floating over the rivals' heads. */
  private updateTags(world: WorldView, stage: Stage): void {
    for (let id = world.snakes.length; id < this.tags.length; id++) if (this.tags[id]) this.tags[id].style.visibility = 'hidden';
    if (this.tags[world.me]) this.tags[world.me].style.visibility = 'hidden';
    for (const r of world.snakes) {
      if (r.id === world.me) continue;
      let tag = this.tags[r.id];
      if (!tag) {
        tag = this.tags[r.id] = document.createElement('div');
        tag.className = 'tag';
        this.labels.appendChild(tag);
      }
      // A seat changes hands: bots and players come and go.
      if (tag.textContent !== r.look.name) tag.textContent = r.look.name;
      stage.project(r.x, r.radius * 2 + 1.4, r.z, this.sp);
      const show = r.alive && this.sp.visible;
      tag.style.visibility = show ? 'visible' : 'hidden';
      if (show) tag.style.transform = `translate(${this.sp.x}px, ${this.sp.y}px) translate(-50%, -100%)`;
    }
  }

  private drawMap(world: WorldView): void {
    const c = this.map;
    const B = this.stage.bounds;
    const X = (x: number) => (x - B.minX) * MAP_SCALE;
    const Z = (z: number) => (z - B.minZ) * MAP_SCALE;
    c.drawImage(this.mapBase, 0, 0);

    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (const f of world.foods) c.fillRect(X(f.x) - 1, Z(f.z) - 1, 2, 2);

    c.fillStyle = '#33363d';
    for (const h of world.hazards) c.fillRect(X(h.x) - 2, Z(h.z) - 2, 4, 4);

    // Animals: yellow if the snake can gulp them, pink if they would boop it.
    const tier = world.snake.tier;
    for (const a of world.animals) {
      c.fillStyle = tier >= ANIMALS[a.kind].tier ? '#ffe066' : '#ff8fab';
      c.beginPath();
      c.arc(X(a.x), Z(a.z), 2.4, 0, Math.PI * 2);
      c.fill();
    }

    // Predators: red danger dots, a touch bigger for the bear.
    for (const pr of world.predators) {
      c.fillStyle = '#e03131';
      c.beginPath();
      c.arc(X(pr.x), Z(pr.z), pr.kind === 'bear' ? 3.4 : 2.6, 0, Math.PI * 2);
      c.fill();
    }

    // The children: small cheerful cyan dots (distinct from food-yellow and danger-red).
    c.fillStyle = '#3bc9db';
    for (const k of world.kids) {
      c.beginPath();
      c.arc(X(k.x), Z(k.z), 1.6, 0, Math.PI * 2);
      c.fill();
    }

    // Fantastic creatures are hidden — unless Owl Eyes is active, which reveals them as violet stars.
    if (world.snake.hasMagic('owl')) {
      c.fillStyle = '#b197fc';
      for (const cr of world.creatures) {
        if (cr.respawnIn > 0) continue;
        c.beginPath();
        c.arc(X(cr.x), Z(cr.z), 3, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Mr Cooper: navy dot, white hair
    c.fillStyle = '#1f2a44';
    c.beginPath();
    c.arc(X(world.cooper.x), Z(world.cooper.z), 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(X(world.cooper.x), Z(world.cooper.z), 1.8, 0, Math.PI * 2);
    c.fill();

    // Rivals first, then the player on top with a white head.
    const p = this.mapPoint;
    c.lineCap = 'round';
    for (let i = world.snakes.length - 1; i >= 0; i--) {
      const s = world.snakes[i];
      if (!s.alive) continue;
      c.strokeStyle = i === world.me ? '#b6ff5c' : `#${s.look.body.toString(16).padStart(6, '0')}`;
      c.lineWidth = i === world.me ? 3 : 2.5;
      c.beginPath();
      c.moveTo(X(s.x), Z(s.z));
      const length = s.length;
      for (let d = 1; d <= length; d += 1) {
        s.sampleAt(d, p);
        c.lineTo(X(p.x), Z(p.z));
      }
      c.stroke();
      if (i !== world.me) continue;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(X(s.x), Z(s.z), 3, 0, Math.PI * 2);
      c.fill();
    }
  }
}
