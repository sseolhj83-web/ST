/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XonoticGameState, Player3D, Bot, Projectile, WeaponType, JumpPad, PickupItem, MapWall, FragLog, PeacefulNpc } from './xonoticTypes';
import { getXonoticMap } from './xonoticMap';

export class XonoticEngine {
  public state: XonoticGameState;
  public isFrozen: boolean = false;
  private walls: MapWall[] = [];
  private jumpPads: JumpPad[] = [];
  private pickups: PickupItem[] = [];
  private lastUpdate: number = 0;
  private portalCooldown: number = 0;
  private botNames = ['Nexer', 'Crucible', 'Spectre', 'Overlord', 'Phantasm', 'Titan'];
  private onStateChange: (state: XonoticGameState) => void;

  // Arena Physics parameters (highly responsive like standard Quake/Xonotic engines)
  private readonly gravity = -42;
  private readonly maxGroundSpeed = 15;
  private readonly maxAirSpeed = 22;
  private readonly groundAccel = 90;
  private readonly airAccel = 35;
  private readonly groundFriction = 7.5;
  private readonly jumpForce = 15;

  constructor(onStateChange: (state: XonoticGameState) => void) {
    this.onStateChange = onStateChange;
    const map = getXonoticMap();
    this.walls = map.walls;
    this.jumpPads = map.jumpPads;
    this.pickups = map.pickups;

    this.state = this.getInitialState();
  }

  private getInitialState(): XonoticGameState {
    return {
      player: {
        pos: { x: -28, y: 14.5, z: -28 },
        vel: { x: 0, y: 0, z: 0 },
        yaw: 0,
        pitch: 0,
        health: 100,
        maxHealth: 150,
        armor: 100,
        maxArmor: 150,
        weapons: {
          laser: { type: 'laser', name: '블래스터', ammo: Infinity, maxAmmo: Infinity, fireRate: 300, lastFireTime: 0, damage: 15, color: '#06b6d4' },
          vaporizer: { type: 'vaporizer', name: '넥스 레이저', ammo: 10, maxAmmo: 20, fireRate: 1500, lastFireTime: 0, damage: 85, color: '#ec4899' },
          rocket: { type: 'rocket', name: '로켓 런처', ammo: 5, maxAmmo: 10, fireRate: 1100, lastFireTime: 0, damage: 70, color: '#f59e0b' },
          electro: { type: 'electro', name: '일렉트로 건', ammo: 40, maxAmmo: 100, fireRate: 120, lastFireTime: 0, damage: 8, color: '#8b5cf6' },
          grenade: { type: 'grenade', name: '수류탄', ammo: 5, maxAmmo: 12, fireRate: 1000, lastFireTime: 0, damage: 95, color: '#10b981' },
        },
        currentWeapon: 'laser',
        onGround: false,
        score: 0,
        deaths: 0,
      },
      bots: this.createBots(),
      npcs: this.createNpcs(),
      projectiles: [],
      pickups: JSON.parse(JSON.stringify(this.pickups)), // deep clone initial states
      fragFeed: [],
      matchTime: 0,
      isFrozen: false,
      dimension: 'upside_down',
    };
  }

  private createBots(): Bot[] {
    const spawned: Bot[] = [];

    // 1. Teammates are completely empty as requested ("팀원은 없어")

    // 2. 10 Red Enemies (적군 빨강이 10명)
    const enemyNames = [
      '하급 데모고르곤 👹',
      '굶주린 데모고르곤 👿',
      '우두머리 데모고르곤 👑',
      '기어다니는 데모독 🐕',
      '돌연변이 데모고르곤 💀',
      '심연의 데모고르곤 👁️',
      '비명지르는 데모고르곤 🗣️',
      '뒤틀린 데모독 🐕',
      '그림자 데모고르곤 👤',
      '광폭 데모고르곤 ⚡',
    ];
    const enemyPositions = [
      { x: -15, y: 2, z: -15 },
      { x: 15, y: 2, z: -15 },
      { x: -25, y: 2, z: -25 },
      { x: 25, y: 2, z: -25 },
      { x: -20, y: 2, z: 20 },
      { x: 20, y: 2, z: 20 },
      { x: 0, y: 2, z: -30 },
      { x: -30, y: 2, z: 0 },
      { x: 30, y: 2, z: 0 },
      { x: 3, y: 2, z: 30 },
    ];
    for (let i = 0; i < 10; i++) {
      const isStrongGuy = enemyNames[i].includes('강한 놈');
      spawned.push({
        id: `enemy_${i}`,
        name: enemyNames[i],
        pos: { ...enemyPositions[i] },
        vel: { x: 0, y: 0, z: 0 },
        health: isStrongGuy ? 200 : 100,
        maxHealth: isStrongGuy ? 200 : 100,
        color: isStrongGuy ? '#ea580c' : '#ff3355', // 주황빛이 도는 강력한 빨강색 vs 일반 빨강색
        radius: isStrongGuy ? 1.1 : 0.8, // Slightly larger size
        currentWeapon: isStrongGuy ? 'rocket' : (i % 4 === 0 ? 'laser' : i % 4 === 1 ? 'rocket' : i % 4 === 2 ? 'electro' : 'vaporizer'),
        lastShootTime: 0,
        targetPos: null,
        state: 'wandering',
        stateTimer: 0,
        isTeammate: false,
      });
    }

    return spawned;
  }

  public updateInputs(
    moveKeys: { w: boolean; s: boolean; a: boolean; d: boolean; space: boolean; arrowleft?: boolean; arrowright?: boolean; arrowup?: boolean; arrowdown?: boolean },
    yawDelta: number,
    pitchDelta: number,
    fired: boolean,
    isAiming: boolean,
    dt: number
  ) {
    const { player } = this.state;
    player.isAiming = isAiming;

    // Smooth keyboard turning helpers for players finding mouse look difficult
    let keyboardYaw = 0;
    let keyboardPitch = 0;
    const keyTurnSpeed = 2.2 * dt; // radians per second
    if (moveKeys.arrowleft) {
      keyboardYaw -= keyTurnSpeed;
    }
    if (moveKeys.arrowright) {
      keyboardYaw += keyTurnSpeed;
    }
    if (moveKeys.arrowup) {
      keyboardPitch += keyTurnSpeed * 0.7;
    }
    if (moveKeys.arrowdown) {
      keyboardPitch -= keyTurnSpeed * 0.7;
    }

    // Apply camera rotation bounds (Inversion fixed: changed '-' to '+' for yawDelta to align standard mouse look)
    player.yaw = (player.yaw + yawDelta + keyboardYaw) % (Math.PI * 2);
    player.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, player.pitch - pitchDelta + keyboardPitch));

    // Handle weapon firing trigger
    if (fired) {
      this.triggerWeaponFire('player');
    }

    // Process Movement friction + acceleration (GoldSrc/Quake strafe dynamic sliding)
    let moveX = 0;
    let moveZ = 0;
    if (moveKeys.w) { moveX += Math.sin(player.yaw); moveZ -= Math.cos(player.yaw); }
    if (moveKeys.s) { moveX -= Math.sin(player.yaw); moveZ += Math.cos(player.yaw); }
    if (moveKeys.a) { moveX -= Math.cos(player.yaw); moveZ -= Math.sin(player.yaw); }
    if (moveKeys.d) { moveX += Math.cos(player.yaw); moveZ += Math.sin(player.yaw); }

    // Normalize wishlist vectors
    const mag = Math.sqrt(moveX * moveX + moveZ * moveZ);
    let wishDir = { x: 0, y: 0, z: 0 };
    if (mag > 0) {
      wishDir = { x: moveX / mag, y: 0, z: moveZ / mag };
    }

    // Apply friction when standing flat
    if (player.onGround) {
      const speed = Math.sqrt(player.vel.x * player.vel.x + player.vel.z * player.vel.z);
      if (speed > 0) {
        const drop = speed * this.groundFriction * dt;
        const newSpeed = Math.max(0, speed - drop) / speed;
        player.vel.x *= newSpeed;
        player.vel.z *= newSpeed;
      }

      // Ground Jump physics
      if (moveKeys.space) {
        player.vel.y = this.jumpForce;
        player.onGround = false;
        // Bunny-hop subtle horizontal speed increment! (holds speed on high jump tick)
        if (mag > 0) {
          player.vel.x += wishDir.x * 2;
          player.vel.z += wishDir.z * 2;
        }
      }
    }

    // Acceleration physics (ground speed limits differ from air controls)
    const currentAccel = player.onGround ? this.groundAccel : this.airAccel;
    const currentMaxSpeed = player.onGround ? this.maxGroundSpeed : this.maxAirSpeed;

    const projVel = player.vel.x * wishDir.x + player.vel.z * wishDir.z;
    const addSpeed = currentMaxSpeed - projVel;
    if (addSpeed > 0) {
      const accelSpeed = Math.min(addSpeed, currentAccel * dt);
      player.vel.x += wishDir.x * accelSpeed;
      player.vel.z += wishDir.z * accelSpeed;
    }

    // Integrate gravity
    player.vel.y += this.gravity * dt;
  }

  public changeWeapon(weapon: WeaponType) {
    this.state.player.currentWeapon = weapon;
  }

  public toggleFreeze() {
    this.isFrozen = !this.isFrozen;
    this.state.isFrozen = this.isFrozen;
    this.onStateChange({ ...this.state });
  }

  public toggleDimension() {
    const oldDim = this.state.dimension || 'upside_down';
    const newDim = oldDim === 'upside_down' ? 'peaceful' : 'upside_down';
    this.state.dimension = newDim;
    this.portalCooldown = 3.5;
    
    this.pushFrag(
      'PORTAL',
      `${newDim === 'peaceful' ? 'Peaceful Overworld' : 'The Upside Down'}`,
      'laser'
    );
    this.onStateChange({ ...this.state });
  }

  public stepSimulator(dt: number) {
    this.state.matchTime += dt;
    if (this.portalCooldown > 0) {
      this.portalCooldown -= dt;
    }

    // Portal collision
    const { player } = this.state;
    const portalX = -28;
    const portalZ = -34.5;
    const distToPortal = Math.sqrt((player.pos.x - portalX) ** 2 + (player.pos.z - portalZ) ** 2);
    // On the roof platform (Y around 14.5)
    if (this.portalCooldown <= 0 && distToPortal < 3.2 && player.pos.y > 11.5 && player.pos.y < 20.0) {
      this.portalCooldown = 3.5; // Cooldown to prevent instant rapid shifting
      const oldDim = this.state.dimension || 'upside_down';
      const newDim = oldDim === 'upside_down' ? 'peaceful' : 'upside_down';
      this.state.dimension = newDim;
      
      this.pushFrag(
        'PORTAL',
        `${newDim === 'peaceful' ? 'Peaceful Overworld' : 'The Upside Down'}`,
        'laser'
      );
    }

    this.updatePlayerPhysics(dt);
    this.updateBotAI(dt);
    this.updateNpcs(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.checkCollisions();
    this.onStateChange({ ...this.state });
  }

  private updatePlayerPhysics(dt: number) {
    const { player } = this.state;

    // Apply simple boundary walls collision directly in X, Y, Z
    player.pos.x += player.vel.x * dt;
    this.checkWallAxisBound(player.pos, player.vel, 'x', 1.2);

    player.pos.y += player.vel.y * dt;
    player.onGround = this.checkWallAxisBound(player.pos, player.vel, 'y', 1.8);

    // Absolute fail-safe: Prevent falling below the floor (Y >= 1.0) under any circumstance
    if (player.pos.y < 1.0) {
      player.pos.y = 1.0;
      player.vel.y = 0;
      player.onGround = true;
    }

    player.pos.z += player.vel.z * dt;
    this.checkWallAxisBound(player.pos, player.vel, 'z', 1.2);

    // Jump pad checking for player
    this.jumpPads.forEach(jp => {
      const insideX = Math.abs(player.pos.x - jp.pos.x) < jp.width / 2 + 1;
      const insideZ = Math.abs(player.pos.z - jp.pos.z) < jp.depth / 2 + 1;
      const insideY = player.pos.y > jp.pos.y && player.pos.y < jp.pos.y + 2.5;

      if (insideX && insideZ && insideY) {
        player.vel = { ...jp.force };
        player.onGround = false;
      }
    });
  }

  private updateBotAI(dt: number) {
    if (this.state.dimension === 'peaceful') {
      // Free and hide bots, no movement
      this.state.bots.forEach(b => {
        b.vel.x = 0;
        b.vel.y = 0;
        b.vel.z = 0;
      });
      return;
    }
    if (this.isFrozen) {
      // Keep velocities zeroed out so they don't slide or walk
      this.state.bots.forEach(b => {
        b.vel.x = 0;
        b.vel.y = 0;
        b.vel.z = 0;
      });
      return;
    }
    const { bots, player } = this.state;
    const now = performance.now();

    bots.forEach(bot => {
      bot.stateTimer -= dt;
      
      // Target Selection Logic based on teams (Friendly Teammate Blue vs Red Enemies)
      let targetEntity: { pos: { x: number; y: number; z: number }; id: string; name: string } | null = null;
      let distToTarget = Infinity;

      if (bot.isTeammate) {
        // 🔵 Friendly Teammate Blue hunts red enemies (non-teammates)
        bots.forEach(otherBot => {
          if (!otherBot.isTeammate && otherBot.health > 0) {
            const d = Math.sqrt(
              (otherBot.pos.x - bot.pos.x) ** 2 +
              (otherBot.pos.y - bot.pos.y) ** 2 +
              (otherBot.pos.z - bot.pos.z) ** 2
            );
            if (d < distToTarget) {
              distToTarget = d;
              targetEntity = { pos: otherBot.pos, id: otherBot.id, name: otherBot.name };
            }
          }
        });
      } else {
        // 🔴 Red Enemies hunt Player OR Blue Teammate
        // 1. Check distance to Player
        const distPlayer = Math.sqrt(
          (player.pos.x - bot.pos.x) ** 2 +
          (player.pos.y - bot.pos.y) ** 2 +
          (player.pos.z - bot.pos.z) ** 2
        );
        distToTarget = distPlayer;
        targetEntity = { pos: player.pos, id: 'player', name: 'You' };

        // 2. Check distance to Friendly Teammate Blue
        bots.forEach(otherBot => {
          if (otherBot.isTeammate && otherBot.health > 0) {
            const d = Math.sqrt(
              (otherBot.pos.x - bot.pos.x) ** 2 +
              (otherBot.pos.y - bot.pos.y) ** 2 +
              (otherBot.pos.z - bot.pos.z) ** 2
            );
            if (d < distToTarget) {
              distToTarget = d;
              targetEntity = { pos: otherBot.pos, id: otherBot.id, name: otherBot.name };
            }
          }
        });
      }

      // Basic state machine: Wander or Hunt
      if (bot.stateTimer <= 0) {
        bot.state = Math.random() > 0.4 ? 'hunting' : 'wandering';
        bot.stateTimer = 2 + Math.random() * 3;
        
        if (bot.state === 'wandering') {
          // Select randomized sector to patrol
          const angle = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * 20;
          bot.targetPos = { x: Math.cos(angle) * dist, y: 1.5, z: Math.sin(angle) * dist };
        }
      }

      // Nav lock point
      let targetCoords = bot.state === 'hunting' && targetEntity ? { ...targetEntity.pos } : bot.targetPos;
      if (!targetCoords) {
        targetCoords = { x: 0, y: 1.5, z: 0 };
      }

      // Calculate path direction
      const dx = targetCoords.x - bot.pos.x;
      const dz = targetCoords.z - bot.pos.z;
      const distToGoal = Math.sqrt(dx * dx + dz * dz);

      let BotSpeed = bot.isTeammate ? 9.5 : 8.0; // Give blue teammate slightly faster movement to assist better
      if (distToGoal > 1.5) {
        bot.vel.x = (dx / distToGoal) * BotSpeed;
        bot.vel.z = (dz / distToGoal) * BotSpeed;
      } else {
        bot.vel.x = 0;
        bot.vel.z = 0;
        if (bot.state === 'wandering') bot.stateTimer = 0; // force renew state
      }

      // Incorporate Jump triggers if bots hit central steps
      if (Math.random() < 0.05 && distToGoal > 8 && distToGoal < 22 && bot.pos.y < 2) {
        bot.vel.y = 12; // jump randomly to platforms
      }

      // Apply Bot physics
      bot.vel.y += this.gravity * dt;
      bot.pos.x += bot.vel.x * dt;
      this.checkWallAxisBound(bot.pos, bot.vel, 'x', 1.2);
      bot.pos.y += bot.vel.y * dt;
      let botOnGround = this.checkWallAxisBound(bot.pos, bot.vel, 'y', 1.8);

      // Absolute fail-safe: Prevent bots from falling below the floor (Y >= 1.0) under any circumstance
      if (bot.pos.y < 1.0) {
        bot.pos.y = 1.0;
        bot.vel.y = 0;
        botOnGround = true;
      }

      bot.pos.z += bot.vel.z * dt;
      this.checkWallAxisBound(bot.pos, bot.vel, 'z', 1.2);

      if (botOnGround) {
        bot.vel.y = 0;
      }

      // Simple jump pad triggers for bots
      this.jumpPads.forEach(jp => {
        if (Math.abs(bot.pos.x - jp.pos.x) < jp.width / 2 + 1 &&
            Math.abs(bot.pos.z - jp.pos.z) < jp.depth / 2 + 1 &&
            bot.pos.y > jp.pos.y && bot.pos.y < jp.pos.y + 2.5) {
          bot.vel = { ...jp.force };
        }
      });

      // Target shooting logic - Disabled per user request so they don't attack anymore
      /*
      if (bot.state === 'hunting' && targetEntity && distToTarget < 35) {
        // Face target direction and fire
        if (now - bot.lastShootTime > 1100) {
          this.triggerBotFire(bot, targetEntity);
          bot.lastShootTime = now;
        }
      }
      */
    });
  }

  private triggerBotFire(bot: Bot, target: { pos: { x: number; y: number; z: number }; id: string }) {
    const dx = target.pos.x - bot.pos.x;
    const dy = (target.pos.y + 0.3) - bot.pos.y;
    const dz = target.pos.z - bot.pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist === 0) return;

    const velX = (dx / dist) * 35;
    const velY = (dy / dist) * 35;
    const velZ = (dz / dist) * 35;

    // Teammate shoots cyan plasma, enemies shoot red plasma
    const plasmaColor = bot.isTeammate ? '#3b82f6' : '#f43f5e';

    this.state.projectiles.push({
      id: Math.random().toString(36).substr(2, 9),
      type: 'plasma',
      pos: { ...bot.pos },
      vel: { x: velX, y: velY, z: velZ },
      radius: 0.5,
      damage: 12,
      color: plasmaColor,
      ownerId: bot.id,
    });
  }

  private triggerWeaponFire(owner: 'player' | string) {
    const { player } = this.state;
    const now = performance.now();
    const w = player.weapons[player.currentWeapon];

    if (now - w.lastFireTime < w.fireRate) return;
    if (w.ammo <= 0) return; // out of ammo!

    w.lastFireTime = now;
    if (w.ammo !== Infinity) w.ammo--;

    // Direction derived from yaw & pitch angles
    const lookX = Math.sin(player.yaw) * Math.cos(player.pitch);
    const lookY = Math.sin(player.pitch);
    const lookZ = -Math.cos(player.yaw) * Math.cos(player.pitch);

    // Spawn from player eye level (Y + 0.8), align perfectly with camera perspective and crosshair
    const playerEyeX = player.pos.x;
    const playerEyeY = player.pos.y + 0.8;
    const playerEyeZ = player.pos.z;

    if (player.currentWeapon === 'vaporizer') {
      // Vaporizer Instant Nex Laser ray (Hitscan)
      // Project line forward and scan against bots directly
      let hitTarget: Bot | null = null;
      let minHitDist = 120; // range limit

      if (this.state.dimension !== 'peaceful') {
        this.state.bots.forEach(bot => {
          // Axis line distance maths from player eye to bot center (Y + 0.5)
          const toBotX = bot.pos.x - playerEyeX;
          const toBotY = (bot.pos.y + 0.5) - playerEyeY;
          const toBotZ = bot.pos.z - playerEyeZ;

          const proj = toBotX * lookX + toBotY * lookY + toBotZ * lookZ;
          if (proj > 0) {
            const perpX = toBotX - proj * lookX;
            const perpY = toBotY - proj * lookY;
            const perpZ = toBotZ - proj * lookZ;
            const distPerp = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);

            if (distPerp < 2.0 && proj < minHitDist) {
              minHitDist = proj;
              hitTarget = bot;
            }
          }
        });
      }

      // Apply mass damage to hit bot target
      if (hitTarget) {
        const bot = hitTarget as Bot;
        // 1-hit kill sniper effect!
        bot.health = 0;
        this.pushFrag('You', bot.name, 'vaporizer');
        player.score++;
        // Remove the defeated bot
        this.state.bots = this.state.bots.filter(b => b.id !== bot.id);
      }

      // Add instant laser trace projectile (for particle visual rendering)
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'plasma', // render tracer
        pos: { x: playerEyeX, y: playerEyeY, z: playerEyeZ },
        vel: { x: lookX * 300, y: lookY * 300, z: lookZ * 300 }, // super sonic trace
        radius: 0.2,
        damage: 0,
        color: '#ec4899',
        ownerId: 'player',
      });

    } else if (player.currentWeapon === 'rocket') {
      // Physical rocket that travel and detonate on hits - speed up from 38 to 180 for immediate feel!
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'rocket',
        pos: { x: playerEyeX, y: playerEyeY, z: playerEyeZ },
        vel: { x: lookX * 180, y: lookY * 180, z: lookZ * 180 },
        radius: 0.8,
        damage: w.damage,
        color: '#f59e0b',
        ownerId: 'player',
      });
    } else if (player.currentWeapon === 'grenade') {
      // Physical lobbed grenade that has bouncy gravity physics and explodes
      // Lobs upwards and slower speed
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'grenade',
        pos: { x: playerEyeX, y: playerEyeY + 0.1, z: playerEyeZ },
        vel: {
          x: lookX * 42,
          y: lookY * 42 + 7.5, // arc upwards
          z: lookZ * 42
        },
        radius: 0.6,
        damage: w.damage,
        color: '#10b981',
        ownerId: 'player',
        bounces: 0,
        lifeTime: 2.2, // 2.2 seconds fuse
      });
    } else if (player.currentWeapon === 'laser' || player.currentWeapon === 'electro') {
      // Regular sci-fi energy blaster - speed up from 65 to 450 for laser precision!
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'plasma',
        pos: { x: playerEyeX, y: playerEyeY, z: playerEyeZ },
        vel: { x: lookX * 450, y: lookY * 450, z: lookZ * 450 },
        radius: 0.4,
        damage: w.damage,
        color: player.currentWeapon === 'laser' ? '#06b6d4' : '#8b5cf6',
        ownerId: 'player',
      });
    }
  }

  private respawnBotInstant(bot: Bot) {
    bot.health = 100;
    const angle = Math.random() * Math.PI * 2;
    bot.pos = { x: Math.cos(angle) * 30, y: 2, z: Math.sin(angle) * 30 };
    bot.vel = { x: 0, y: 0, z: 0 };
  }

  private updateProjectiles(dt: number) {
    const { projectiles, bots, player } = this.state;

    this.state.projectiles = projectiles.filter(p => {
      if (this.isFrozen && p.ownerId !== 'player') {
        // Skip updating non-player projectiles during freeze
        return true;
      }
      // Grenades have gravity and bounce physics
      if (p.type === 'grenade') {
        p.vel.y -= 25 * dt; // gravity force
      }

      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;

      // Grenade floor bouncing
      if (p.type === 'grenade' && p.pos.y < 1.05) {
        p.pos.y = 1.05;
        p.vel.y = -p.vel.y * 0.65; // vertical bounce
        p.vel.x *= 0.8; // friction
        p.vel.z *= 0.8; // friction
        if (p.bounces === undefined) p.bounces = 0;
        p.bounces++;
      }

      // Grenade fuse timer
      if (p.type === 'grenade') {
        if (p.lifeTime === undefined) p.lifeTime = 2.2;
        p.lifeTime -= dt;
        if (p.lifeTime <= 0 || (p.bounces !== undefined && p.bounces >= 3)) {
          this.triggerGrenadeExplosion(p.pos, p.ownerId);
          return false;
        }
      }

      // Wall crash
      if (this.checkWallCollision(p.pos, p.radius)) {
        if (p.type === 'rocket') {
          this.triggerRocketExplosion(p.pos, p.ownerId);
          return false;
        } else if (p.type === 'grenade') {
          // Bounce off wall, reverse horizontal velocity
          p.vel.x *= -0.65;
          p.vel.z *= -0.65;
          p.vel.y *= 0.6;
          p.pos.x += p.vel.x * dt * 2;
          p.pos.z += p.vel.z * dt * 2;
          if (p.bounces === undefined) p.bounces = 0;
          p.bounces++;
          if (p.bounces >= 3) {
            this.triggerGrenadeExplosion(p.pos, p.ownerId);
            return false;
          }
        } else {
          return false;
        }
      }

      // Identify if projectile belongs to our team (player or blue teammate)
      if (this.isFrozen && p.ownerId !== 'player') {
        // Non-player projectiles do not check collision when time is frozen
        return true;
      }
      const isBlueProjectile = p.ownerId === 'player' || (p.ownerId !== 'player' && !!this.state.bots.find(b => b.id === p.ownerId)?.isTeammate);

      if (isBlueProjectile) {
        // Player or Teampartner fired: Can only hit Red Enemies (bots with isTeammate = false)
        if (this.state.dimension !== 'peaceful') {
          for (let i = 0; i < bots.length; i++) {
            const b = bots[i];
            if (b.isTeammate) continue; // Skip teammates

            const dist = Math.sqrt(
              (p.pos.x - b.pos.x) ** 2 +
              (p.pos.y - b.pos.y) ** 2 +
              (p.pos.z - b.pos.z) ** 2
            );

            if (dist < b.radius + p.radius + 1.2) {
              if (p.type === 'rocket') {
                this.triggerRocketExplosion(p.pos, p.ownerId);
              } else if (p.type === 'grenade') {
                this.triggerGrenadeExplosion(p.pos, p.ownerId);
              } else {
                // 1-hit kill sniper effect if the player fired!
                const appliedDamage = p.ownerId === 'player' ? 9999 : p.damage;
                b.health -= appliedDamage;
                if (b.health <= 0) {
                  b.health = 0;
                  const shooterName = p.ownerId === 'player' ? 'You' : (this.state.bots.find(x => x.id === p.ownerId)?.name || '아군');
                  this.pushFrag(shooterName, b.name, p.ownerId === 'player' ? player.currentWeapon : 'laser');
                  if (p.ownerId === 'player') player.score++;
                  // Remove defeated bot
                  this.state.bots = this.state.bots.filter(x => x.id !== b.id);
                }
              }
              return false;
            }
          }
        }
      } else {
        // Red Enemy fired: Can hit player OR blue teammate!
        // 1. Check if teammate hit
        let hitFriendly = false;
        for (let i = 0; i < bots.length; i++) {
          const b = bots[i];
          if (!b.isTeammate) continue; // Skip non-friends

          const dist = Math.sqrt(
            (p.pos.x - b.pos.x) ** 2 +
            (p.pos.y - b.pos.y) ** 2 +
            (p.pos.z - b.pos.z) ** 2
          );

          if (dist < b.radius + p.radius + 1.2) {
            b.health -= p.damage;
            hitFriendly = true;
            if (b.health <= 0) {
              b.health = 0;
              const enemyBot = this.state.bots.find(x => x.id === p.ownerId);
              this.pushFrag(enemyBot ? enemyBot.name : '적군', b.name, 'laser');
              // Remove defeated teammate
              this.state.bots = this.state.bots.filter(x => x.id !== b.id);
            }
            break;
          }
        }

        if (hitFriendly) return false;

        // 2. Check if player hit
        const dist = Math.sqrt(
          (p.pos.x - player.pos.x) ** 2 +
          (p.pos.y - player.pos.y) ** 2 +
          (p.pos.z - player.pos.z) ** 2
        );

        if (dist < p.radius + 2.0) {
          this.damagePlayer(p.damage, p.ownerId);
          return false;
        }
      }

      // Limit lifespan range
      const extremeX = Math.abs(p.pos.x) > 60;
      const extremeZ = Math.abs(p.pos.z) > 60;
      const extremeY = p.pos.y < -1 || p.pos.y > 45;

      return !(extremeX || extremeZ || extremeY);
    });
  }

  private triggerRocketExplosion(pos: { x: number; y: number; z: number }, ownerId: string) {
    const { player, bots } = this.state;
    const explosionRadius = 10;
    const maxPushForce = 45;

    // 1. Check Player distance for Rocket Jump / Hurt maths
    const distToPlayer = Math.sqrt(
      (pos.x - player.pos.x) ** 2 +
      (pos.y - player.pos.y) ** 2 +
      (pos.z - player.pos.z) ** 2
    );

    if (distToPlayer < explosionRadius) {
      const effectFactor = (explosionRadius - distToPlayer) / explosionRadius;
      
      // Compute push vector
      const pushDX = player.pos.x - pos.x;
      const pushDY = player.pos.y - pos.y + 0.5; // push upwards
      const pushDZ = player.pos.z - pos.z;
      const pushDist = Math.sqrt(pushDX * pushDX + pushDY * pushDY + pushDZ * pushDZ) || 1;

      player.vel.x += (pushDX / pushDist) * maxPushForce * effectFactor;
      player.vel.y += (pushDY / pushDist) * maxPushForce * effectFactor;
      player.vel.z += (pushDZ / pushDist) * maxPushForce * effectFactor;
      player.onGround = false;

      // Hurt player if self-blast damage
      const selfDmg = 35 * effectFactor;
      this.damagePlayer(selfDmg, ownerId === 'player' ? 'self' : ownerId);
    }

    // 2. Damage and push bots
    bots.forEach(bot => {
      const distToBot = Math.sqrt(
        (pos.x - bot.pos.x) ** 2 +
        (pos.y - bot.pos.y) ** 2 +
        (pos.z - bot.pos.z) ** 2
      );

      if (distToBot < explosionRadius) {
        const effectFactor = (explosionRadius - distToBot) / explosionRadius;
        
        // Identify friendly fire: If rocket shooter is player or blue teammate
        const isFiredByUs = ownerId === 'player' || (ownerId !== 'player' && !!this.state.bots.find(b => b.id === ownerId)?.isTeammate);
        
        if (isFiredByUs && bot.isTeammate) {
          // Blue teammate just gets pushed, no damage from our rocket
          const pX = bot.pos.x - pos.x;
          const pY = bot.pos.y - pos.y;
          const pZ = bot.pos.z - pos.z;
          const pDist = Math.sqrt(pX * pX + pY * pY + pZ * pZ) || 1;

          bot.vel.x += (pX / pDist) * 20 * effectFactor;
          bot.vel.y += (pY / pDist) * 20 * effectFactor;
          bot.vel.z += (pZ / pDist) * 20 * effectFactor;
          return;
        }

        // 1-hit kill sniper effect if the player fired the rocket!
        const appliedDmg = this.state.dimension === 'peaceful' ? 0 : (ownerId === 'player' ? 9999 : 65 * effectFactor);
        bot.health -= appliedDmg;
        
        // Push bot away
        const pX = bot.pos.x - pos.x;
        const pY = bot.pos.y - pos.y;
        const pZ = bot.pos.z - pos.z;
        const pDist = Math.sqrt(pX * pX + pY * pY + pZ * pZ) || 1;

        bot.vel.x += (pX / pDist) * 35 * effectFactor;
        bot.vel.y += (pY / pDist) * 35 * effectFactor;
        bot.vel.z += (pZ / pDist) * 35 * effectFactor;

        if (bot.health <= 0) {
          bot.health = 0;
          const killerBot = this.state.bots.find(b => b.id === ownerId);
          const killer = ownerId === 'player' ? 'You' : (killerBot ? killerBot.name : '적군');
          this.pushFrag(killer, bot.name, 'rocket');
          if (ownerId === 'player') player.score++;
          // Remove defeated enemy bot
          this.state.bots = this.state.bots.filter(b => b.id !== bot.id);
        }
      }
    });
  }

  private triggerGrenadeExplosion(pos: { x: number; y: number; z: number }, ownerId: string) {
    const { player, bots } = this.state;
    const explosionRadius = 12; // wider than rocket
    const maxPushForce = 55; // stronger splash jump push!

    // 1. Check Player distance for grenade jump or damage
    const distToPlayer = Math.sqrt(
      (pos.x - player.pos.x) ** 2 +
      (pos.y - player.pos.y) ** 2 +
      (pos.z - player.pos.z) ** 2
    );

    if (distToPlayer < explosionRadius) {
      const effectFactor = (explosionRadius - distToPlayer) / explosionRadius;
      
      // Compute push vector
      const pushDX = player.pos.x - pos.x;
      const pushDY = player.pos.y - pos.y + 0.6; // push upwards strongly
      const pushDZ = player.pos.z - pos.z;
      const pushDist = Math.sqrt(pushDX * pushDX + pushDY * pushDY + pushDZ * pushDZ) || 1;

      player.vel.x += (pushDX / pushDist) * maxPushForce * effectFactor;
      player.vel.y += (pushDY / pushDist) * maxPushForce * effectFactor;
      player.vel.z += (pushDZ / pushDist) * maxPushForce * effectFactor;
      player.onGround = false;

      // Grenade self blast damage
      const selfDmg = 45 * effectFactor;
      this.damagePlayer(selfDmg, ownerId === 'player' ? 'self' : ownerId);
    }

    // 2. Damage and push bots
    bots.forEach(bot => {
      const distToBot = Math.sqrt(
        (pos.x - bot.pos.x) ** 2 +
        (pos.y - bot.pos.y) ** 2 +
        (pos.z - bot.pos.z) ** 2
      );

      if (distToBot < explosionRadius) {
        const effectFactor = (explosionRadius - distToBot) / explosionRadius;
        
        // Friendly fire check
        const isFiredByUs = ownerId === 'player' || (ownerId !== 'player' && !!this.state.bots.find(b => b.id === ownerId)?.isTeammate);
        
        if (isFiredByUs && bot.isTeammate) {
          const pX = bot.pos.x - pos.x;
          const pY = bot.pos.y - pos.y;
          const pZ = bot.pos.z - pos.z;
          const pDist = Math.sqrt(pX * pX + pY * pY + pZ * pZ) || 1;

          bot.vel.x += (pX / pDist) * 25 * effectFactor;
          bot.vel.y += (pY / pDist) * 25 * effectFactor;
          bot.vel.z += (pZ / pDist) * 25 * effectFactor;
          return;
        }

        // Standard 1-hit kill factor if the player threw it!
        const appliedDmg = this.state.dimension === 'peaceful' ? 0 : (ownerId === 'player' ? 9999 : 80 * effectFactor);
        bot.health -= appliedDmg;
        
        // Push bot away
        const pX = bot.pos.x - pos.x;
        const pY = bot.pos.y - pos.y;
        const pZ = bot.pos.z - pos.z;
        const pDist = Math.sqrt(pX * pX + pY * pY + pZ * pZ) || 1;

        bot.vel.x += (pX / pDist) * 45 * effectFactor;
        bot.vel.y += (pY / pDist) * 45 * effectFactor;
        bot.vel.z += (pZ / pDist) * 45 * effectFactor;

        if (bot.health <= 0) {
          bot.health = 0;
          const killerBot = this.state.bots.find(b => b.id === ownerId);
          const killer = ownerId === 'player' ? 'You' : (killerBot ? killerBot.name : '적군');
          this.pushFrag(killer, bot.name, 'grenade');
          if (ownerId === 'player') player.score++;
          // Remove defeated enemy bot
          this.state.bots = this.state.bots.filter(b => b.id !== bot.id);
        }
      }
    });
  }

  private damagePlayer(amount: number, sourceId: string) {
    if (this.state.dimension === 'peaceful') {
      return; // Absolute peace! No damage taken.
    }
    const { player } = this.state;
    // Shield / Armor system splits damage 70% to shield, 30% to health
    if (player.armor > 0) {
      const armorDamage = amount * 0.7;
      player.armor = Math.max(0, player.armor - armorDamage);
      player.health = Math.max(0, player.health - (amount * 0.3));
    } else {
      player.health = Math.max(0, player.health - amount);
    }

    if (player.health <= 0) {
      player.health = 0;
      player.deaths++;
      const killerName = sourceId === 'self' ? 'Yourself' : (this.state.bots.find(b => b.id === sourceId)?.name || 'An enemy');
      this.pushFrag(killerName, 'You', 'laser');
      
      // Permanent Death: No respawn
    }
  }

  private updatePickups(dt: number) {
    const { player, pickups } = this.state;

    pickups.forEach(pick => {
      if (pick.respawnTimer > 0) {
        pick.respawnTimer -= dt;
        return;
      }

      // Pickup intersection math
      const dist = Math.sqrt(
        (player.pos.x - pick.pos.x) ** 2 +
        (player.pos.y - pick.pos.y) ** 2 +
        (player.pos.z - pick.pos.z) ** 2
      );

      if (dist < 2.5) {
        // Collect
        if (pick.type === 'health_mega') {
          player.health = Math.min(player.maxHealth, player.health + pick.value);
        } else if (pick.type === 'armor_mega') {
          player.armor = Math.min(player.maxArmor, player.armor + pick.value);
        } else if (pick.type === 'weapon_vaporizer') {
          player.weapons.vaporizer.ammo = player.weapons.vaporizer.maxAmmo;
          player.currentWeapon = 'vaporizer';
        } else if (pick.type === 'weapon_rocket') {
          player.weapons.rocket.ammo = player.weapons.rocket.maxAmmo;
          player.currentWeapon = 'rocket';
        } else if (pick.type === 'weapon_grenade') {
          player.weapons.grenade.ammo = player.weapons.grenade.maxAmmo;
          player.currentWeapon = 'grenade';
        } else if (pick.type === 'ammo') {
          player.weapons.vaporizer.ammo = Math.min(player.weapons.vaporizer.maxAmmo, player.weapons.vaporizer.ammo + 5);
          player.weapons.rocket.ammo = Math.min(player.weapons.rocket.maxAmmo, player.weapons.rocket.ammo + 3);
          player.weapons.electro.ammo = Math.min(player.weapons.electro.maxAmmo, player.weapons.electro.ammo + 30);
          player.weapons.grenade.ammo = Math.min(player.weapons.grenade.maxAmmo, player.weapons.grenade.ammo + 4);
        }

        pick.respawnTimer = 18; // 18 seconds respawn queue
      }
    });
  }

  private pushFrag(killer: string, victim: string, weapon: WeaponType) {
    this.state.fragFeed.push({
      id: Math.random().toString(36).substr(2, 9),
      killer,
      victim,
      weapon,
      timestamp: Date.now(),
    });

    if (this.state.fragFeed.length > 5) {
      this.state.fragFeed.shift();
    }
  }

  // Pure wall geometries bound checks
  private checkWallCollision(pos: { x: number; y: number; z: number }, radius: number): boolean {
    for (const wall of this.walls) {
      const halfSize = { x: wall.size.x / 2, y: wall.size.y / 2, z: wall.size.z / 2 };
      
      const inX = pos.x + radius > wall.pos.x - halfSize.x && pos.x - radius < wall.pos.x + halfSize.x;
      const inY = pos.y + radius > wall.pos.y - halfSize.y && pos.y - radius < wall.pos.y + halfSize.y;
      const inZ = pos.z + radius > wall.pos.z - halfSize.z && pos.z - radius < wall.pos.z + halfSize.z;

      if (inX && inY && inZ) {
        return true;
      }
    }
    return false;
  }

  private checkWallAxisBound(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }, axis: 'x' | 'y' | 'z', radius: number): boolean {
    let touchedFloor = false;

    // Check boundary box
    const playAreaSize = 38.5;
    if (axis === 'x') {
      if (pos.x < -playAreaSize + radius) { pos.x = -playAreaSize + radius; vel.x *= -0.2; }
      if (pos.x > playAreaSize - radius) { pos.x = playAreaSize - radius; vel.x *= -0.2; }
    } else if (axis === 'z') {
      if (pos.z < -playAreaSize + radius) { pos.z = -playAreaSize + radius; vel.z *= -0.2; }
      if (pos.z > playAreaSize - radius) { pos.z = playAreaSize - radius; vel.z *= -0.2; }
    } else if (axis === 'y') {
      if (pos.y < 1.0) { pos.y = 1.0; vel.y = 0; touchedFloor = true; } // ground floor
      if (pos.y > 40) { pos.y = 40; vel.y = 0; }
    }

    // Check dynamic wall objects
    for (const wall of this.walls) {
      // Skip X/Z collision for floors, bridges, roofs, and decorative neons to avoid getting stuck or teleported
      const isPlatform = 
        wall.id.startsWith('floor') || 
        wall.id.startsWith('bridge') || 
        wall.id.endsWith('roof') || 
        !!wall.emissive;
      
      if ((axis === 'x' || axis === 'z') && isPlatform) {
        continue;
      }

      const hX = wall.size.x / 2;
      const hY = wall.size.y / 2;
      const hZ = wall.size.z / 2;

      const inX = pos.x + radius >= wall.pos.x - hX && pos.x - radius <= wall.pos.x + hX;
      const inY = pos.y + radius >= wall.pos.y - hY && pos.y - radius <= wall.pos.y + hY;
      const inZ = pos.z + radius >= wall.pos.z - hZ && pos.z - radius <= wall.pos.z + hZ;

      if (inX && inY && inZ) {
        if (axis === 'x') {
          const pushDir = pos.x > wall.pos.x ? 1 : -1;
          pos.x = wall.pos.x + pushDir * (hX + radius);
          vel.x *= -0.1;
        } else if (axis === 'z') {
          const pushDir = pos.z > wall.pos.z ? 1 : -1;
          pos.z = wall.pos.z + pushDir * (hZ + radius);
          vel.z *= -0.1;
        } else if (axis === 'y') {
          const pushDir = pos.y > wall.pos.y ? 1 : -1;
          pos.y = wall.pos.y + pushDir * (hY + radius);
          vel.y = 0;
          if (pushDir > 0) {
            touchedFloor = true;
          }
        }
      }
    }

    return touchedFloor;
  }

  private checkCollisions() {
    // Entities interactions if any
  }

  private createNpcs(): PeacefulNpc[] {
    const spawned: PeacefulNpc[] = [];
    const npcNames = [
      '마을 주민 김씨 👨',
      '여행자 박씨 🎒',
      '대장장이 이씨 🔨',
      '약초학자 최씨 🌿',
      '나무꾼 정씨 🪓',
      '정원사 강씨 🌻',
      '음악가 조씨 🎵'
    ];
    const npcPositions = [
      { x: -8, y: 1.0, z: -12 },
      { x: 15, y: 1.0, z: -15 },
      { x: -20, y: 1.0, z: 18 },
      { x: 22, y: 1.0, z: 10 },
      { x: 2, y: 1.0, z: 26 },
      { x: -15, y: 1.0, z: -25 },
      { x: 18, y: 1.0, z: 22 }
    ];
    const genders: ('man' | 'woman' | 'child' | 'elder')[] = ['man', 'woman', 'child', 'elder', 'man', 'woman', 'elder'];
    const clothesColors = [
      '#4f46e5', // indigo
      '#059669', // emerald
      '#db2777', // rose pink
      '#d97706', // amber
      '#0284c7', // sky blue
      '#8b5cf6', // purple
      '#ef4444'  // red
    ];

    for (let i = 0; i < npcNames.length; i++) {
      spawned.push({
        id: `npc_${i}`,
        name: npcNames[i],
        pos: { ...npcPositions[i] },
        vel: { x: 0, y: 0, z: 0 },
        angle: Math.random() * Math.PI * 2,
        gender: genders[i],
        clothesColor: clothesColors[i],
        wanderTimer: Math.random() * 3 + 1
      });
    }
    return spawned;
  }

  private updateNpcs(dt: number) {
    if (!this.state.npcs) {
      this.state.npcs = this.createNpcs();
    }

    // NPCs only operate / wander around in the peaceful world!
    if (this.state.dimension !== 'peaceful' || this.isFrozen) {
      this.state.npcs.forEach(npc => {
        npc.vel.x = 0;
        npc.vel.y = 0;
        npc.vel.z = 0;
      });
      return;
    }

    this.state.npcs.forEach(npc => {
      npc.wanderTimer -= dt;
      if (npc.wanderTimer <= 0) {
        npc.wanderTimer = Math.random() * 4 + 2; // wander for 2 to 6 seconds
        if (Math.random() < 0.35) {
          // Stay standing in place peacefully
          npc.vel.x = 0;
          npc.vel.z = 0;
        } else {
          // Walk peacefully in a random direction (and absolutely NEVER follow the player!)
          npc.angle = Math.random() * Math.PI * 2;
          const walkSpeed = Math.random() * 1.5 + 1.2; // slow and gentle stroll
          npc.vel.x = Math.sin(npc.angle) * walkSpeed;
          npc.vel.z = Math.cos(npc.angle) * walkSpeed;
        }
      }

      // Add standard gravity to ground them properly
      npc.vel.y += this.gravity * dt;

      // Update position coordinates with collision checks against walls
      npc.pos.x += npc.vel.x * dt;
      this.checkWallAxisBound(npc.pos, npc.vel, 'x', 0.8);

      npc.pos.y += npc.vel.y * dt;
      const onFloor = this.checkWallAxisBound(npc.pos, npc.vel, 'y', 1.6);
      if (onFloor) {
        npc.vel.y = 0;
      }

      npc.pos.z += npc.vel.z * dt;
      this.checkWallAxisBound(npc.pos, npc.vel, 'z', 0.8);

      // Level Boundaries boundary protection
      if (npc.pos.x < -37.5) { npc.pos.x = -37.5; npc.vel.x *= -1; }
      if (npc.pos.x > 37.5) { npc.pos.x = 37.5; npc.vel.x *= -1; }
      if (npc.pos.z < -37.5) { npc.pos.z = -37.5; npc.vel.z *= -1; }
      if (npc.pos.z > 37.5) { npc.pos.z = 37.5; npc.vel.z *= -1; }
      if (npc.pos.y < 1.0) {
        npc.pos.y = 1.0;
        npc.vel.y = 0;
      }
    });
  }
}
