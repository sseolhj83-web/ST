import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Swords, UserRound } from 'lucide-react';
import { HeroCharacter } from '../game/types';
import { rasterizeDrawing } from '../game/drawing';
import {
  CAMERA_ARENAS,
  ENEMY_SPAWNS,
  ENEMY_STATS,
  GATES,
  GROUND_Y,
  OBSTACLES,
  PLATFORMS,
  SECTION_MARKERS,
  STAGE_SECTIONS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_WIDTH,
  sectionAt,
  type EnemyKind,
  type Obstacle,
  type StageSection,
} from '../game/stage';

const CAMERA_SMOOTH = 7;
const CAMERA_DEAD_ZONE = 0.35;
const CAMERA_MAX_SPEED = 1100;
const SOLIDS = [...PLATFORMS, ...OBSTACLES];

const GRAVITY = 2100;
const MAX_FALL = 900;
const MOVE_SPEED = 280;
const JUMP_SPEED = 780;
const PLAYER_W = 42;
const PLAYER_H = 58;
const MAX_HP = 100;
const SKILL_DAMAGE = 16;
const BASIC_DAMAGE = 9;

interface Enemy {
  id: number;
  kind: EnemyKind;
  zone: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  patrolMin: number;
  patrolMax: number;
  dir: number;
  cooldown: number;
  aggro: boolean;
  flash: number;
  alive: boolean;
}

interface Projectile {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  fromPlayer: boolean;
  skill: boolean;
  angle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
}

interface Pickup {
  x: number;
  y: number;
  life: number;
  bob: number;
}

interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  onGround: boolean;
  facing: number;
  invuln: number;
  flash: number;
  attackCd: number;
  coyote: number;
}

interface GameState {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  pickups: Pickup[];
  cameraX: number;
  time: number;
  kills: number;
  status: 'PLAY' | 'CLEAR' | 'GAMEOVER';
  damageFlash: number;
  shake: number;
  notice: string;
  noticeTimer: number;
  gateOpened: boolean[];
}

interface Input {
  left: boolean;
  right: boolean;
  jumpQueued: boolean;
  attackQueued: boolean;
}

interface Hud {
  hp: number;
  kills: number;
  time: number;
  zone: number;
  sectionName: string;
  objective: string;
  notice: string;
  damageFlash: number;
  status: GameState['status'];
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  attackReady: boolean;
}

interface Assets {
  hero: HTMLCanvasElement | null;
  skill: HTMLCanvasElement | null;
  role: HeroCharacter['role'];
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function zoneCleared(state: GameState, zone: number) {
  return state.enemies
    .filter((e) => e.zone === zone)
    .every((e) => !e.alive);
}

function gateOpen(state: GameState, zone: number) {
  return zoneCleared(state, zone);
}

function activeZone(state: GameState) {
  if (!zoneCleared(state, 1)) return 1;
  if (!zoneCleared(state, 2)) return 2;
  return 3;
}

/** 플레이어를 화면 중앙에 두되 보스 전장에서는 카메라를 고정한다. */
function cameraTargetFor(playerCenterX: number) {
  const arena = CAMERA_ARENAS.find(
    (entry) => playerCenterX >= entry.from && playerCenterX <= entry.to,
  );
  const desired = arena ? arena.cameraX : playerCenterX - VIEW_WIDTH / 2;
  return clamp(desired, 0, WORLD_WIDTH - VIEW_WIDTH);
}

function createState(): GameState {
  return {
    player: {
      x: 90,
      y: GROUND_Y - PLAYER_H,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      hp: MAX_HP,
      onGround: true,
      facing: 1,
      invuln: 0,
      flash: 0,
      attackCd: 0,
      coyote: 0,
    },
    enemies: ENEMY_SPAWNS.map((spawn) => {
      const stats = ENEMY_STATS[spawn.kind];
      return {
        id: spawn.id,
        kind: spawn.kind,
        zone: spawn.zone,
        x: spawn.x,
        y: spawn.y,
        w: stats.w,
        h: stats.h,
        hp: stats.hp,
        maxHp: stats.hp,
        patrolMin: spawn.patrolMin,
        patrolMax: spawn.patrolMax,
        dir: -1,
        cooldown: 0.6 + spawn.id * 0.07,
        aggro: false,
        flash: 0,
        alive: true,
      };
    }),
    projectiles: [],
    particles: [],
    pickups: [],
    cameraX: 0,
    time: 0,
    kills: 0,
    status: 'PLAY',
    damageFlash: 0,
    shake: 0,
    notice: '빌런을 쓰러뜨리고 오른쪽으로 진행하세요!',
    noticeTimer: 4,
    gateOpened: GATES.map(() => false),
  };
}

function burst(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 180,
) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const power = speed * (0.5 + Math.random() * 0.7);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: 0.45 + Math.random() * 0.35,
      maxLife: 0.8,
      size: 3 + Math.random() * 4,
      color,
    });
  }
}

function floatText(state: GameState, x: number, y: number, text: string, color: string) {
  state.particles.push({
    x,
    y,
    vx: 0,
    vy: -70,
    life: 0.8,
    maxLife: 0.8,
    size: 0,
    color,
    text,
  });
}

function damagePlayer(state: GameState, amount: number, sourceX: number) {
  const p = state.player;
  if (p.invuln > 0 || state.status !== 'PLAY') return;
  p.hp = Math.max(0, p.hp - amount);
  p.invuln = 1.1;
  p.flash = 0.25;
  state.damageFlash = 0.55;
  state.shake = 6;
  p.vx = (p.x + p.w / 2 < sourceX ? -1 : 1) * 210;
  p.vy = -280;
  p.onGround = false;
  burst(state, p.x + p.w / 2, p.y + p.h / 2, '#f87171', 12, 220);
  floatText(state, p.x + p.w / 2, p.y - 10, `-${amount}`, '#fca5a5');
  if (p.hp <= 0) state.status = 'GAMEOVER';
}

function killEnemy(state: GameState, enemy: Enemy) {
  enemy.alive = false;
  state.kills += 1;
  state.shake = enemy.kind === 'GRUNT' ? 3 : 8;
  burst(
    state,
    enemy.x + enemy.w / 2,
    enemy.y + enemy.h / 2,
    enemy.kind === 'BOSS' ? '#fbbf24' : '#c4b5fd',
    enemy.kind === 'BOSS' ? 40 : 18,
    enemy.kind === 'BOSS' ? 320 : 210,
  );
  if (enemy.kind !== 'GRUNT' || Math.random() < 0.5) {
    state.pickups.push({
      x: enemy.x + enemy.w / 2,
      y: GROUND_Y - 38,
      life: 12,
      bob: 0,
    });
  }
  if (enemy.kind === 'BOSS') {
    state.notice = '최종 보스 쓰러뜨림! 스테이지 클리어!';
    state.noticeTimer = 3;
  }
}

function firePlayerShot(state: GameState, assets: Assets) {
  const p = state.player;
  const hasSkill = !!assets.skill;
  const size = hasSkill ? 52 : 26;
  state.projectiles.push({
    x: p.x + p.w / 2 + p.facing * 26 - size / 2,
    y: p.y + p.h * 0.42 - size / 2,
    w: size,
    h: size,
    vx: p.facing * (hasSkill ? 540 : 480),
    vy: 0,
    life: 1.8,
    damage: hasSkill ? SKILL_DAMAGE : BASIC_DAMAGE,
    fromPlayer: true,
    skill: hasSkill,
    angle: 0,
  });
  burst(state, p.x + p.w / 2 + p.facing * 28, p.y + p.h * 0.42, '#67e8f9', 6, 110);
}

function fireEnemyShot(state: GameState, enemy: Enemy) {
  const stats = ENEMY_STATS[enemy.kind];
  const cx = enemy.x + enemy.w / 2;
  const cy = enemy.y + enemy.h * 0.45;
  const dx = state.player.x + state.player.w / 2 - cx;
  const dy = state.player.y + state.player.h / 2 - cy;
  const base = Math.atan2(dy, dx);
  const enraged = enemy.kind === 'BOSS' && enemy.hp < enemy.maxHp / 2;
  const count = enemy.kind === 'BOSS' ? (enraged ? 5 : 3) : enemy.kind === 'MID' ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * 0.19;
    state.projectiles.push({
      x: cx - 9,
      y: cy - 9,
      w: 18,
      h: 18,
      vx: Math.cos(angle) * stats.shotSpeed * (enraged ? 1.18 : 1),
      vy: Math.sin(angle) * stats.shotSpeed * (enraged ? 1.18 : 1),
      life: 2.4,
      damage: stats.damage,
      fromPlayer: false,
      skill: false,
      angle,
    });
  }
}

function update(state: GameState, input: Input, dt: number, assets: Assets) {
  if (state.status !== 'PLAY') return;
  state.time += dt;
  state.damageFlash = Math.max(0, state.damageFlash - dt * 1.8);
  state.shake = Math.max(0, state.shake - dt * 30);
  state.noticeTimer = Math.max(0, state.noticeTimer - dt);

  const p = state.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.flash = Math.max(0, p.flash - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    p.vx += (dir * MOVE_SPEED - p.vx) * Math.min(1, dt * 14);
    p.facing = dir;
  } else {
    p.vx *= Math.max(0, 1 - dt * 12);
  }

  if (input.jumpQueued && (p.onGround || p.coyote > 0)) {
    p.vy = -JUMP_SPEED;
    p.onGround = false;
    p.coyote = 0;
    burst(state, p.x + p.w / 2, p.y + p.h, '#cbd5e1', 8, 90);
  }
  input.jumpQueued = false;

  if (input.attackQueued && p.attackCd <= 0) {
    firePlayerShot(state, assets);
    p.attackCd = 0.34;
  }
  input.attackQueued = false;

  p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
  const prevX = p.x;
  const prevBottom = p.y + p.h;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 0, WORLD_WIDTH - p.w);

  for (const gate of GATES) {
    if (
      !gateOpen(state, gate.zone) &&
      prevX + p.w <= gate.x &&
      p.x + p.w > gate.x
    ) {
      p.x = gate.x - p.w;
      p.vx = 0;
      if (state.noticeTimer <= 0) {
        state.notice = `${gate.label}의 적을 모두 처치해야 통과할 수 있습니다`;
        state.noticeTimer = 1.8;
      }
    }
  }

  p.onGround = false;
  let landedOn: (typeof SOLIDS)[number] | null = null;
  if (p.vy >= 0) {
    for (const solid of SOLIDS) {
      if (
        p.x + p.w > solid.x &&
        p.x < solid.x + solid.w &&
        prevBottom <= solid.y + 2 &&
        p.y + p.h >= solid.y
      ) {
        p.y = solid.y - p.h;
        p.vy = 0;
        p.onGround = true;
        landedOn = solid;
        break;
      }
    }
  }
  // 장애물 옆면도 월드 좌표로 판정한다. 카메라가 움직여도 판정은 흔들리지 않는다.
  // 바닥에 서 있는 경우도 있으므로 "그 장애물 위에 착지한 경우"만 제외한다.
  for (const solid of OBSTACLES) {
    if (landedOn === solid || !overlap(p, solid)) continue;
    if (prevX + p.w <= solid.x + 2) {
      p.x = solid.x - p.w;
      p.vx = 0;
    } else if (prevX >= solid.x + solid.w - 2) {
      p.x = solid.x + solid.w;
      p.vx = 0;
    }
  }
  if (p.onGround) p.coyote = 0.1;
  else p.coyote = Math.max(0, p.coyote - dt);

  if (p.y > VIEW_HEIGHT + 60) {
    damagePlayer(state, 16, p.x + p.w / 2 + 1);
    p.hp = Math.max(1, p.hp); // 낙하 자체는 즉사하지 않는다
    p.invuln = 1.2;
    const checkpoint = !zoneCleared(state, 1) ? 90 : !zoneCleared(state, 2) ? 1560 : 3080;
    p.x = checkpoint;
    p.y = GROUND_Y - p.h;
    p.vx = 0;
    p.vy = 0;
    state.notice = '떨어졌습니다! 체력이 감소했습니다';
    state.noticeTimer = 2;
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const stats = ENEMY_STATS[enemy.kind];
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.cooldown -= dt;
    const dx = p.x + p.w / 2 - (enemy.x + enemy.w / 2);
    const dy = p.y - enemy.y;
    if (Math.abs(dx) < stats.range && Math.abs(dy) < 170) enemy.aggro = true;

    if (enemy.aggro) {
      enemy.dir = dx >= 0 ? 1 : -1;
      const move = Math.abs(dx) > 120 ? enemy.dir * stats.speed : 0;
      enemy.x = clamp(
        enemy.x + move * dt,
        enemy.patrolMin - 40,
        enemy.patrolMax + 40,
      );
      if (enemy.cooldown <= 0) {
        fireEnemyShot(state, enemy);
        const enraged = enemy.kind === 'BOSS' && enemy.hp < enemy.maxHp / 2;
        enemy.cooldown = stats.cooldown * (enraged ? 0.68 : 1);
      }
    } else {
      enemy.x += enemy.dir * stats.speed * 0.55 * dt;
      if (enemy.x <= enemy.patrolMin) {
        enemy.x = enemy.patrolMin;
        enemy.dir = 1;
      } else if (enemy.x >= enemy.patrolMax) {
        enemy.x = enemy.patrolMax;
        enemy.dir = -1;
      }
    }
    enemy.y =
      GROUND_Y - enemy.h + (enemy.kind === 'BOSS' ? Math.sin(state.time * 2.2) * 7 : 0);

    if (overlap(p, enemy)) damagePlayer(state, stats.damage, enemy.x + enemy.w / 2);
  }

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const shot = state.projectiles[i];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    shot.angle += dt * 9;

    if (shot.fromPlayer) {
      for (const enemy of state.enemies) {
        if (!enemy.alive || !overlap(shot, enemy)) continue;
        enemy.hp -= shot.damage;
        enemy.flash = 0.18;
        enemy.aggro = true;
        floatText(state, enemy.x + enemy.w / 2, enemy.y - 6, `-${shot.damage}`, '#fde68a');
        burst(state, shot.x + shot.w / 2, shot.y + shot.h / 2, '#a5f3fc', 8, 150);
        shot.life = 0;
        if (enemy.hp <= 0) killEnemy(state, enemy);
        break;
      }
    } else if (overlap(shot, p)) {
      damagePlayer(state, shot.damage, shot.x);
      shot.life = 0;
    }

    if (!shot.fromPlayer && shot.y + shot.h > GROUND_Y && shot.y < GROUND_Y + 20) {
      burst(state, shot.x, GROUND_Y - 4, '#fb923c', 5, 80);
      shot.life = 0;
    }
    if (
      shot.life <= 0 ||
      shot.x < -80 ||
      shot.x > WORLD_WIDTH + 80 ||
      shot.y > VIEW_HEIGHT + 100
    ) {
      state.projectiles.splice(i, 1);
    }
  }

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const item = state.pickups[i];
    item.life -= dt;
    item.bob += dt * 4;
    if (overlap(p, { x: item.x - 13, y: item.y - 13, w: 26, h: 26 })) {
      p.hp = Math.min(MAX_HP, p.hp + 20);
      floatText(state, item.x, item.y - 12, '+20 HP', '#86efac');
      burst(state, item.x, item.y, '#4ade80', 10, 120);
      state.pickups.splice(i, 1);
    } else if (item.life <= 0) {
      state.pickups.splice(i, 1);
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const particle = state.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += (particle.text ? -30 : 620) * dt;
    if (particle.life <= 0) state.particles.splice(i, 1);
  }

  GATES.forEach((gate, index) => {
    if (gateOpen(state, gate.zone) && !state.gateOpened[index]) {
      state.gateOpened[index] = true;
      state.notice = `${gate.label} 통과! 다음 구역으로 이동하세요`;
      state.noticeTimer = 2.4;
    }
  });

  // 프레임 속도와 무관한 지수 감쇠 + 데드존으로 부드럽게 따라가고, 멈추면 딱 멈춘다.
  const desiredCamera = cameraTargetFor(p.x + p.w / 2);
  const cameraDelta = desiredCamera - state.cameraX;
  if (Math.abs(cameraDelta) > CAMERA_DEAD_ZONE) {
    const step = cameraDelta * (1 - Math.exp(-dt * CAMERA_SMOOTH));
    state.cameraX = clamp(
      state.cameraX + clamp(step, -CAMERA_MAX_SPEED * dt, CAMERA_MAX_SPEED * dt),
      0,
      WORLD_WIDTH - VIEW_WIDTH,
    );
  } else {
    state.cameraX = desiredCamera;
  }

  const finalBoss = state.enemies.find((e) => e.kind === 'BOSS');
  if (finalBoss && !finalBoss.alive) state.status = 'CLEAR';
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(-28, 6, 30, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(30, 5, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function lerpHex(a: string, b: string, t: number) {
  const from = parseInt(a.slice(1), 16);
  const to = parseInt(b.slice(1), 16);
  const mix = (shift: number) =>
    Math.round(((from >> shift) & 255) * (1 - t) + ((to >> shift) & 255) * t);
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`;
}

/** 구역을 지날 때 하늘 색이 급격히 바뀌지 않도록 서서히 보간한다. */
function skyAt(cameraX: number): StageSection {
  const centers = STAGE_SECTIONS.map((section) => (section.from + section.to) / 2);
  const x = cameraX + VIEW_WIDTH / 2;
  let index = 0;
  while (index < centers.length - 1 && x > centers[index + 1]) index += 1;
  const current = STAGE_SECTIONS[index];
  const next = STAGE_SECTIONS[index + 1];
  if (!next) return current;
  const t = clamp((x - centers[index]) / (centers[index + 1] - centers[index]), 0, 1);
  return {
    ...current,
    skyTop: lerpHex(current.skyTop, next.skyTop, t),
    skyBottom: lerpHex(current.skyBottom, next.skyBottom, t),
  };
}

function hash01(n: number) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** 타일 인덱스로 패턴을 정해 화면 양 끝에서 끊김 없이 반복되게 한다. */
function drawParallax(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  parallax: number,
  tileWidth: number,
  patternTiles: number,
  drawTile: (ctx: CanvasRenderingContext2D, x: number, pattern: number) => void,
) {
  const offset = cameraX * parallax;
  const first = Math.floor(offset / tileWidth) - 1;
  const last = Math.ceil((offset + VIEW_WIDTH) / tileWidth) + 1;
  for (let i = first; i <= last; i += 1) {
    const pattern = ((i % patternTiles) + patternTiles) % patternTiles;
    drawTile(ctx, i * tileWidth - offset, pattern);
  }
}

function drawCloudTile(ctx: CanvasRenderingContext2D, x: number, pattern: number) {
  drawCloud(
    ctx,
    x + 52 + hash01(pattern + 7) * 34,
    62 + (pattern % 3) * 44,
    0.65 + hash01(pattern + 2) * 0.4,
  );
  ctx.save();
  ctx.globalAlpha = 0.6;
  drawCloud(ctx, x + 200, 96 + ((pattern + 1) % 3) * 38, 0.5);
  ctx.restore();
}

function drawFarSkylineTile(ctx: CanvasRenderingContext2D, x: number, pattern: number) {
  const h1 = 78 + hash01(pattern * 3 + 1) * 66;
  const h2 = 58 + hash01(pattern * 3 + 2) * 84;
  ctx.save();
  ctx.fillStyle = 'rgba(24,22,52,0.9)';
  ctx.fillRect(x + 8, 340 - h1, 96, h1 + 200);
  ctx.fillRect(x + 118, 340 - h2, 88, h2 + 200);
  ctx.fillStyle = 'rgba(148,163,184,0.12)';
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (hash01(pattern * 19 + r * 5 + c) > 0.58) {
        ctx.fillRect(x + 20 + c * 27, 340 - h1 + 14 + r * 24, 9, 9);
      }
    }
  }
  ctx.restore();
}

function drawMidBuildingTile(ctx: CanvasRenderingContext2D, x: number, pattern: number) {
  const h = 108 + hash01(pattern * 5 + 11) * 84;
  const top = 404 - h;
  ctx.save();
  ctx.fillStyle = '#2d2444';
  ctx.beginPath();
  ctx.moveTo(x + 26, 404);
  ctx.lineTo(x + 26, top + 16);
  ctx.lineTo(x + 66, top);
  ctx.lineTo(x + 112, top + 12);
  ctx.lineTo(x + 148, top + 30);
  ctx.lineTo(x + 148, 404);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,113,133,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 66, top);
  ctx.lineTo(x + 70, top - 22);
  ctx.moveTo(x + 112, top + 12);
  ctx.lineTo(x + 116, top - 14);
  ctx.stroke();
  ctx.fillStyle = 'rgba(251,191,36,0.3)';
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 2; c += 1) {
      if (hash01(pattern * 13 + r * 3 + c) > 0.42) {
        ctx.fillRect(x + 42 + c * 46, top + 26 + r * 30, 15, 12);
      }
    }
  }
  const tx = x + 214;
  ctx.strokeStyle = '#241c38';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx, 404);
  ctx.lineTo(tx - 5, 340);
  ctx.moveTo(tx - 4, 364);
  ctx.lineTo(tx - 30, 340);
  ctx.moveTo(tx - 2, 354);
  ctx.lineTo(tx + 24, 328);
  ctx.stroke();
  ctx.restore();
}

function drawNearTile(ctx: CanvasRenderingContext2D, x: number, pattern: number) {
  ctx.save();
  ctx.fillStyle = '#3b3552';
  for (let i = 0; i < 3; i += 1) {
    const cx = x + 28 + i * 66 + hash01(pattern * 7 + i) * 12;
    const size = 12 + hash01(pattern * 11 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(cx - size, GROUND_Y + 64);
    ctx.lineTo(cx - size * 0.6, GROUND_Y + 64 - size);
    ctx.lineTo(cx + size * 0.8, GROUND_Y + 64 - size * 0.6);
    ctx.lineTo(cx + size, GROUND_Y + 64);
    ctx.closePath();
    ctx.fill();
  }
  if (hash01(pattern * 3 + 5) > 0.4) {
    const lx = x + 170;
    ctx.strokeStyle = '#231d38';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lx, GROUND_Y + 66);
    ctx.lineTo(lx - 6, GROUND_Y + 10);
    ctx.lineTo(lx + 18, GROUND_Y + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(251,191,36,0.5)';
    ctx.beginPath();
    ctx.arc(lx + 20, GROUND_Y + 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle) {
  const { x, y, w, h, style } = obstacle;
  ctx.save();
  ctx.translate(x, y);
  if (style === 'CAR') {
    roundRect(ctx, 0, 7, w, h - 7, 6);
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();
    roundRect(ctx, 7, 0, w - 16, h * 0.56, 5);
    ctx.fillStyle = '#be123c';
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(9, h, 5, 0, Math.PI * 2);
    ctx.arc(w - 9, h, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'PIPE') {
    roundRect(ctx, 0, 4, w, h - 4, 6);
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.fillRect(5, 9, w - 10, 4);
  } else {
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(3, 8);
    ctx.lineTo(w * 0.4, 0);
    ctx.lineTo(w, 6);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSectionSign(ctx: CanvasRenderingContext2D, marker: (typeof SECTION_MARKERS)[number]) {
  const boardWidth = Math.max(126, marker.name.length * 17 + 28);
  ctx.save();
  ctx.translate(marker.x, 118);
  ctx.strokeStyle = 'rgba(226,232,240,0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, GROUND_Y - 118);
  ctx.stroke();
  roundRect(ctx, -12, -39, boardWidth, 43, 6);
  ctx.fillStyle = 'rgba(15,23,42,0.88)';
  ctx.fill();
  ctx.strokeStyle = marker.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = marker.accent;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(marker.name, -12 + boardWidth / 2, -10);
  ctx.restore();
}

function drawPlatform(ctx: CanvasRenderingContext2D, plat: { x: number; y: number; w: number; h: number }) {
  ctx.save();
  roundRect(ctx, plat.x, plat.y, plat.w, plat.h, Math.min(10, plat.h / 2));
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.stroke();
  roundRect(ctx, plat.x + 2, plat.y, plat.w - 4, Math.min(9, plat.h), 4);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D, gate: (typeof GATES)[number], time: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(248,113,113,0.16)';
  ctx.fillRect(gate.x, 130, 22, GROUND_Y - 130);
  ctx.strokeStyle = 'rgba(252,165,165,0.95)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -time * 40;
  ctx.strokeRect(gate.x, 130, 22, GROUND_Y - 130);
  ctx.setLineDash([]);
  ctx.fillStyle = '#fecaca';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('잠김', gate.x + 11, 118);
  ctx.restore();
}

function drawVillain(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number) {
  const stats = ENEMY_STATS[enemy.kind];
  const w = enemy.w;
  const h = enemy.h;
  ctx.save();
  ctx.translate(enemy.x + w / 2, enemy.y + h);
  ctx.scale(enemy.dir, 1);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, w * 0.48, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (enemy.kind === 'BOSS') {
    ctx.strokeStyle = `rgba(251,191,36,${0.35 + Math.sin(time * 5) * 0.15})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.5, w * 0.75, h * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 망토
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.kind === 'GRUNT' ? '#4c1d95' : '#450a0a';
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, -h * 0.8);
  ctx.quadraticCurveTo(-w * 0.75, -h * 0.45, -w * 0.62, -2);
  ctx.lineTo(w * 0.1, -h * 0.18);
  ctx.closePath();
  ctx.fill();

  // 다리
  ctx.fillStyle = '#111827';
  roundRect(ctx, -w * 0.3, -h * 0.22, w * 0.24, h * 0.22, 5);
  ctx.fill();
  roundRect(ctx, w * 0.06, -h * 0.22, w * 0.24, h * 0.22, 5);
  ctx.fill();

  // 몸
  const bodyColor =
    enemy.flash > 0
      ? '#ffffff'
      : enemy.kind === 'GRUNT'
        ? '#6d28d9'
        : enemy.kind === 'MID'
          ? '#be123c'
          : '#7f1d1d';
  roundRect(ctx, -w / 2, -h * 0.76, w, h * 0.58, 12);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  // 머리 + 뿔
  ctx.beginPath();
  ctx.arc(0, -h * 0.83, w * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 1.02);
  ctx.lineTo(-w * 0.12, -h * 1.24);
  ctx.lineTo(-w * 0.04, -h * 0.98);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.3, -h * 1.02);
  ctx.lineTo(w * 0.12, -h * 1.24);
  ctx.lineTo(w * 0.04, -h * 0.98);
  ctx.closePath();
  ctx.fill();

  // 눈
  ctx.fillStyle = enemy.flash > 0 ? '#1f2937' : '#fde047';
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = enemy.flash > 0 ? 0 : 12;
  ctx.beginPath();
  ctx.ellipse(-w * 0.13, -h * 0.86, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.13, -h * 0.86, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 왕관
  if (enemy.kind !== 'GRUNT') {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 1.12);
    ctx.lineTo(-w * 0.2, -h * 1.3);
    ctx.lineTo(-w * 0.08, -h * 1.14);
    ctx.lineTo(0, -h * 1.34);
    ctx.lineTo(w * 0.08, -h * 1.14);
    ctx.lineTo(w * 0.2, -h * 1.3);
    ctx.lineTo(w * 0.3, -h * 1.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // 체력바 (뒤집힘 없이)
  if (enemy.aggro || enemy.hp < enemy.maxHp || enemy.kind !== 'GRUNT') {
    const barW = enemy.kind === 'BOSS' ? 90 : enemy.kind === 'MID' ? 70 : 52;
    const bx = enemy.x + w / 2 - barW / 2;
    const by = enemy.y - 22;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    roundRect(ctx, bx - 2, by - 2, barW + 4, 9, 4);
    ctx.fill();
    ctx.fillStyle = enemy.kind === 'GRUNT' ? '#a78bfa' : '#fb7185';
    roundRect(ctx, bx, by, barW * Math.max(0, enemy.hp / enemy.maxHp), 5, 3);
    ctx.fill();
  }
}

function drawDefaultHero(ctx: CanvasRenderingContext2D, color: string) {
  // 그림이 없을 때 표시할 기본 실루엣
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-12, -44);
  ctx.quadraticCurveTo(-36, -8, -26, 0);
  ctx.lineTo(4, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  roundRect(ctx, -14, -40, 28, 30, 10);
  ctx.fill();
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.arc(0, -47, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(3, -48, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#172554';
  ctx.fillRect(-2, -50, 4, 4);
  ctx.fillStyle = color;
  roundRect(ctx, -11, -10, 9, 11, 4);
  ctx.fill();
  roundRect(ctx, 3, -10, 9, 11, 4);
  ctx.fill();
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, assets: Assets) {
  const p = state.player;
  const color = assets.role === 'HERO' ? '#38bdf8' : '#fb7185';
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h);
  ctx.scale(p.facing, 1);
  if (p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0) ctx.globalAlpha = 0.4;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, p.w * 0.6, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.22;
  ctx.beginPath();
  ctx.ellipse(0, -34, 42, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0 ? 0.4 : 1;

  if (assets.hero) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.drawImage(assets.hero, -40, -78, 80, 80);
    ctx.restore();
  } else {
    drawDefaultHero(ctx, color);
  }

  if (p.invuln > 0) {
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -32, 38, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  shot: Projectile,
  assets: Assets,
) {
  const cx = shot.x + shot.w / 2;
  const cy = shot.y + shot.h / 2;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = shot.fromPlayer ? '#67e8f9' : '#fb923c';
  ctx.lineWidth = shot.fromPlayer ? 6 : 4;
  ctx.beginPath();
  ctx.moveTo(cx - shot.vx * 0.035, cy - shot.vy * 0.035);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.translate(cx, cy);

  if (shot.fromPlayer && shot.skill && assets.skill) {
    ctx.rotate(shot.angle);
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 20;
    ctx.drawImage(assets.skill, -shot.w / 2, -shot.h / 2, shot.w, shot.h);
  } else if (shot.fromPlayer) {
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 18;
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, shot.w / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#67e8f9');
    grad.addColorStop(1, 'rgba(8,145,178,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, shot.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 14;
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, shot.w / 2);
    grad.addColorStop(0, '#fef3c7');
    grad.addColorStop(0.5, '#f97316');
    grad.addColorStop(1, 'rgba(127,29,29,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, shot.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPickup(ctx: CanvasRenderingContext2D, item: Pickup) {
  const y = item.y + Math.sin(item.bob) * 5;
  ctx.save();
  ctx.translate(item.x, y);
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.bezierCurveTo(-20, -2, -12, -16, 0, -7);
  ctx.bezierCurveTo(12, -16, 20, -2, 0, 11);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    if (particle.text) {
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillStyle = particle.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      ctx.strokeText(particle.text, particle.x, particle.y);
      ctx.fillText(particle.text, particle.x, particle.y);
    } else {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  assets: Assets,
) {
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const skyColors = skyAt(state.cameraX);
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  sky.addColorStop(0, skyColors.skyTop);
  sky.addColorStop(0.6, skyColors.skyBottom);
  sky.addColorStop(1, '#120a22');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // 먼 레이어: 퇴색한 태양, 구름, 먼 스카이라인
  const sunX = 800 - state.cameraX * 0.02;
  ctx.fillStyle = 'rgba(253,224,71,0.18)';
  ctx.beginPath();
  ctx.arc(sunX, 110, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(253,224,71,0.3)';
  ctx.beginPath();
  ctx.arc(sunX, 110, 34, 0, Math.PI * 2);
  ctx.fill();
  drawParallax(ctx, state.cameraX, 0.06, 320, 4, drawCloudTile);
  drawParallax(ctx, state.cameraX, 0.12, 240, 5, drawFarSkylineTile);

  // 중간 레이어: 무너진 건물과 구조물, 고사목
  drawParallax(ctx, state.cameraX, 0.32, 300, 4, drawMidBuildingTile);

  // 가까운 레이어: 바닥 주변 잔해와 가로등
  drawParallax(ctx, state.cameraX, 0.68, 220, 4, drawNearTile);

  // 피격 흔들림은 카메라 상태와 분리해 부드러운 사인파로 처리한다.
  const shakeX = state.shake > 0 ? Math.sin(state.time * 92) * state.shake : 0;
  const shakeY = state.shake > 0 ? Math.cos(state.time * 77) * state.shake * 0.5 : 0;
  ctx.save();
  ctx.translate(-state.cameraX + shakeX, shakeY);

  for (const plat of PLATFORMS) drawPlatform(ctx, plat);
  for (const obstacle of OBSTACLES) drawObstacle(ctx, obstacle);
  for (const marker of SECTION_MARKERS) {
    if (marker.x > state.cameraX - 200 && marker.x < state.cameraX + VIEW_WIDTH + 200) {
      drawSectionSign(ctx, marker);
    }
  }
  for (const gate of GATES) {
    if (!gateOpen(state, gate.zone)) drawGate(ctx, gate, state.time);
  }
  for (const item of state.pickups) drawPickup(ctx, item);
  for (const enemy of state.enemies) {
    if (enemy.alive && Math.abs(enemy.x - state.cameraX) < VIEW_WIDTH + 200) {
      drawVillain(ctx, enemy, state.time);
    }
  }
  drawPlayer(ctx, state, assets);
  for (const shot of state.projectiles) drawProjectile(ctx, shot, assets);
  drawParticles(ctx, state.particles);
  ctx.restore();

  // 만화 인쇄 느낌의 약한 비네트
  const vignette = ctx.createRadialGradient(
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    VIEW_HEIGHT * 0.35,
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    VIEW_WIDTH * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(8,3,20,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function syncHud(state: GameState): Hud {
  const zone = activeZone(state);
  const remaining = state.enemies.filter(
    (e) => e.zone === zone && e.alive && e.kind === 'GRUNT',
  ).length;
  const mid = state.enemies.find((e) => e.kind === 'MID' && e.alive && e.aggro);
  const final = state.enemies.find(
    (e) =>
      e.kind === 'BOSS' &&
      e.alive &&
      (e.aggro || state.player.x > 4950),
  );
  const boss = mid ?? final;
  let objective: string;
  if (zone === 3) {
    objective = final?.alive ? '최종 보스를 쓰러뜨리세요!' : '스테이지 클리어!';
  } else if (zone === 2) {
    objective = mid?.alive
      ? `2구역 빌런 ${remaining}명 · 중간 보스와 전투 중`
      : '중간 보스 처치 완료 · 다음 구역으로!';
  } else {
    objective = `1구역 빌런 ${remaining}명 남음`;
  }
  return {
    hp: state.player.hp,
    kills: state.kills,
    time: state.time,
    zone,
    sectionName: sectionAt(state.player.x).name,
    objective,
    notice: state.noticeTimer > 0 ? state.notice : '',
    damageFlash: state.damageFlash,
    status: state.status,
    bossName: boss ? ENEMY_STATS[boss.kind].name : '',
    bossHp: boss?.hp ?? 0,
    bossMaxHp: boss?.maxHp ?? 1,
    attackReady: state.player.attackCd <= 0,
  };
}

const INITIAL_HUD: Hud = {
  hp: MAX_HP,
  kills: 0,
  time: 0,
  zone: 1,
  sectionName: '시작 구역',
  objective: '빌런을 쓰러뜨리고 오른쪽으로 진행하세요!',
  notice: '',
  damageFlash: 0,
  status: 'PLAY',
  bossName: '',
  bossHp: 0,
  bossMaxHp: 1,
  attackReady: true,
};

interface StageGameProps {
  character: HeroCharacter;
  onExit: () => void;
  onBackToCharacter: () => void;
}

export function StageGame({ character, onExit, onBackToCharacter }: StageGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<Input>({
    left: false,
    right: false,
    jumpQueued: false,
    attackQueued: false,
  });
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [runKey, setRunKey] = useState(0);

  const heroSprite = useMemo(
    () => rasterizeDrawing(character.drawing, 256),
    [character.drawing],
  );
  const skillSprite = useMemo(
    () => rasterizeDrawing(character.skill ?? [], 256),
    [character.skill],
  );
  const assets = useMemo<Assets>(
    () => ({
      hero: heroSprite,
      skill: skillSprite,
      role: character.role,
    }),
    [heroSprite, skillSprite, character.role],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        ['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w', 'j', 'z', 'x'].includes(key)
      ) {
        e.preventDefault();
      }
      if (e.repeat) return;
      const input = inputRef.current;
      if (key === 'arrowleft' || key === 'a') input.left = true;
      if (key === 'arrowright' || key === 'd') input.right = true;
      if (key === 'arrowup' || key === 'w' || key === ' ') input.jumpQueued = true;
      if (key === 'j' || key === 'z' || key === 'x') input.attackQueued = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const input = inputRef.current;
      if (key === 'arrowleft' || key === 'a') input.left = false;
      if (key === 'arrowright' || key === 'd') input.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = VIEW_WIDTH;
    canvas.height = VIEW_HEIGHT;

    const state = createState();
    setHud(INITIAL_HUD);
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      update(state, inputRef.current, dt, assets);
      render(ctx, state, assets);
      if (now - lastHud > 80) {
        lastHud = now;
        setHud(syncHud(state));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [runKey, assets]);

  const touchDown = (action: 'left' | 'right' | 'jump' | 'attack') => (e: React.PointerEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (action === 'left') input.left = true;
    if (action === 'right') input.right = true;
    if (action === 'jump') input.jumpQueued = true;
    if (action === 'attack') input.attackQueued = true;
  };
  const touchUp = (action: 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (action === 'left') input.left = false;
    if (action === 'right') input.right = false;
  };

  const queueAttack = () => {
    inputRef.current.attackQueued = true;
  };
  const canvasAttack = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    queueAttack();
  };

  const restart = () => setRunKey((key) => key + 1);

  return (
    <div className="w-full h-screen bg-[#0b0b1c] flex items-center justify-center p-3 overflow-hidden relative">
      <div
        className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl border border-white/15 shadow-[0_0_60px_rgba(59,130,246,0.2)]"
        style={{ maxWidth: 'calc((100vh - 24px) * 16 / 9)' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          style={{ cursor: 'default' }}
          onPointerDown={canvasAttack}
          aria-label="HERO FACTORY 스테이지"
        />

        {/* 피격 효과 */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: hud.damageFlash,
            background:
              'radial-gradient(ellipse at center, rgba(239,68,68,0) 35%, rgba(239,68,68,0.75) 100%)',
          }}
        />

        {/* 상단 HUD */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
          <div className="bg-slate-950/75 backdrop-blur rounded-xl px-3 py-2 border border-white/10 min-w-[190px]">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <UserRound className="w-3.5 h-3.5 text-cyan-300" />
              <span className="truncate max-w-[110px]">{character.name || '히어로'}</span>
              <span className={character.role === 'HERO' ? 'text-blue-300' : 'text-red-300'}>
                {character.role === 'HERO' ? '히어로' : '빌런'}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full rounded-full bg-slate-700 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-150 bg-gradient-to-r from-emerald-400 to-cyan-400"
                style={{ width: `${hud.hp}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-300">
              <span>HP {hud.hp}</span>
              <span>처치 {hud.kills} · {hud.time.toFixed(0)}초</span>
            </div>
          </div>

          <div className="bg-slate-950/75 backdrop-blur rounded-xl px-3 py-2 border border-white/10 text-center max-w-[45%]">
            <p className="text-[10px] tracking-widest text-cyan-300 font-bold">{hud.sectionName}</p>
            <p className="text-xs md:text-sm font-bold text-white truncate">{hud.objective}</p>
          </div>
        </div>

        {hud.bossName && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[62%] max-w-[440px] bg-slate-950/80 backdrop-blur rounded-xl px-4 py-2 border border-red-400/40 pointer-events-none">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-black text-red-300">⚔ {hud.bossName}</span>
              <span className="text-[10px] text-slate-300">
                {Math.max(0, hud.bossHp)} / {hud.bossMaxHp}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-yellow-400 transition-[width] duration-100"
                style={{ width: `${clamp((hud.bossHp / hud.bossMaxHp) * 100, 0, 100)}%` }}
              />
            </div>
          </div>
        )}

        {hud.notice && (
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 bg-slate-950/80 border border-cyan-400/40 rounded-lg px-4 py-2 text-sm font-bold text-cyan-200 whitespace-nowrap pointer-events-none animate-pulse">
            {hud.notice}
          </div>
        )}

        {/* 조작 안내 */}
        <div className="absolute bottom-3 left-3 hidden lg:block bg-slate-950/70 rounded-lg px-4 py-1.5 text-[11px] text-slate-200 border border-white/10 pointer-events-none">
          ← → / A D 이동 · ↑ / W / 스페이스 점프 · J / Z / X 기술 공격 · 화면 클릭도 공격
        </div>

        {/* 모바일 이동 버튼 */}
        <div className="absolute bottom-4 left-4 flex gap-2 lg:hidden pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <button
              onPointerDown={touchDown('left')}
              onPointerUp={touchUp('left')}
              onPointerCancel={touchUp('left')}
              onPointerLeave={touchUp('left')}
              className="w-14 h-14 rounded-full bg-slate-900/70 border border-white/25 text-xl font-bold active:bg-cyan-500/60 touch-none"
              aria-label="왼쪽 이동"
            >
              ←
            </button>
            <button
              onPointerDown={touchDown('right')}
              onPointerUp={touchUp('right')}
              onPointerCancel={touchUp('right')}
              onPointerLeave={touchUp('right')}
              className="w-14 h-14 rounded-full bg-slate-900/70 border border-white/25 text-xl font-bold active:bg-cyan-500/60 touch-none"
              aria-label="오른쪽 이동"
            >
              →
            </button>
          </div>
        </div>

        {/* 데스크톱·모바일 공통 점프/공격 버튼 */}
        <div className="absolute bottom-4 right-4 flex gap-2 pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <button
              onPointerDown={touchDown('jump')}
              className="w-14 h-14 rounded-full bg-slate-900/70 border border-white/25 text-xs font-bold active:bg-blue-500/60 touch-none"
              aria-label="점프"
            >
              점프
            </button>
            <button
              onPointerDown={touchDown('attack')}
              className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 text-[11px] font-black touch-none transition-all ${
                hud.attackReady
                  ? 'bg-gradient-to-br from-fuchsia-500 to-purple-700 border-fuchsia-300/70 shadow-lg shadow-fuchsia-500/40 active:scale-95'
                  : 'bg-slate-800/80 border-white/20 text-slate-400 opacity-70'
              }`}
              aria-label="기술 공격"
            >
              <Swords className="w-5 h-5" />
              기술
            </button>
          </div>
        </div>

        {(hud.status === 'CLEAR' || hud.status === 'GAMEOVER') && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm">
            <div className="text-center px-6 max-w-lg">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                {hud.status === 'CLEAR' ? (
                  <Sparkles className="w-9 h-9 text-white" />
                ) : (
                  <Swords className="w-9 h-9 text-white" />
                )}
              </div>
              <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                {hud.status === 'CLEAR' ? 'STAGE CLEAR!' : '게임 오버'}
              </h2>
              <p className="mt-3 text-sm text-slate-300">
                {hud.status === 'CLEAR'
                  ? `${character.name}이(가) 최종 보스를 쓰러뜨렸습니다!`
                  : '체력이 모두 소진되었습니다. 다시 도전해보세요.'}
              </p>
              <div className="mt-3 flex justify-center gap-5 text-xs text-slate-400">
                <span>처치한 빌런: {hud.kills}</span>
                <span>플레이 시간: {hud.time.toFixed(1)}초</span>
                <span>남은 HP: {hud.hp}</span>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={restart}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/40 font-bold transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  다시 도전
                </button>
                <button
                  onClick={onBackToCharacter}
                  className="px-5 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold transition-colors"
                >
                  캐릭터 수정
                </button>
                <button
                  onClick={onExit}
                  className="px-5 py-3 rounded-lg border border-white/20 hover:bg-white/10 font-bold transition-colors"
                >
                  게임 선택으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
