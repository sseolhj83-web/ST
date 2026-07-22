/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XonoticGameState, Player3D, Bot, Projectile, WeaponType, JumpPad, PickupItem, MapWall, FragLog } from './xonoticTypes';
import { getXonoticMap, generateStreamedChunk, isHubChunk, chunkKey, CHUNK_SIZE, CHUNK_LOAD_RADIUS, ESCAPE_WALL_ID, ESCAPE_WALL_POS, RED_ROOM_CENTER, RED_ROOM_RADIUS, SPAWN_POINT, WALL_H } from './xonoticMap';

export class XonoticEngine {
  public state: XonoticGameState;
  public isFrozen: boolean = false;
  public roomId: string | null = null;
  public userId: string | null = null;
  public username: string | null = null;
  public supabaseChannel: any = null;
  private walls: MapWall[] = [];
  private jumpPads: JumpPad[] = [];
  private pickups: PickupItem[] = [];
  private loadedStreamChunks: Map<string, MapWall[]> = new Map();
  private lastUpdate: number = 0;
  private lastStreamCx: number = Number.NaN;
  private lastStreamCz: number = Number.NaN;
  private onStateChange: (state: XonoticGameState) => void;

  // Arena Physics parameters (highly responsive like standard Quake/Xonotic engines)
  private readonly gravity = -42;
  private readonly maxGroundSpeed = 15;
  private readonly maxAirSpeed = 22;
  private readonly groundAccel = 90;
  private readonly airAccel = 35;
  private readonly groundFriction = 7.5;
  private readonly jumpForce = 15;
  private readonly maxBhopSpeed = 40; // hard cap on horizontal speed so chained bunny-hops can't build up
                                       // enough velocity to tunnel through a wall/ceiling in a single frame

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
        pos: { ...SPAWN_POINT },
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
          flamethrower: { type: 'flamethrower', name: '화염방사기', ammo: 150, maxAmmo: 150, fireRate: 60, lastFireTime: 0, damage: 12, color: '#f97316' },
        },
        currentWeapon: 'laser',
        onGround: false,
        score: 0,
        deaths: 0,
      },
      bots: this.createMonster(),
      projectiles: [],
      pickups: JSON.parse(JSON.stringify(this.pickups)), // deep clone initial states
      fragFeed: [],
      matchTime: 0,
      isFrozen: false,
      monsterWarning: false,
      inRedRoom: false,
      escaped: false,
    };
  }

  // The single, unkillable Backrooms entity. Starts far off and hidden — it only becomes visible
  // once updateMonsterAI decides to ambush the player.
  private createMonster(): Bot[] {
    return [{
      id: 'the_monster',
      name: '데모고르곤',
      pos: { x: 0, y: 2, z: -70 }, // opposite side of the open outer ring from spawn — clear of every maze wall
      vel: { x: 0, y: 0, z: 0 },
      health: 999999,
      maxHealth: 999999,
      color: '#050505',
      radius: 1.4, // bigger than the player's own 0.8 collision radius
      currentWeapon: 'laser',
      lastShootTime: 0,
      lastMeleeTime: 0,
      targetPos: null,
      state: 'wandering', // lurking
      stateTimer: 4 + Math.random() * 6,
      isMonster: true,
      invulnerable: true,
      isHidden: true,
    }];
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

        // Cap the stacked speed so chained hops can't grow it without bound (see maxBhopSpeed)
        const bhopSpeed = Math.sqrt(player.vel.x * player.vel.x + player.vel.z * player.vel.z);
        if (bhopSpeed > this.maxBhopSpeed) {
          const scale = this.maxBhopSpeed / bhopSpeed;
          player.vel.x *= scale;
          player.vel.z *= scale;
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

  // Keeps the maze loaded around wherever the player currently is, streaming in fresh procedural
  // chunks as they walk and dropping ones that fall well behind — the map has no edge. Short-circuits
  // unless the player has actually crossed into a new chunk, so standing still (e.g. pressed up
  // against a wall on a chunk boundary) never re-scans or reallocates anything.
  private updateStreamedChunks() {
    const { x, z } = this.state.player.pos;
    const pcx = Math.floor(x / CHUNK_SIZE);
    const pcz = Math.floor(z / CHUNK_SIZE);
    if (pcx === this.lastStreamCx && pcz === this.lastStreamCz) return;
    this.lastStreamCx = pcx;
    this.lastStreamCz = pcz;

    for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
      for (let dz = -CHUNK_LOAD_RADIUS; dz <= CHUNK_LOAD_RADIUS; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (isHubChunk(cx, cz)) continue;
        const key = chunkKey(cx, cz);
        if (this.loadedStreamChunks.has(key)) continue;

        const chunkWalls = generateStreamedChunk(cx, cz);
        this.loadedStreamChunks.set(key, chunkWalls);
        this.walls.push(...chunkWalls);
      }
    }

    const unloadDist = CHUNK_LOAD_RADIUS + 1;
    for (const key of Array.from(this.loadedStreamChunks.keys())) {
      const [cx, cz] = key.split('_').map(Number);
      if (Math.abs(cx - pcx) > unloadDist || Math.abs(cz - pcz) > unloadDist) {
        const chunkWalls = this.loadedStreamChunks.get(key)!;
        const ids = new Set(chunkWalls.map(w => w.id));
        this.walls = this.walls.filter(w => !ids.has(w.id));
        this.loadedStreamChunks.delete(key);
      }
    }
  }

  public stepSimulator(dt: number) {
    this.updateStreamedChunks();

    this.state.matchTime += dt;

    this.updatePlayerPhysics(dt);
    this.updateMonsterAI(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.checkEscapeWall();
    this.checkRedRoom(dt);
    this.checkTimeoutDeath();
    this.checkCollisions();

    // Broadcast player state to other players at ~30Hz
    if (this.supabaseChannel && Math.random() < 0.5) {
      this.broadcastPlayerState();
    }

    this.onStateChange({ ...this.state });
  }

  // Walking through the one flickering wall wins the run outright.
  private checkEscapeWall() {
    if (this.state.escaped) return;
    const { player } = this.state;
    const dx = player.pos.x - ESCAPE_WALL_POS.x;
    const dz = player.pos.z - ESCAPE_WALL_POS.z;
    if (Math.sqrt(dx * dx + dz * dz) < 2.2) {
      this.state.escaped = true;
    }
  }

  // The Red Room: step inside once and the curse is permanent for the rest of the run — a slow,
  // unstoppable health drain that no pickup can undo.
  private checkRedRoom(dt: number) {
    const { player } = this.state;
    if (!this.state.inRedRoom) {
      const dx = player.pos.x - RED_ROOM_CENTER.x;
      const dz = player.pos.z - RED_ROOM_CENTER.z;
      if (Math.sqrt(dx * dx + dz * dz) < RED_ROOM_RADIUS) {
        this.state.inRedRoom = true;
      }
    }
    if (this.state.inRedRoom && player.health > 0) {
      this.damagePlayer(dt * 15, 'red_room');
    }
  }

  // 7 minutes with no escape: the monster manifests right on top of the player and the run is over.
  private checkTimeoutDeath() {
    const { player } = this.state;
    if (this.state.escaped || player.health <= 0 || this.state.matchTime < 420) return;
    const monster = this.state.bots.find(b => b.isMonster);
    if (monster) {
      monster.isHidden = false;
      monster.state = 'hunting';
      monster.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z - 1.5 };
    }
    this.damagePlayer(9999, 'the_monster');
  }

  public connectRealtime(roomId: string, userId: string, supabaseClient: any, username: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.username = username;

    const channel = supabaseClient.channel(`play_${roomId}`);
    this.supabaseChannel = channel;

    channel
      .on('broadcast', { event: 'player-state' }, (payload: any) => {
        const remoteData = payload.payload;
        if (remoteData.id === this.userId) return; // Skip self

        // Find or create other player as a bot in state.bots
        let remotePlayer = this.state.bots.find(b => b.id === remoteData.id);
        if (!remotePlayer) {
          const newPlayerBot: Bot = {
            id: remoteData.id,
            name: remoteData.username || `Player_${remoteData.id.slice(0, 5)}`,
            pos: { x: remoteData.pos.x, y: remoteData.pos.y, z: remoteData.pos.z },
            vel: { x: remoteData.vel.x, y: remoteData.vel.y, z: remoteData.vel.z },
            health: remoteData.health,
            maxHealth: 100,
            color: '#3b82f6',
            radius: 0.8,
            currentWeapon: remoteData.currentWeapon,
            lastShootTime: 0,
            lastMeleeTime: 0,
            targetPos: null,
            state: 'wandering',
            stateTimer: 0,
            isTeammate: true,
            isRemotePlayer: true, // Real online player — no AI control
          };
          this.state.bots.push(newPlayerBot);
          remotePlayer = newPlayerBot;
        }

        // In-place update to preserve object reference stability
        remotePlayer.pos.x = remoteData.pos.x;
        remotePlayer.pos.y = remoteData.pos.y;
        remotePlayer.pos.z = remoteData.pos.z;
        remotePlayer.vel.x = remoteData.vel.x;
        remotePlayer.vel.y = remoteData.vel.y;
        remotePlayer.vel.z = remoteData.vel.z;
        remotePlayer.health = remoteData.health;
        remotePlayer.currentWeapon = remoteData.currentWeapon;
        if (remoteData.username) remotePlayer.name = remoteData.username;
      })
      .on('broadcast', { event: 'player-shoot' }, (payload: any) => {
        const remoteData = payload.payload;
        if (remoteData.id === this.userId) return; // Skip self

        // Spawn projectile on other player shoot
        this.spawnRemotePlayerProjectile(remoteData.id, remoteData.weapon, remoteData.pos, remoteData.yaw, remoteData.pitch);
      })
      .subscribe();
  }

  public spawnRemotePlayerProjectile(
    ownerId: string,
    weapon: WeaponType,
    pos: { x: number; y: number; z: number },
    yaw: number,
    pitch: number
  ) {
    const lookX = Math.sin(yaw) * Math.cos(pitch);
    const lookY = Math.sin(pitch);
    const lookZ = -Math.cos(yaw) * Math.cos(pitch);

    const weaponData = this.state.player.weapons[weapon];
    const damage = weaponData ? weaponData.damage : 15;
    const color = weaponData ? weaponData.color : '#06b6d4';

    if (weapon === 'vaporizer') {
      // Replicate Nex Laser Ray (instant hitscan line)
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'plasma',
        pos: { ...pos },
        vel: { x: lookX * 300, y: lookY * 300, z: lookZ * 300 },
        radius: 0.2,
        damage: 0,
        color: '#ec4899',
        ownerId: ownerId,
      });

      // Hitscan detection against the local player!
      const toPlayerX = this.state.player.pos.x - pos.x;
      const toPlayerY = (this.state.player.pos.y + 0.8) - pos.y;
      const toPlayerZ = this.state.player.pos.z - pos.z;
      
      const proj = toPlayerX * lookX + toPlayerY * lookY + toPlayerZ * lookZ;
      if (proj > 0 && proj < 120) {
        const perpX = toPlayerX - proj * lookX;
        const perpY = toPlayerY - proj * lookY;
        const perpZ = toPlayerZ - proj * lookZ;
        const distPerp = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);

        if (distPerp < 2.0) {
          this.damagePlayer(85, ownerId);
        }
      }

    } else if (weapon === 'rocket') {
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'rocket',
        pos: { ...pos },
        vel: { x: lookX * 180, y: lookY * 180, z: lookZ * 180 },
        radius: 0.8,
        damage: damage,
        color: color,
        ownerId: ownerId,
      });
    } else if (weapon === 'grenade') {
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'grenade',
        pos: { ...pos },
        vel: {
          x: lookX * 42,
          y: lookY * 42 + 7.5,
          z: lookZ * 42
        },
        radius: 0.6,
        damage: damage,
        color: color,
        ownerId: ownerId,
        bounces: 0,
        lifeTime: 2.2,
      });
    } else { // laser, electro
      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'plasma',
        pos: { ...pos },
        vel: { x: lookX * 450, y: lookY * 450, z: lookZ * 450 },
        radius: 0.4,
        damage: damage,
        color: color,
        ownerId: ownerId,
      });
    }
  }

  public broadcastPlayerState() {
    if (!this.supabaseChannel) return;
    const { player } = this.state;
    this.supabaseChannel.send({
      type: 'broadcast',
      event: 'player-state',
      payload: {
        id: this.userId,
        username: this.username || this.userId,
        pos: player.pos,
        vel: player.vel,
        yaw: player.yaw,
        pitch: player.pitch,
        currentWeapon: player.currentWeapon,
        health: player.health,
        score: player.score,
      }
    });
  }

  private updatePlayerPhysics(dt: number) {
    const { player } = this.state;

    // Apply simple boundary walls collision directly in X, Y, Z
    player.pos.x += player.vel.x * dt;
    this.checkWallAxisBound(player.pos, player.vel, 'x', 0.8);

    player.pos.y += player.vel.y * dt;
    player.onGround = this.checkWallAxisBound(player.pos, player.vel, 'y', 1.6);

    // Absolute fail-safe: Prevent falling below the floor (Y >= 1.0) under any circumstance
    if (player.pos.y < 1.0) {
      player.pos.y = 1.0;
      player.vel.y = 0;
      player.onGround = true;
    }

    player.pos.z += player.vel.z * dt;
    this.checkWallAxisBound(player.pos, player.vel, 'z', 0.8);

  }

  // The monster: lurks unseen somewhere loosely near the player, occasionally rolls the dice to
  // ambush (becomes visible and beelines for a kill), and gives up and vanishes again if it can't
  // catch them. Also still drives any real online players riding along in `bots` — those just get
  // dead-reckoning physics, no AI.
  private updateMonsterAI(dt: number) {
    if (this.isFrozen) {
      this.state.bots.forEach(b => { b.vel.x = 0; b.vel.y = 0; b.vel.z = 0; });
      return;
    }
    const { bots, player } = this.state;
    let nearestMonsterDist = Infinity;

    bots.forEach(bot => {
      // Remote online players: apply dead-reckoning physics only, no AI
      if (bot.isRemotePlayer) {
        bot.vel.y += this.gravity * dt;
        bot.pos.x += bot.vel.x * dt;
        bot.pos.y += bot.vel.y * dt;
        bot.pos.z += bot.vel.z * dt;
        if (bot.pos.y < 1.0) { bot.pos.y = 1.0; bot.vel.y = 0; }
        return;
      }
      if (!bot.isMonster) return;

      const pdx = player.pos.x - bot.pos.x;
      const pdz = player.pos.z - bot.pos.z;
      const distToPlayer = Math.sqrt(pdx * pdx + pdz * pdz);
      nearestMonsterDist = Math.min(nearestMonsterDist, distToPlayer);

      bot.stateTimer -= dt;

      // The monster is always kept on a short leash around the player — it never wanders far
      // enough to lose track of them. If something (a chase through the maze, a stream/unload
      // hiccup) ever pushes it past the leash radius, it drops whatever it was doing and beelines
      // back in, at a speed faster than the player's own top sprint so the gap always closes.
      const LEASH_RADIUS = 7;
      const isLeashPulling = distToPlayer > LEASH_RADIUS;

      if (isLeashPulling) {
        bot.targetPos = { ...player.pos };
      } else if (bot.state !== 'hunting') {
        // Lurking: drift to a spot within the leash, out of sight, and periodically roll for an ambush.
        if (bot.stateTimer <= 0) {
          bot.stateTimer = 2 + Math.random() * 3;
          const angle = Math.random() * Math.PI * 2;
          const dist = 3 + Math.random() * (LEASH_RADIUS - 3);
          bot.targetPos = { x: player.pos.x + Math.cos(angle) * dist, y: 1.5, z: player.pos.z + Math.sin(angle) * dist };

          if (Math.random() < 0.22) {
            bot.state = 'hunting';
            bot.isHidden = false;
            bot.stateTimer = 22; // gives up after this long if it can't catch the player
          }
        }
      } else {
        // Hunting: relentlessly close in on the player's current position.
        bot.targetPos = { ...player.pos };
        if (bot.stateTimer <= 0) {
          bot.state = 'wandering'; // back to lurking
          bot.isHidden = true;
          bot.stateTimer = 8 + Math.random() * 12;
        }
      }

      const targetCoords = bot.targetPos || { x: player.pos.x, y: 1.5, z: player.pos.z };
      const dx = targetCoords.x - bot.pos.x;
      const dz = targetCoords.z - bot.pos.z;
      const distToGoal = Math.sqrt(dx * dx + dz * dz);

      // Slightly slower than the player's top sprint speed while hunting normally — outrunning it
      // is possible, but risky. Leash-pulling overrides this with a speed above the player's max so
      // straying past the leash radius is always temporary.
      const monsterSpeed = isLeashPulling ? this.maxGroundSpeed * 1.3
        : bot.state === 'hunting' ? this.maxGroundSpeed * 0.82
        : 5.5;
      if (distToGoal > 1.0) {
        bot.vel.x = (dx / distToGoal) * monsterSpeed;
        bot.vel.z = (dz / distToGoal) * monsterSpeed;
      } else {
        bot.vel.x = 0;
        bot.vel.z = 0;
      }

      // Apply physics
      bot.vel.y += this.gravity * dt;
      bot.pos.x += bot.vel.x * dt;
      this.checkWallAxisBound(bot.pos, bot.vel, 'x', 1.5);
      bot.pos.y += bot.vel.y * dt;
      let botOnGround = this.checkWallAxisBound(bot.pos, bot.vel, 'y', 2.3);

      if (bot.pos.y < 1.0) {
        bot.pos.y = 1.0;
        bot.vel.y = 0;
        botOnGround = true;
      }

      bot.pos.z += bot.vel.z * dt;
      this.checkWallAxisBound(bot.pos, bot.vel, 'z', 1.5);

      if (botOnGround) {
        bot.vel.y = 0;
      }

      // Kill on contact while hunting — distToPlayer alone is a straight-line XZ distance that
      // ignores geometry, so without the line-of-sight check the monster could "touch" the player
      // through a thin wall separating two adjacent corridors, dealing damage the player never saw
      // coming from anything. Also requires the monster to be somewhere in front of the player (not
      // a blind-spot attack from directly behind) — it still has to close in on a side the player
      // could see coming.
      if (bot.state === 'hunting' && distToPlayer < 2.2 && this.hasClearLineOfSight(bot.pos, player.pos)) {
        const forwardX = Math.sin(player.yaw);
        const forwardZ = -Math.cos(player.yaw);
        const facingDot = distToPlayer > 0.001 ? (-pdx / distToPlayer) * forwardX + (-pdz / distToPlayer) * forwardZ : 1;
        if (facingDot > 0) {
          this.damagePlayer(9999, bot.id);
        }
      }
    });

    this.state.monsterWarning = nearestMonsterDist < 3;
  }

  // 2D (XZ) segment-vs-wall visibility check via the slab method — used to stop the monster from
  // "touching" the player through a wall it's actually standing on the other side of. Floors,
  // ceilings, light fixtures and the escape wall don't block a horizontal sightline.
  private hasClearLineOfSight(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): boolean {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    for (const wall of this.walls) {
      if (wall.id === ESCAPE_WALL_ID || wall.emissive) continue;
      const isPlatform =
        wall.id.startsWith('floor') ||
        wall.id.startsWith('bridge') ||
        wall.id.endsWith('roof') ||
        wall.id.endsWith('ceiling') ||
        wall.id === 'ceiling_main';
      if (isPlatform) continue;

      const hX = wall.size.x / 2;
      const hZ = wall.size.z / 2;
      const minX = wall.pos.x - hX, maxX = wall.pos.x + hX;
      const minZ = wall.pos.z - hZ, maxZ = wall.pos.z + hZ;

      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-6) {
        if (from.x < minX || from.x > maxX) continue;
      } else {
        let t1 = (minX - from.x) / dx;
        let t2 = (maxX - from.x) / dx;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-6) {
        if (from.z < minZ || from.z > maxZ) continue;
      } else {
        let t1 = (minZ - from.z) / dz;
        let t2 = (maxZ - from.z) / dz;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (tmin <= tmax) return false;
    }
    return true;
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

      this.state.bots.forEach(bot => {
        if (bot.invulnerable) return; // the monster can't be hit by anything
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
    } else if (player.currentWeapon === 'flamethrower') {
      // Short, slow-moving fire puffs with a small random spread and a short lifespan —
      // combined with the very high fire rate this reads as a continuous close-range flame stream.
      const spread = 0.06;
      const spreadYaw = player.yaw + (Math.random() - 0.5) * spread;
      const spreadPitch = player.pitch + (Math.random() - 0.5) * spread;
      const fLookX = Math.sin(spreadYaw) * Math.cos(spreadPitch);
      const fLookY = Math.sin(spreadPitch);
      const fLookZ = -Math.cos(spreadYaw) * Math.cos(spreadPitch);

      this.state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'plasma',
        pos: { x: playerEyeX, y: playerEyeY, z: playerEyeZ },
        vel: { x: fLookX * 18, y: fLookY * 18, z: fLookZ * 18 },
        radius: 0.55,
        damage: w.damage,
        color: '#f97316',
        ownerId: 'player',
        lifeTime: 0.35, // burns out after a short distance instead of flying across the map
      });
    }

    if (owner === 'player' && this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'player-shoot',
        payload: {
          id: this.userId,
          weapon: player.currentWeapon,
          pos: { x: playerEyeX, y: playerEyeY, z: playerEyeZ },
          yaw: player.yaw,
          pitch: player.pitch,
        }
      });
    }
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
      } else if (p.lifeTime !== undefined) {
        // Generic short-range expiry for non-grenade projectiles (e.g. flamethrower puffs) —
        // grenades manage their own fuse above, everything else just fizzles out silently.
        p.lifeTime -= dt;
        if (p.lifeTime <= 0) return false;
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
        for (let i = 0; i < bots.length; i++) {
          const b = bots[i];
          if (b.isTeammate || b.invulnerable) continue; // Skip teammates and the unkillable monster

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

        // Push always applies, even to the invulnerable monster — it staggers, it just never dies.
        const pX = bot.pos.x - pos.x;
        const pY = bot.pos.y - pos.y;
        const pZ = bot.pos.z - pos.z;
        const pDist = Math.sqrt(pX * pX + pY * pY + pZ * pZ) || 1;

        bot.vel.x += (pX / pDist) * 35 * effectFactor;
        bot.vel.y += (pY / pDist) * 35 * effectFactor;
        bot.vel.z += (pZ / pDist) * 35 * effectFactor;

        if (bot.invulnerable) return;

        // 1-hit kill sniper effect if the player fired the rocket!
        const appliedDmg = ownerId === 'player' ? 9999 : 65 * effectFactor;
        bot.health -= appliedDmg;

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

        // Push always applies, even to the invulnerable monster — it staggers, it just never dies.
        const pX = bot.pos.x - pos.x;
        const pY = bot.pos.y - pos.y;
        const pZ = bot.pos.z - pos.z;
        const pDist = Math.sqrt(pX * pX + pY * pY + pZ * pZ) || 1;

        bot.vel.x += (pX / pDist) * 45 * effectFactor;
        bot.vel.y += (pY / pDist) * 45 * effectFactor;
        bot.vel.z += (pZ / pDist) * 45 * effectFactor;

        if (bot.invulnerable) return;

        // Standard 1-hit kill factor if the player threw it!
        const appliedDmg = ownerId === 'player' ? 9999 : 80 * effectFactor;
        bot.health -= appliedDmg;

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
      if (wall.id === ESCAPE_WALL_ID) continue; // not a real wall — projectiles pass through it too
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

  private checkWallAxisBound(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }, axis: 'x' | 'y' | 'z', radius: number, skipCollisionOnly = false): boolean {
    let touchedFloor = false;

    // No horizontal boundary clamp — the maze streams outward forever (see updateStreamedChunks),
    // so there is no edge of the map to bound the player against.
    if (axis === 'y') {
      if (pos.y < 1.0) { pos.y = 1.0; vel.y = 0; touchedFloor = true; } // ground floor
      // Absolute fail-safe ceiling clamp — mirrors the floor clamp above. Without this, a big
      // enough single-frame vertical jump (rocket/grenade splash, chained bunny-hops) can move the
      // player past the thin ceiling slab before the wall-overlap check below ever sees it, letting
      // them fly around in the void above the map. The room is never taller than WALL_H anywhere.
      const ceilingY = WALL_H - 0.3;
      if (pos.y > ceilingY) { pos.y = ceilingY; vel.y = Math.min(vel.y, 0); }
    }

    // Check dynamic wall objects
    for (const wall of this.walls) {
      // The escape wall is a trigger, not a wall — walk straight through it (see checkEscapeWall)
      if (wall.id === ESCAPE_WALL_ID) continue;
      // NPCs skip collisionOnly building walls (they can enter buildings; lab walls are not collisionOnly)
      if (skipCollisionOnly && wall.collisionOnly) continue;

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
        // Push out by a hair more than exact contact (skin margin) so the position doesn't rest
        // exactly on the boundary — sitting exactly on it made the overlap test flip in/out from
        // floating-point rounding alone, re-triggering this branch every frame and reading as the
        // player being stuck/juddering inside the wall.
        const skin = 0.02;
        if (axis === 'x') {
          const pushDir = pos.x > wall.pos.x ? 1 : -1;
          pos.x = wall.pos.x + pushDir * (hX + radius + skin);
          // Kill the incoming velocity instead of bouncing it back — a bounce plus held movement
          // input re-drove the player into the wall next frame, then bounced again, forever.
          vel.x = 0;
        } else if (axis === 'z') {
          const pushDir = pos.z > wall.pos.z ? 1 : -1;
          pos.z = wall.pos.z + pushDir * (hZ + radius + skin);
          vel.z = 0;
        } else if (axis === 'y') {
          const pushDir = pos.y > wall.pos.y ? 1 : -1;
          pos.y = wall.pos.y + pushDir * (hY + radius + skin);
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

}
