/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector;
  radius: number;
  color: string;
  health: number;
  maxHealth: number;
}

export interface Player extends Entity {
  speed: number;
  angle: number;
  score: number;
  team: 'blue' | 'red';
}

export interface Enemy extends Entity {
  speed: number;
  type: 'chaser' | 'shooter';
  lastShot: number;
  shootInterval: number;
  team: 'red';
}

export interface Bullet {
  id: string;
  pos: Vector;
  vel: Vector;
  radius: number;
  color: string;
  damage: number;
  ownerId: string;
  team: 'blue' | 'red';
}

export interface Ball {
  pos: Vector;
  vel: Vector;
  radius: number;
  lastKickerId: string | null;
}

export interface Obstacle {
  id: string;
  pos: Vector;
  width: number;
  height: number;
  type: 'wall' | 'bush';
}

export interface Particle {
  id: string;
  pos: Vector;
  vel: Vector;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface GameState {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  ball: Ball;
  obstacles: Obstacle[];
  isGameOver: boolean;
  score: { blue: number; red: number };
  wave: number;
}
