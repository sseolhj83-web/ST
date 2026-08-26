/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XonoticGameState, Bot, JumpPad, PickupItem, MapWall } from './xonoticTypes';
import { getXonoticMap, generateStreamedChunk, isHubChunk, chunkKey, CHUNK_SIZE, CHUNK_LOAD_RADIUS, ESCAPE_WALL_ID, ESCAPE_WALL_POS, SPAWN_POINT, WALL_H } from './xonoticMap';

export class XonoticEngine {
  public state: XonoticGameState;
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
  private timeoutManifested: boolean = false;
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
        onGround: false,
        score: 0,
        deaths: 0,
      },
      bots: this.createMonster(),
      pickups: JSON.parse(JSON.stringify(this.pickups)), // deep clone initial states
      fragFeed: [],
      matchTime: 0,
      monsterWarning: false,
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
      radius: 1.15, // bigger than the player's own 0.8 collision radius
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
    dt: number
  ) {
    const { player } = this.state;

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

    // Hard cap on total horizontal speed, enforced every frame (not just at the moment of a jump
    // press). Air-strafing can otherwise build speed past maxBhopSpeed without bound while
    // airborne — collision below is a discrete per-frame AABB check, not swept/continuous, so a
    // fast enough single-frame move can skip clean through a wall before ever registering as
    // overlapping it. This is what let running-and-jumping at a wall phase through it.
    const horizSpeed = Math.sqrt(player.vel.x * player.vel.x + player.vel.z * player.vel.z);
    if (horizSpeed > this.maxBhopSpeed) {
      const scale = this.maxBhopSpeed / horizSpeed;
      player.vel.x *= scale;
      player.vel.z *= scale;
    }

    // Integrate gravity
    player.vel.y += this.gravity * dt;
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
    this.updatePickups(dt);
    this.checkEscapeWall();
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

  // 7 minutes with no escape: the monster manifests somewhere within 5m of the player and relentlessly
  // hunts them down. It doesn't teleport right on top of / directly in front of them, and it still has
  // to actually close the distance and be seen (same line-of-sight + view-cone rule as any other kill)
  // — no free damage just because the timer ran out. Only fires once; after that the normal hunting AI
  // takes over.
  private checkTimeoutDeath() {
    const { player } = this.state;
    if (this.state.escaped || player.health <= 0 || this.state.matchTime < 420) return;
    if (this.timeoutManifested) return;
    this.timeoutManifested = true;

    const monster = this.state.bots.find(b => b.isMonster);
    if (monster) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * 3; // 2-5m away, in a random direction
      monster.pos = { x: player.pos.x + Math.cos(angle) * dist, y: player.pos.y, z: player.pos.z + Math.sin(angle) * dist };
      monster.isHidden = false;
      monster.state = 'hunting';
      monster.stateTimer = 9999; // never gives up and goes back to lurking once manifested
    }
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
        if (remoteData.username) remotePlayer.name = remoteData.username;
      })
      .subscribe();
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
      this.checkWallAxisBound(bot.pos, bot.vel, 'x', 1.2);
      bot.pos.y += bot.vel.y * dt;
      let botOnGround = this.checkWallAxisBound(bot.pos, bot.vel, 'y', 2.0);

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

      // Kill on contact while hunting — distToPlayer alone is a straight-line XZ distance that
      // ignores geometry, so without the line-of-sight check the monster could "touch" the player
      // through a thin wall separating two adjacent corridors, dealing damage the player never saw
      // coming from anything. Also requires the monster to be within the player's actual view cone
      // (not just the front 180° hemisphere, which is wider than the camera's ~85° FOV and let hits
      // land from just outside the screen edge) — it has to be somewhere the player could actually see it.
      if (bot.state === 'hunting' && distToPlayer < 2.2 && this.hasClearLineOfSight(bot.pos, player.pos)) {
        const forwardX = Math.sin(player.yaw);
        const forwardZ = -Math.cos(player.yaw);
        const facingDot = distToPlayer > 0.001 ? (-pdx / distToPlayer) * forwardX + (-pdz / distToPlayer) * forwardZ : 1;
        const VIEW_CONE_COS = 0.5; // ~60° half-angle, inside the rendered camera frustum
        if (facingDot > VIEW_CONE_COS) {
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
      this.pushFrag(killerName, 'You');
      
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
        }

        pick.respawnTimer = 18; // 18 seconds respawn queue
      }
    });
  }

  private pushFrag(killer: string, victim: string) {
    this.state.fragFeed.push({
      id: Math.random().toString(36).substr(2, 9),
      killer,
      victim,
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
