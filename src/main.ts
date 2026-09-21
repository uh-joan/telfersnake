import './style.css';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { Controls } from './input/controls';
import { skinLook, starsFor, trailPalette } from './meta/catalogue';
import { type AudioMode, loadSave, writeSave } from './meta/save';
import { cleanName, randomName } from './meta/names';
import { Connection, type Outfit } from './net/client';
import { AnimalView } from './render/animalView';
import { BeeView } from './render/beeView';
import { CooperView } from './render/cooperView';
import { FoodView } from './render/foodView';
import { makeGround } from './render/ground';
import { HazardView } from './render/hazardView';
import { makeSchool } from './render/school';
import { SnakeView } from './render/snakeView';
import { disposeTree } from './render/paint';
import { Sparkles } from './render/sparkles';
import { Stage } from './render/stage';
import { UpgradeFx } from './render/upgradeFx';
import { TIERS } from './sim/snake';
import { UPGRADES } from './sim/upgrades';
import type { WorldView } from './sim/view';
import { STEP, World } from './sim/world';
import { CardPicker } from './ui/cards';
import { Hud } from './ui/hud';
import { Shop } from './ui/shop';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const MAX_FRAME = 0.1; // seconds; longer gaps (tab switch) are dropped, not simulated
const BANK_EVERY = 2; // seconds between saving the stars earned so far
const TRAIL_EVERY = 0.07;

const save = loadSave();
const stage = new Stage($<HTMLCanvasElement>('game'));
/** The game you play on your own. It is also the backdrop behind the start screen. */
const solo = new World((Date.now() & 0x7fffffff) || 1, skinLook(save.skin, save.name));
/** Whatever is on screen: the solo world, or this phone's copy of a shared playground. */
let world: WorldView = solo;
let connection: Connection | null = null;
const controls = new Controls($('app'), $('stick'), $('dash'));
const hud = new Hud();
let sfx: Sfx | null = null;
let music: Music | null = null;

let snakeViews: SnakeView[] = [];
let foodView = new FoodView(world.foods.length);
let animalView = new AnimalView(world.animals.length);
let hazardView = new HazardView(world.hazards);
const cooperView = new CooperView();
const beeView = new BeeView();
const sparkles = new Sparkles();
const upgradeFx = new UpgradeFx();
const school = makeSchool();
stage.scene.add(makeGround(stage.maxAnisotropy), school.group, cooperView.group, beeView.mesh, upgradeFx.group, sparkles.mesh);

/** Everyone's hat, by seat: yours from the save, other players' as the server tells it. */
function hatFor(id: number): string {
  return connection ? connection.replica.hats[id] : id === world.me ? save.hat : 'no-hat';
}

/** (Re)build snake views: all of them, or just the seats that changed hands or clothes. */
function mountSnakes(only?: ReadonlySet<number>): void {
  world.snakes.forEach((s, id) => {
    const old = snakeViews[id];
    if (old && only && !only.has(id)) return;
    if (old) {
      stage.scene.remove(old.group);
      old.dispose(); // or every outfit change in the room leaks a snake's worth of graphics memory
    }
    snakeViews[id] = new SnakeView(s, hatFor(id));
    stage.scene.add(snakeViews[id].group);
  });
  // Solo has five snakes, a playground six: drop any views left over from the bigger world.
  for (const extra of snakeViews.splice(world.snakes.length)) {
    stage.scene.remove(extra.group);
    extra.dispose();
  }
}

/** Put on whatever the save says, right now: no reload, and in a shared room everyone else sees it too. */
function wearOutfit(): void {
  solo.snake.look = skinLook(save.skin, save.name);
  if (connection) connection.wear(outfit());
  else mountSnakes();
}

/** Point the renderer at a different world: its own rocks, food, animals and snakes. */
function mountWorld(next: WorldView): void {
  for (const old of [hazardView.group, foodView.group, animalView.group]) {
    stage.scene.remove(old);
    disposeTree(old);
  }
  world = next;
  hazardView = new HazardView(world.hazards);
  foodView = new FoodView(world.foods.length);
  animalView = new AnimalView(world.animals.length);
  stage.scene.add(hazardView.group, foodView.group, animalView.group);
  mountSnakes();
}
mountWorld(solo);

const CONFETTI = [0xffd84a, 0xff6b6b, 0x4dabf7, 0x8be36a, 0xffffff];
const DUST = [0x9a9da3, 0x7a7d83, 0xcfd2d6];
const FLAME = [0xff7b00, 0xffb703, 0xffe066, 0xff4d00];
const GOLD = [0xffd84a, 0xfff3b0, 0xffffff];
const EMBERS = [0xff7b00, 0xffb703, 0x6b6f76];
const SKATE_DUST = [0xffffff, 0xe9ecef, 0xced4da];
const LUCKY = [0x69db7c, 0x2f9e44, 0xffd84a];
const BUBBLES = [0xdff3ff, 0xa5d8ff, 0xffffff];

const outfit = (): Outfit => ({ skin: save.skin, hat: save.hat, trail: save.trail, name: save.name });

/** Trail colours by seat: mine from the save, other players' as the server tells it. */
function trailFor(id: number): number[] {
  return trailPalette(connection ? connection.replica.trails[id] : id === world.me ? save.trail : 'no-trail');
}

// ---------------------------------------------------------------- this run

/** What the results screen and the star count are built from. */
const run = { gulps: 0, rivalBonks: 0, longest: 0, banked: 0, over: false };

function earned(): number {
  return starsFor(world.snake.score, world.snake.highestTier, run.rivalBonks);
}

/** Stars go into the save as they are earned, so closing the tab mid-run loses nothing. */
function bank(): void {
  const now = earned();
  const score = world.snake.score;
  const longest = Math.round(run.longest);
  // Writing storage blocks the main thread: only do it when there is something new to keep.
  if (now <= run.banked && score <= save.bestScore && longest <= save.bestLength) return;
  if (now > run.banked) {
    save.stars += now - run.banked;
    run.banked = now;
  }
  save.bestScore = Math.max(save.bestScore, score);
  save.bestLength = Math.max(save.bestLength, longest);
  writeSave(save);
  hud.setStars(run.banked);
}

// ---------------------------------------------------------------- sound

const AUDIO_ICON: Record<AudioMode, string> = { all: '🔊', sfx: '🔈', off: '🔇' };
const AUDIO_NEXT: Record<AudioMode, AudioMode> = { all: 'sfx', sfx: 'off', off: 'all' };

const soundButtons = [...document.querySelectorAll<HTMLElement>('.sound span')];

function applyAudio(): void {
  if (sfx) sfx.enabled = save.audio !== 'off';
  if (music) music.enabled = save.audio === 'all';
  $('mute').textContent = AUDIO_ICON[save.audio];
  for (const b of soundButtons) b.textContent = AUDIO_ICON[save.audio];
}

let audioBroken = false;

/**
 * Audio can only begin from a tap, so every button that might be the first tap calls this.
 * Returns null where the browser has no Web Audio or blocks it: the game then plays silently,
 * and must never fail to start because of it.
 */
function wakeAudio(): Sfx | null {
  if (!sfx && !audioBroken) {
    try {
      sfx = new Sfx();
      music = new Music(sfx);
      applyAudio();
    } catch {
      audioBroken = true;
      sfx = null;
      music = null;
    }
  }
  sfx?.wake();
  return sfx;
}

function cycleAudio(): void {
  save.audio = AUDIO_NEXT[save.audio];
  writeSave(save);
  applyAudio();
  wakeAudio()?.pick();
}

// ---------------------------------------------------------------- screens

type Screen = 'start' | 'pause' | 'results' | 'shop' | 'name' | null;
let screen: Screen = 'start';

function show(next: Screen): void {
  // A tapped button keeps keyboard focus, and Space (the dash key) would then "press" it again
  // from inside the game. Let go of it.
  (document.activeElement as HTMLElement | null)?.blur?.();
  for (const id of ['start', 'pause', 'results', 'name'] as const) $(id).classList.toggle('show', id === next);
  $('app').classList.toggle('menu', next !== null);
  // A shared playground cannot stop for one player, so their snake stands aside, safe, while they are in a menu.
  if (!run.over) connection?.away(next !== null);
  screen = next;
  controls.letGo();
  music?.duck(next !== null);
}

/** Where the Tuck Shop was opened from, to go back there. */
let shopFrom: Screen = 'start';

const shop = new Shop(save, () => sfx, () => {
  if (shop.changed) wearOutfit();
  shop.changed = false;
  show(shopFrom);
});

let countUp = 0;

function openShop(): void {
  if (starting || screen === null || screen === 'shop' || screen === 'name') return;
  shopFrom = screen === 'pause' ? 'pause' : run.over ? 'results' : 'start';
  window.clearInterval(countUp); // no star chimes carrying on behind the shop
  $('r-stars-value').textContent = `+${run.banked}`;
  wakeAudio()?.pick();
  show('shop');
  shop.open();
}

/** When a card was last picked online. The server takes a moment to agree, and must not be asked twice. */
let pickedAt = -Infinity;

const cards = new CardPicker((index) => {
  const card = world.cards?.[index];
  if (connection) {
    connection.pick(index);
    pickedAt = performance.now();
  } else solo.choose(index);
  if (card) hud.toast(UPGRADES[card].icon, UPGRADES[card].name);
  sfx?.pick();
  music?.duck(false);
});

function finishRun(): void {
  if (run.over) return;
  run.over = true;
  cards.hide();
  bank();
  save.runs++;
  writeSave(save);
  sfx?.bell();
  $('r-score').textContent = String(world.snake.score);
  $('r-length').textContent = `${Math.round(run.longest)}m`;
  $('r-gulps').textContent = String(run.gulps);
  $('r-bonks').textContent = String(run.rivalBonks);
  // Back on this phone's own world: the results screen and its Tuck Shop must not talk to a closed line.
  connection?.leave();
  connection = null;
  $('room-pill').classList.remove('show');
  mountWorld(solo);
  show('results');

  // Count the stars up, one chime each (in bigger steps for a big haul).
  const total = run.banked;
  const stepSize = Math.max(1, Math.ceil(total / 30));
  let shown = 0;
  const label = $('r-stars-value');
  label.textContent = '+0';
  window.clearInterval(countUp);
  countUp = window.setInterval(() => {
    shown = Math.min(total, shown + stepSize);
    label.textContent = `+${shown}`;
    if (shown > 0) sfx?.star(Math.round(shown / stepSize));
    if (shown >= total) window.clearInterval(countUp);
  }, 50);
}

// ---------------------------------------------------------------- events from the sim

/** Rivals get the confetti but not the sounds, popups or banners: those are about you. */
function handleEvents(): void {
  for (const e of world.events) {
    const mine = 'who' in e && e.who === world.me;
    switch (e.type) {
      case 'eat':
        snakeViews[e.who].swallow();
        snakeViews[e.who].lick(e.x, e.z);
        if (e.toasted) sparkles.burst(e.x, e.z, FLAME, 6, 0.6);
        if (e.golden) sparkles.burst(e.x, e.z, GOLD, 16, 1.2);
        if (!mine) break;
        hud.popup(`${e.golden ? '🌟 ' : e.toasted ? '🔥 ' : ''}+${e.points}`, e.x, e.z);
        if (e.golden) sfx?.golden();
        else sfx?.eat();
        break;
      case 'gulp':
        snakeViews[e.who].swallow();
        sparkles.burst(e.x, e.z, CONFETTI, 14);
        if (!mine) break;
        run.gulps++;
        hud.popup(`GULP! +${e.points}`, e.x, e.z);
        sfx?.gulp(e.kind);
        break;
      case 'boop':
        if (!mine) break;
        hud.popup('BOING!', e.x, e.z, 'fun');
        sfx?.boing();
        sfx?.voice(e.kind);
        break;
      case 'ouch':
        // A normal bump puffs a little dust; the bump that breaks the piece throws a big cloud.
        sparkles.burst(e.x, e.z, DUST, e.broke ? 22 : 10, e.broke ? 1.2 : 0.7);
        if (e.broke) sfx?.crumble();
        if (!mine) break;
        if (world.snake.rockGuard > 0) {
          // Bubble Wrap took some of it: bubbles everywhere.
          sparkles.burst(world.snake.x, world.snake.z, BUBBLES, 14, 0.9);
          hud.popup(e.lost > 0 ? '🫧 POP!' : '🫧 SAFE!', e.x, e.z, 'fun');
        } else {
          hud.popup(e.lost > 0 ? 'OUCH!' : 'BONK!', e.x, e.z, 'bad');
        }
        sfx?.ouch();
        break;
      case 'pellet':
        snakeViews[e.who].swallow();
        if (!mine) break;
        hud.popup(`+${e.points}`, e.x, e.z);
        sfx?.pellet();
        break;
      case 'tier':
        if (!mine) break;
        hud.announce(`${TIERS[e.tier].name}!`, `😋 ${TIERS[e.tier].gulps}`);
        sparkles.burst(world.snake.x, world.snake.z, CONFETTI, 30, 1.4);
        sfx?.tierUp();
        music?.setLevel(e.tier);
        break;
      case 'cards':
        // Only the fanfare: the card screen itself follows world.cards (see frame), so a level-up
        // that arrives while a menu is open is still offered when the menu closes.
        if (mine) sfx?.levelUp();
        break;
      case 'bonk':
        sparkles.burst(e.x, e.z, CONFETTI, 36, 1.5);
        if (mine) {
          // Show what the bonk cost: the upgrades that just flew off.
          const lost = e.lost.slice(0, 7).map((id) => UPGRADES[id].icon).join('');
          hud.announce('BONKED!', lost ? `${lost} ✖` : '💫');
          $('cards').classList.remove('show');
          sfx?.bonked();
        } else if (e.by === world.me) {
          run.rivalBonks++;
          hud.popup('BONK!', e.x, e.z, 'fun');
          sfx?.bonkedRival();
        }
        break;
      case 'helmet':
        sparkles.burst(e.x, e.z, [0xe03131, 0xffffff], 12, 0.9);
        if (!mine) break;
        hud.popup('⛑️ SAVED!', e.x, e.z, 'fun');
        sfx?.clonk();
        break;
      case 'respawn':
        sparkles.burst(e.x, e.z, CONFETTI, 12, 0.8);
        if (mine) sfx?.respawn();
        break;
      case 'breath':
        upgradeFx.breathe(world.snakes[e.who], e.range);
        sparkles.puff(e.x, e.z, e.heading, e.range, FLAME, 26);
        if (mine) sfx?.whoosh();
        break;
      case 'sneeze':
        sparkles.burst(e.x, e.z, DUST, 8, 0.6);
        if (mine) hud.popup('ACHOO!', e.x, e.z, 'bad');
        break;
      case 'bump':
        if (mine) sfx?.bump();
        break;
      case 'say':
        // Mr Cooper tells people off in a speech bubble only. He had a spoken voice once; it grated.
        hud.say(e.text);
        break;
    }
  }
  world.events.length = 0;
}

// ---------------------------------------------------------------- the loop

let last = performance.now();
let seatsSeen = -1;
let backlog = 0;
let time = 0;
let bankIn = BANK_EVERY;
let trailIn = 0;
let perkFxIn = 0;
let wasDashing = false;
const tail = { x: 0, z: 0 };

function frame(now: number): void {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  time += dt;

  // The world stands still behind every menu, and while the player is choosing a card.
  // A shared playground never stops: there, your own snake just waits while you choose.
  const playing = screen === null && (connection !== null || !world.cards);
  if (connection) {
    const replica = connection.replica;
    if (replica.seatsVersion !== seatsSeen) {
      seatsSeen = replica.seatsVersion;
      mountSnakes(replica.changedSeats); // someone came, went or changed clothes
      replica.changedSeats.clear();
      const players = replica.snakes.filter((o) => !o.isBot).length;
      $('room-code').textContent = String(players);
      $('room-pill').classList.toggle('show', players > 1);
    }
    replica.update(dt, controls.read());
    // The playground has gone quiet for too long: treat it as a lost line (results screen, stars kept).
    if (replica.silentFor > 8) connection.drop();
  }

  // The card screen follows the state, not an event: shown whenever cards are on offer and no
  // other menu is up; taken down when they are gone (picked, timed out, or you were bonked).
  if (world.cards && screen === null && !cards.open && performance.now() - pickedAt > 700) {
    controls.letGo();
    cards.show(world.cards, world.snake);
    music?.duck(true);
  } else if ((!world.cards || screen !== null) && cards.open && performance.now() - pickedAt > 700) {
    cards.hide();
    music?.duck(screen !== null);
  }
  const s = world.snake;
  if (playing) {
    if (!connection) {
      backlog += dt;
      while (backlog >= STEP && !solo.cards) {
        solo.step(controls.read());
        backlog -= STEP;
      }
    }
    run.longest = Math.max(run.longest, s.length);
    if (s.dashing && !wasDashing) {
      sfx?.zip();
      if (!save.dashed) {
        save.dashed = true; // lesson learnt: the button can stop bouncing
        hud.teachDash = false;
        writeSave(save);
      }
    }
    wasDashing = s.dashing;

    if ((bankIn -= dt) <= 0) {
      bankIn = BANK_EVERY;
      bank();
    }
    // Upgrades you own keep showing themselves off, so you can see what you have.
    if (s.alive && (perkFxIn -= dt) <= 0) {
      perkFxIn = 0.12;
      const skates = s.levelOf('skates');
      if (skates > 0 && Math.random() < 0.25 + skates * 0.15) {
        s.sampleAt(s.radius * 2, tail);
        sparkles.drift(tail.x, tail.z, SKATE_DUST);
      }
      if (s.breathLevel > 0 && Math.random() < 0.3) {
        sparkles.drift(s.x + Math.cos(s.heading) * s.radius * 1.4, s.z + Math.sin(s.heading) * s.radius * 1.4, EMBERS);
      }
      if (s.luck > 0 && Math.random() < 0.08 * s.luck) sparkles.drift(s.x, s.z, LUCKY);
    }
    if ((trailIn -= dt) <= 0) {
      trailIn = TRAIL_EVERY;
      for (const o of world.snakes) {
        const palette = trailFor(o.id);
        if (palette.length === 0 || !o.alive) continue;
        o.sampleAt(o.length, tail);
        sparkles.drift(tail.x, tail.z, palette);
      }
    }
  } else {
    backlog = 0;
  }
  // Always: a shared playground carries on behind a menu, and being bonked there must not go unmentioned.
  handleEvents();

  for (const v of snakeViews) v.update(playing ? dt : 0, time);
  foodView.update(world, time);
  animalView.update(world, time);
  hazardView.update(world, time);
  beeView.update(world, time);
  sparkles.update(dt);
  upgradeFx.update(world, playing ? dt : 0, time);
  school.reveal(s.x, s.z, dt);
  cooperView.update(world.cooper, playing ? dt : 0, time);
  stage.follow(s.x, s.z, s.heading, s.radius, dt);
  hud.update(world, stage, dt);
  stage.render();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- buttons

for (const id of ['start', 'pause', 'results', 'name']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());

/**
 * Play always means the shared playground: whoever else is playing is in there, and bots sit in
 * every empty seat. With no connection (or no server) the same game runs on this phone alone.
 */
let starting = false;
$('play').addEventListener('click', async () => {
  if (screen !== 'start' || starting) return;
  starting = true;
  wakeAudio()?.bell();
  const greeting = 'Good morning, everyone. Walking feet, please!';
  $('start').classList.add('busy'); // every button on the start screen is dead until we are in

  try {
    connection = await Connection.join(outfit(), () => {
      // The line dropped mid-game: keep what was earned and call it home time.
      connection = null;
      hud.toast('😴', 'Connection lost');
      finishRun();
    });
    seatsSeen = connection.replica.seatsVersion;
    mountWorld(connection.replica);
  } catch {
    connection = null; // offline: the solo world is already mounted, rivals and all
  }

  $('start').classList.remove('busy');
  starting = false;
  music?.start();
  hud.say(greeting);
  show(null);
});

// ---------------------------------------------------------------- your name (type it, or shuffle)

const nameInput = $<HTMLInputElement>('name-input');

function openName(): void {
  if (screen !== 'start' || starting) return;
  wakeAudio()?.pick();
  nameInput.value = save.name;
  show('name');
  nameInput.focus();
}

/** Take whatever is typed (cleaned), or keep the old name if it was empty or blocked. */
function commitName(): void {
  const cleaned = cleanName(nameInput.value);
  if (cleaned) save.name = cleaned;
  else sfx?.nope();
  $('start-name').textContent = save.name;
  writeSave(save);
  wearOutfit();
  sfx?.pick();
  show('start');
}

$('name-button').addEventListener('click', openName);
$('name-shuffle').addEventListener('click', () => {
  nameInput.value = randomName();
  sfx?.pick();
});
$('name-done').addEventListener('click', commitName);
// Typing must never steer the snake or fire the dash behind the menu.
nameInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); commitName(); }
});
nameInput.addEventListener('keyup', (e) => e.stopPropagation());

// ---------------------------------------------------------------- the rest of the buttons

$('start-shop').addEventListener('click', openShop);
$('results-shop').addEventListener('click', openShop);
$('pause-shop').addEventListener('click', openShop);
$('again').addEventListener('click', () => location.reload());

const pauseButton = $('pause-btn');
pauseButton.addEventListener('pointerdown', (e) => e.stopPropagation());
pauseButton.addEventListener('click', () => {
  if (screen !== null || world.cards) return;
  sfx?.pick();
  show('pause');
});
$('resume').addEventListener('click', () => {
  sfx?.pick();
  show(null);
});
$('finish').addEventListener('click', () => {
  if (screen === 'pause') finishRun();
});

const mute = $('mute');
mute.addEventListener('pointerdown', (e) => e.stopPropagation());
mute.addEventListener('click', cycleAudio);
for (const b of document.querySelectorAll('.sound')) b.addEventListener('click', cycleAudio);

// A menu open in a shared playground: keep telling the server, or after 30 seconds it assumes
// the player has wandered off and sends their snake on its way without them.
window.setInterval(() => {
  if (connection && screen !== null && !run.over) connection.away(true);
}, 8000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!run.over && screen === null) bank();
  } else {
    sfx?.wake();
  }
});

// ---------------------------------------------------------------- start up

$('start-stars').textContent = `⭐${save.stars}`;
$('start-name').textContent = save.name;
$('best-score').textContent = String(save.bestScore);
$('build').textContent = __BUILD__;
hud.teachDash = !save.dashed; // the dash button introduces itself until it has been used once
applyAudio();

if (import.meta.env.DEV) {
  Object.assign(window, { __game: { get world() { return world; }, get connection() { return connection; }, solo, stage, save } });
}

requestAnimationFrame(frame);
