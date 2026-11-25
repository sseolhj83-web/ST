import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Swords, UserRound } from 'lucide-react';
import { HeroCharacter } from '../game/types';
import { rasterizeDrawing } from '../game/drawing';
import {
  ENEMY_SPAWNS,
  ENEMY_STATS,
  GATES,
  GROUND_Y,
  PLATFORMS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_WIDTH,
  type EnemyKind,
} from '../game/stage';

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
  state.shake = 9;
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
  state.shake = enemy.kind === 'GRUNT' ? 5 : 12;
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
  if (p.vy >= 0) {
    for (const plat of PLATFORMS) {
      if (
        p.x + p.w > plat.x &&
        p.x < plat.x + plat.w &&
        prevBottom <= plat.y + 2 &&
        p.y + p.h >= plat.y
      ) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
        break;
      }
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

  const targetCamera = clamp(
    p.x - VIEW_WIDTH * 0.35,
    0,
    WORLD_WIDTH - VIEW_WIDTH,
  );
  state.cameraX += (targetCamera - state.cameraX) * Math.min(1, dt * 6);

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

  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  sky.addColorStop(0, '#171336');
  sky.addColorStop(0.55, '#34255f');
  sky.addColorStop(1, '#5b356d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  ctx.fillStyle = 'rgba(253,224,71,0.22)';
  ctx.beginPath();
  ctx.arc(800, 110, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(253,224,71,0.35)';
  ctx.beginPath();
  ctx.arc(800, 110, 34, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const span = VIEW_WIDTH + 320;
    const x = (((i * 250 - state.cameraX * 0.16) % span) + span) % span - 160;
    drawCloud(ctx, x, 70 + (i % 3) * 46, 0.7 + (i % 2) * 0.35);
  }

  // 원근감 있는 만화풍 배경 언덕
  for (const layer of [
    { offset: 0.22, base: 265, amp: 28, color: '#2b2350' },
    { offset: 0.42, base: 350, amp: 22, color: '#3b2b5f' },
  ]) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(-100, VIEW_HEIGHT);
    for (let x = -100; x <= VIEW_WIDTH + 100; x += 20) {
      const wave =
        Math.sin((x + state.cameraX * layer.offset) * 0.006) * layer.amp +
        Math.sin((x + state.cameraX * layer.offset) * 0.014) * 11;
      ctx.lineTo(x, layer.base + wave);
    }
    ctx.lineTo(VIEW_WIDTH + 100, VIEW_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  ctx.save();
  ctx.translate(-Math.round(state.cameraX) + shakeX, shakeY);

  for (const plat of PLATFORMS) drawPlatform(ctx, plat);
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
            <p className="text-[10px] tracking-widest text-cyan-300 font-bold">{hud.zone}구역 진행 중</p>
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
