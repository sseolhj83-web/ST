/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState, Player, Enemy, Bullet, Particle, Vector, Obstacle, Ball } from './types';

export class GameEngine {
  private state: GameState;
  private lastUpdate: number = 0;
  private keys: Set<string> = new Set();
  private mousePos: Vector = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement | null = null;
  private onStateUpdate: (state: GameState) => void;

  // Joystick state
  private joystickAngle: number | null = null;
  private joystickForce: number = 0;

  // Field Dimension Margins
  public readonly marginX = 80;
  public readonly marginY = 80;
  public readonly goalWidth = 200;

  constructor(onStateUpdate: (state: GameState) => void) {
    this.onStateUpdate = onStateUpdate;
    this.state = this.getInitialState();
  }

  public setJoystickInput(angle: number | null, force: number) {
    this.joystickAngle = angle;
    this.joystickForce = force;
  }

  private getInitialState(): GameState {
    const defaultWidth = 1000;
    const defaultHeight = 800;

    return {
      player: {
        id: 'player',
        pos: { x: defaultWidth / 2, y: defaultHeight - 150 },
        radius: 20,
        color: '#3b82f6',
        health: 100,
        maxHealth: 100,
        speed: 260,
        angle: 0,
        score: 0,
        team: 'blue',
      },
      enemies: [],
      bullets: [],
      particles: [],
      ball: {
        pos: { x: defaultWidth / 2, y: defaultHeight / 2 },
        vel: { x: 0, y: 0 },
        radius: 14,
        lastKickerId: null,
      },
      obstacles: this.createMap(defaultWidth, defaultHeight),
      isGameOver: false,
      score: { blue: 0, red: 0 },
      wave: 1,
    };
  }

  private createMap(width: number, height: number): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const minX = this.marginX;
    const maxX = width - this.marginX;
    const minY = this.marginY;
    const maxY = height - this.marginY;
    const midX = width / 2;
    const midY = height / 2;

    // Center defend walls (Brawl Ball Style)
    // Dynamic positions based on current canvas dimension, so we'll re-init obstacles on canvas set!
    obstacles.push({ id: 'w1', pos: { x: midX - 120, y: midY - 20 }, width: 60, height: 40, type: 'wall' });
    obstacles.push({ id: 'w2', pos: { x: midX + 60, y: midY - 20 }, width: 60, height: 40, type: 'wall' });
    
    // Corner Bushes
    obstacles.push({ id: 'b1', pos: { x: minX + 50, y: minY + 100 }, width: 100, height: 100, type: 'bush' });
    obstacles.push({ id: 'b2', pos: { x: maxX - 150, y: minY + 100 }, width: 100, height: 100, type: 'bush' });
    obstacles.push({ id: 'b3', pos: { x: minX + 50, y: maxY - 200 }, width: 100, height: 100, type: 'bush' });
    obstacles.push({ id: 'b4', pos: { x: maxX - 150, y: maxY - 200 }, width: 100, height: 100, type: 'bush' });

    // Lateral walls
    obstacles.push({ id: 'w3', pos: { x: minX + 150, y: minY + 40 }, width: 80, height: 30, type: 'wall' });
    obstacles.push({ id: 'w4', pos: { x: maxX - 230, y: minY + 40 }, width: 80, height: 30, type: 'wall' });
    obstacles.push({ id: 'w5', pos: { x: minX + 150, y: maxY - 70 }, width: 80, height: 30, type: 'wall' });
    obstacles.push({ id: 'w6', pos: { x: maxX - 230, y: maxY - 70 }, width: 80, height: 30, type: 'wall' });

    return obstacles;
  }

  public setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Re-initialize player & ball center based on actual Canvas dimensions!
    this.state.player.pos = { x: canvas.width / 2, y: canvas.height - 150 };
    this.state.ball.pos = { x: canvas.width / 2, y: canvas.height / 2 };
    this.state.obstacles = this.createMap(canvas.width, canvas.height);
  }

  public handleKeyDown(key: string) {
    this.keys.add(key.toLowerCase());
  }

  public handleKeyUp(key: string) {
    this.keys.delete(key.toLowerCase());
  }

  public handleMouseMove(x: number, y: number) {
    this.mousePos = { x, y };
  }

  public handleMouseDown() {
    if (this.state.isGameOver) return;
    this.shoot('player', this.state.player.pos, this.mousePos, 'blue');
  }

  private shoot(ownerId: string, from: Vector, target: Vector, team: 'blue' | 'red') {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const angle = Math.atan2(dy, dx);
    
    const bullet: Bullet = {
      id: Math.random().toString(36).substr(2, 9),
      pos: { ...from },
      vel: {
        x: Math.cos(angle) * 550,
        y: Math.sin(angle) * 550,
      },
      radius: 6,
      color: team === 'blue' ? '#fbbf24' : '#ef4444',
      damage: 15,
      ownerId,
      team,
    };

    this.state.bullets.push(bullet);
  }

  public start() {
    this.lastUpdate = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(now: number) {
    if (this.state.isGameOver) return;

    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    this.update(dt);
    this.onStateUpdate({ ...this.state });

    requestAnimationFrame(this.loop.bind(this));
  }

  private update(dt: number) {
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.updateBall(dt);
    this.checkCollisions();
    this.spawnEnemies(dt);
    this.checkGoals();
  }

  // Check if position is within goalmouth
  private isInGoalMouth(x: number, y: number): boolean {
    if (!this.canvas) return false;
    const goalX = (this.canvas.width - this.goalWidth) / 2;
    // Inside the top or bottom goalmouth channels
    const inGoalX = x > goalX && x < goalX + this.goalWidth;
    const inTopGoalY = y < this.marginY;
    const inBottomGoalY = y > this.canvas.height - this.marginY;
    return inGoalX && (inTopGoalY || inBottomGoalY);
  }

  private constrainPosition(pos: Vector, radius: number) {
    if (!this.canvas) return;
    const minX = this.marginX + radius;
    const maxX = this.canvas.width - this.marginX - radius;
    const minY = this.marginY + radius;
    const maxY = this.canvas.height - this.marginY - radius;

    // Check if player/entity is trying to walk into the goals
    if (this.isInGoalMouth(pos.x, pos.y)) {
      // Let it go deeper into goals for scoring/defending
      pos.x = Math.max(this.canvas.width / 2 - this.goalWidth / 2 + radius, Math.min(this.canvas.width / 2 + this.goalWidth / 2 - radius, pos.x));
      pos.y = Math.max(radius, Math.min(this.canvas.height - radius, pos.y));
    } else {
      // Normal pitch constraints
      pos.x = Math.max(minX, Math.min(maxX, pos.x));
      pos.y = Math.max(minY, Math.min(maxY, pos.y));
    }
  }

  private updatePlayer(dt: number) {
    const { player } = this.state;
    let dx = 0;
    let dy = 0;

    // Support English WASD, Arrows, and Korean layout mapping
    if (this.keys.has('w') || this.keys.has('arrowup') || this.keys.has('ㅈ')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown') || this.keys.has('ㄴ')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft') || this.keys.has('ㅁ')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright') || this.keys.has('ㅇ')) dx += 1;

    let moveX = 0;
    let moveY = 0;

    if (this.joystickAngle !== null) {
      // Use virtual joypad drag math if active
      moveX = Math.cos(this.joystickAngle) * player.speed * this.joystickForce * dt;
      moveY = Math.sin(this.joystickAngle) * player.speed * this.joystickForce * dt;
    } else if (dx !== 0 || dy !== 0) {
      const mag = Math.sqrt(dx * dx + dy * dy);
      moveX = (dx / mag) * player.speed * dt;
      moveY = (dy / mag) * player.speed * dt;
    }

    if (moveX !== 0 || moveY !== 0) {
      const nextX = player.pos.x + moveX;
      const nextY = player.pos.y + moveY;

      if (!this.checkObstacleCollision(nextX, nextY, player.radius)) {
        player.pos.x = nextX;
        player.pos.y = nextY;
      }
    }

    this.constrainPosition(player.pos, player.radius);

    const adx = this.mousePos.x - player.pos.x;
    const ady = this.mousePos.y - player.pos.y;
    player.angle = Math.atan2(ady, adx);
  }

  private updateEnemies(dt: number) {
    const { player, enemies } = this.state;
    const now = performance.now();

    enemies.forEach(enemy => {
      const dx = player.pos.x - enemy.pos.x;
      const dy = player.pos.y - enemy.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (enemy.type === 'chaser') {
        if (dist > 0) {
          const moveX = (dx / dist) * enemy.speed * dt;
          const moveY = (dy / dist) * enemy.speed * dt;
          if (!this.checkObstacleCollision(enemy.pos.x + moveX, enemy.pos.y + moveY, enemy.radius)) {
            enemy.pos.x += moveX;
            enemy.pos.y += moveY;
          }
        }
      } else if (enemy.type === 'shooter') {
        if (dist > 350) {
          const moveX = (dx / dist) * enemy.speed * dt;
          const moveY = (dy / dist) * enemy.speed * dt;
          if (!this.checkObstacleCollision(enemy.pos.x + moveX, enemy.pos.y + moveY, enemy.radius)) {
            enemy.pos.x += moveX;
            enemy.pos.y += moveY;
          }
        } else if (dist < 220) {
          const moveX = -(dx / dist) * enemy.speed * dt;
          const moveY = -(dy / dist) * enemy.speed * dt;
          if (!this.checkObstacleCollision(enemy.pos.x + moveX, enemy.pos.y + moveY, enemy.radius)) {
            enemy.pos.x += moveX;
            enemy.pos.y += moveY;
          }
        }

        // Shoot
        if (now - enemy.lastShot > enemy.shootInterval) {
          this.shoot(enemy.id, enemy.pos, player.pos, 'red');
          enemy.lastShot = now;
        }
      }

      this.constrainPosition(enemy.pos, enemy.radius);
    });
  }

  private updateBullets(dt: number) {
    this.state.bullets = this.state.bullets.filter(bullet => {
      bullet.pos.x += bullet.vel.x * dt;
      bullet.pos.y += bullet.vel.y * dt;

      if (this.checkObstacleCollision(bullet.pos.x, bullet.pos.y, bullet.radius, true)) {
        return false;
      }

      if (!this.canvas) return true;
      // Fade out bullets if they leave stadium walls
      const isOutOfBounds = 
        bullet.pos.x < this.marginX || 
        bullet.pos.x > this.canvas.width - this.marginX ||
        (bullet.pos.y < this.marginY && !this.isInGoalMouth(bullet.pos.x, bullet.pos.y)) ||
        (bullet.pos.y > this.canvas.height - this.marginY && !this.isInGoalMouth(bullet.pos.x, bullet.pos.y));

      return !isOutOfBounds;
    });
  }

  private updateParticles(dt: number) {
    this.state.particles = this.state.particles.filter(p => {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  private updateBall(dt: number) {
    const { ball, player, enemies } = this.state;
    if (!this.canvas) return;

    // Friction
    ball.vel.x *= 0.97;
    ball.vel.y *= 0.97;

    const nextX = ball.pos.x + ball.vel.x * dt;
    const nextY = ball.pos.y + ball.vel.y * dt;

    // Obstacle collision
    if (this.checkObstacleCollision(nextX, ball.pos.y, ball.radius)) {
      ball.vel.x *= -0.8;
    } else {
      ball.pos.x = nextX;
    }

    if (this.checkObstacleCollision(ball.pos.x, nextY, ball.radius)) {
      ball.vel.y *= -0.8;
    } else {
      ball.pos.y = nextY;
    }

    // Stadium Wall boundary physics
    const goalX = (this.canvas.width - this.goalWidth) / 2;
    const isInsideGoalX = ball.pos.x > goalX + ball.radius && ball.pos.x < goalX + this.goalWidth - ball.radius;

    // Y Wall boundary bounce
    if (ball.pos.y < this.marginY + ball.radius && !isInsideGoalX) {
      ball.vel.y *= -0.8;
      ball.pos.y = this.marginY + ball.radius;
    } else if (ball.pos.y > this.canvas.height - this.marginY - ball.radius && !isInsideGoalX) {
      ball.vel.y *= -0.8;
      ball.pos.y = this.canvas.height - this.marginY - ball.radius;
    }

    // X Wall boundary bounce
    if (ball.pos.x < this.marginX + ball.radius) {
      ball.vel.x *= -0.8;
      ball.pos.x = this.marginX + ball.radius;
    } else if (ball.pos.x > this.canvas.width - this.marginX - ball.radius) {
      ball.vel.x *= -0.8;
      ball.pos.x = this.canvas.width - this.marginX - ball.radius;
    }

    // Player kick
    const pdx = ball.pos.x - player.pos.x;
    const pdy = ball.pos.y - player.pos.y;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdist < ball.radius + player.radius) {
      const angle = Math.atan2(pdy, pdx);
      ball.vel.x = Math.cos(angle) * 620;
      ball.vel.y = Math.sin(angle) * 620;
      ball.lastKickerId = player.id;
    }

    // Enemy kick (towards player's goal at the bottom)
    enemies.forEach(enemy => {
      const edx = ball.pos.x - enemy.pos.x;
      const edy = ball.pos.y - enemy.pos.y;
      const edist = Math.sqrt(edx * edx + edy * edy);
      if (edist < ball.radius + enemy.radius) {
        // Kick towards player's goal
        const targetGoalGoalX = this.canvas!.width / 2;
        const targetGoalGoalY = this.canvas!.height - this.marginY;
        const angle = Math.atan2(targetGoalGoalY - enemy.pos.y, targetGoalGoalX - enemy.pos.x);
        
        ball.vel.x = Math.cos(angle) * 450;
        ball.vel.y = Math.sin(angle) * 450;
        ball.lastKickerId = enemy.id;
      }
    });
  }

  private checkObstacleCollision(x: number, y: number, radius: number, isBullet: boolean = false): boolean {
    for (const obs of this.state.obstacles) {
      if (obs.type === 'bush') continue; // Always walk/shoot through bushes!

      if (obs.type === 'wall') {
        if (x + radius > obs.pos.x && x - radius < obs.pos.x + obs.width &&
            y + radius > obs.pos.y && y - radius < obs.pos.y + obs.height) {
          return true;
        }
      }
    }
    return false;
  }

  private checkCollisions() {
    const { player, enemies, bullets } = this.state;

    // Bullet vs Entity
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];

      if (bullet.team === 'blue') {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const enemy = enemies[j];
          const dx = bullet.pos.x - enemy.pos.x;
          const dy = bullet.pos.y - enemy.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < bullet.radius + enemy.radius) {
            enemy.health -= bullet.damage;
            bullets.splice(i, 1);
            this.createExplosion(enemy.pos, enemy.color, 5);
            if (enemy.health <= 0) {
              this.createExplosion(enemy.pos, enemy.color, 15);
              enemies.splice(j, 1);
            }
            break;
          }
        }
      } else {
        const dx = bullet.pos.x - player.pos.x;
        const dy = bullet.pos.y - player.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bullet.radius + player.radius) {
          player.health -= bullet.damage;
          bullets.splice(i, 1);
          this.createExplosion(player.pos, player.color, 5);
          if (player.health <= 0) {
            this.state.isGameOver = true;
          }
        }
      }
    }
  }

  private checkGoals() {
    const { ball, score } = this.state;
    if (!this.canvas) return;

    const goalX = (this.canvas.width - this.goalWidth) / 2;

    // Blue Scores (Top Target - Red Enemy Goalmouth)
    if (ball.pos.y < this.marginY - ball.radius && ball.pos.x > goalX && ball.pos.x < goalX + this.goalWidth) {
      score.blue += 1;
      this.createGoalExplosion({ x: this.canvas.width / 2, y: this.marginY - 30 }, '#3b82f6');
      this.resetPositions();
    }

    // Red Scores (Bottom Target - Blue Player Goalmouth)
    if (ball.pos.y > this.canvas.height - this.marginY + ball.radius && ball.pos.x > goalX && ball.pos.x < goalX + this.goalWidth) {
      score.red += 1;
      this.createGoalExplosion({ x: this.canvas.width / 2, y: this.canvas.height - this.marginY + 30 }, '#ef4444');
      this.resetPositions();
    }
  }

  private createGoalExplosion(pos: Vector, color: string) {
    this.createExplosion(pos, color, 40);
  }

  private resetPositions() {
    if (!this.canvas) return;
    this.state.player.pos = { x: this.canvas.width / 2, y: this.canvas.height - 150 };
    this.state.ball.pos = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    this.state.ball.vel = { x: 0, y: 0 };
    this.state.enemies = [];
    this.state.bullets = [];
  }

  private createExplosion(pos: Vector, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 300 + 100;
      this.state.particles.push({
        id: Math.random().toString(36).substr(2, 9),
        pos: { ...pos },
        vel: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        life: 0.6,
        maxLife: 0.6,
        color,
        radius: Math.random() * 4 + 2,
      });
    }
  }

  private enemySpawnTimer = 0;
  private spawnEnemies(dt: number) {
    this.enemySpawnTimer += dt;
    if (this.enemySpawnTimer > 3.5) {
      this.enemySpawnTimer = 0;
      if (!this.canvas) return;

      const type = Math.random() > 0.6 ? 'shooter' : 'chaser';
      // Spawn slightly behind top stadium walls
      const x = this.canvas.width / 2 + (Math.random() - 0.5) * 400;
      const y = this.marginY + 40;

      const enemy: Enemy = {
        id: Math.random().toString(36).substr(2, 9),
        pos: { x, y },
        radius: 18,
        color: type === 'shooter' ? '#f97316' : '#ef4444',
        health: 50,
        maxHealth: 50,
        speed: 130,
        type,
        lastShot: 0,
        shootInterval: 1800,
        team: 'red',
      };

      this.state.enemies.push(enemy);
    }
  }

  public reset() {
    this.state = this.getInitialState();
    this.lastUpdate = performance.now();
  }
}
