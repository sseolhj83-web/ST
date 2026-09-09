/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XonoticGameState, Bot, JumpPad, PickupItem, MapWall } from './xonoticTypes';
import { getLevelModule, LevelModule, chunkKey } from './levels';

export class XonoticEngine {
  public state: XonoticGameState;
  public level: 1 | 2;
  private lvl: LevelModule;
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

  constructor(onStateChange: (state: XonoticGameState) => void, level: 1 | 2 = 1) {
    this.onStateChange = onStateChange;
    this.level = level;
    this.lvl = getLevelModule(level);
    const map = this.lvl.getMap();
    this.walls = map.walls;
    this.jumpPads = map.jumpPads;
    this.pickups = map.pickups;

    this.state = this.getInitialState();
  }

  private getInitialState(): XonoticGameState {
    return {
      player: {
        pos: { ...this.lvl.SPAWN_POINT },
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
      bots: this.createMonsters(),
      pickups: JSON.parse(JSON.stringify(this.pickups)), // deep clone initial states
      fragFeed: [],
      matchTime: 0,
      level: this.level,
      monsterWarning: false,
      escaped: false,
    };
  }

  // The 4 Level-2 guard posts — fixed points fanned across the approach to the exit, so the exit is
  // always ringed by a spread-out blockade the player has to break through. `packIndex` 1-4 map to
  // these. Kept as a method so spawn placement and the AI agree.
  private guardPost(packIndex: number): { x: number; z: number } {
    const exit = this.lvl.ESCAPE_WALL_POS;
    const spawn = this.lvl.SPAWN_POINT;
    // unit vector from the exit back toward spawn (the side the player approaches from) + its perp
    let ax = spawn.x - exit.x, az = spawn.z - exit.z;
    const al = Math.hypot(ax, az) || 1;
    ax /= al; az /= al;
    const px = az, pz = -ax; // perpendicular
    const FWD = [15, 10, 10, 15];   // how far out along the approach
    const LAT = [-11, -4, 4, 11];   // lateral spread
    const s = (packIndex - 1) % 4;
    return { x: exit.x + ax * FWD[s] + px * LAT[s], z: exit.z + az * FWD[s] + pz * LAT[s] };
  }

  // The Backrooms entities. Level 1: one lone stalker that lurks unseen and ambushes. Level 2: a
  // pack of 5 — index 0 is that same invisible stalker, indices 1-4 are visible guards that ring the
  // exit and try to cut off the escape (see updateMonsterAI).
  private createMonsters(): Bot[] {
    const count = this.level === 2 ? 5 : 1;
    const spawn = this.lvl.SPAWN_POINT;

    const monsters: Bot[] = [];
    for (let i = 0; i < count; i++) {
      // Level 1 keeps its lone monster's original far spawn. Level 2: index 0 = stalker near spawn,
      // 1-4 = guards spawned straight onto their posts by the exit.
      let px: number, pz: number;
      if (count === 1) {
        px = this.lvl.MONSTER_SPAWN.x;
        pz = this.lvl.MONSTER_SPAWN.z;
      } else if (i === 0) {
        px = spawn.x + 5;
        pz = spawn.z + 5;
      } else {
        const post = this.guardPost(i);
        px = post.x;
        pz = post.z;
      }
      monsters.push({
        id: count === 1 ? 'the_monster' : `the_monster_${i}`,
        name: '데모고르곤',
        pos: { x: px, y: 2, z: pz },
        vel: { x: 0, y: 0, z: 0 },
        health: 999999,
        maxHealth: 999999,
        color: '#050505',
        radius: 1.1 + (i % 3) * 0.07,
        lastMeleeTime: 0,
        targetPos: null,
        state: 'wandering',
        stateTimer: 3 + Math.random() * 6 + i * 1.4,
        isMonster: true,
        invulnerable: true,
        // Interceptors (1-4) are a visible blockade from the start; only the stalker (0) hides.
        isHidden: i === 0,
        packIndex: i,
      });
    }
    return monsters;
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
    const chunkSize = this.lvl.CHUNK_SIZE;
    const loadRadius = this.lvl.CHUNK_LOAD_RADIUS;
    const pcx = Math.floor(x / chunkSize);
    const pcz = Math.floor(z / chunkSize);
    if (pcx === this.lastStreamCx && pcz === this.lastStreamCz) return;
    this.lastStreamCx = pcx;
    this.lastStreamCz = pcz;

    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      for (let dz = -loadRadius; dz <= loadRadius; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (this.lvl.isHubChunk(cx, cz)) continue;
        const key = chunkKey(cx, cz);
        if (this.loadedStreamChunks.has(key)) continue;

        const chunkWalls = this.lvl.generateChunk(cx, cz);
        this.loadedStreamChunks.set(key, chunkWalls);
        this.walls.push(...chunkWalls);
      }
    }

    const unloadDist = loadRadius + 1;
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
    const dx = player.pos.x - this.lvl.ESCAPE_WALL_POS.x;
    const dz = player.pos.z - this.lvl.ESCAPE_WALL_POS.z;
    if (Math.sqrt(dx * dx + dz * dz) < 2.2) {
      this.state.escaped = true;
    }
  }

  // 7 minutes with no escape: every monster manifests within a few metres of the player and hunts
  // relentlessly. They don't teleport right on top of / directly in front of them, and still have to
  // close the distance and be seen (same line-of-sight + view-cone rule as any other kill) — no free
  // damage just because the timer ran out. Only fires once; after that the normal hunting AI takes over.
  private checkTimeoutDeath() {
    const { player } = this.state;
    if (this.state.escaped || player.health <= 0 || this.state.matchTime < 420) return;
    if (this.timeoutManifested) return;
    this.timeoutManifested = true;

    this.state.bots.filter(b => b.isMonster).forEach((monster, i, arr) => {
      const angle = (i / arr.length) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 2.5 + Math.random() * 3.5; // 2.5-6m away
      monster.pos = { x: player.pos.x + Math.cos(angle) * dist, y: player.pos.y, z: player.pos.z + Math.sin(angle) * dist };
      monster.isHidden = false;
      monster.state = 'hunting';
      monster.stateTimer = 9999; // never gives up once manifested
    });
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
    this.checkWallAxisBound(player.pos, player.vel, 'x', 0.8, 1.6);

    player.pos.y += player.vel.y * dt;
    player.onGround = this.checkWallAxisBound(player.pos, player.vel, 'y', 0.8, 1.6);

    // Absolute fail-safe: Prevent falling below the floor (Y >= 1.0) under any circumstance
    if (player.pos.y < 1.0) {
      player.pos.y = 1.0;
      player.vel.y = 0;
      player.onGround = true;
    }

    player.pos.z += player.vel.z * dt;
    this.checkWallAxisBound(player.pos, player.vel, 'z', 0.8, 1.6);

  }

  // Monster AI.
  //  - The stalker (Level 1's lone monster / Level 2 pack index 0) lurks unseen on a short leash and
  //    rolls to ambush, then vanishes again if it can't catch the player.
  //  - Level 2 interceptors (pack indices 1-4) are visible from the start and hold a fanned-out
  //    formation between the player and the exit — a moving blockade on the escape route. They charge
  //    when the player gets close or makes a break for the exit, and a separation force keeps the
  //    pack from ever bunching into a single clump.
  // Also drives any real online players riding along in `bots` (dead-reckoning physics, no AI).
  private updateMonsterAI(dt: number) {
    const { bots, player } = this.state;
    let nearestMonsterDist = Infinity;

    const exit = this.lvl.ESCAPE_WALL_POS;
    const playerExitDist = Math.hypot(exit.x - player.pos.x, exit.z - player.pos.z);
    const huntingCount = bots.filter(b => b.isMonster && b.state === 'hunting').length;
    const SEP = 5.5; // pack members repel each other within this radius — never a single clump

    bots.forEach(bot => {
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

      const isInterceptor = (bot.packIndex ?? 0) >= 1;
      let goalX: number, goalZ: number, speed: number;

      if (isInterceptor) {
        // Guard the exit. Off-alert it holds a post ringing the exit. As the player closes on the
        // exit it moves to interpose just in front of them; inside the commit radius it charges.
        const post = this.guardPost(bot.packIndex ?? 1);
        const alerted = playerExitDist < 42;
        const commit = playerExitDist < 24;

        if (bot.state === 'hunting') {
          goalX = player.pos.x; goalZ = player.pos.z;
          speed = this.maxGroundSpeed * 0.82;
          if (bot.stateTimer <= 0) {
            // stay committed while the player is still near the exit; otherwise fall back to post
            bot.state = 'wandering';
            bot.stateTimer = commit ? 0.4 : 2.5 + Math.random() * 3;
          }
        } else if (alerted) {
          // Interpose: a point ~30% of the way from the player toward the exit, offset to this
          // guard's side so the four spread across the approach instead of stacking.
          const s = ((bot.packIndex ?? 1) - 1) % 4;
          const lat = [-8, -3, 3, 8][s];
          let tx = exit.x - player.pos.x, tz = exit.z - player.pos.z;
          const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const ahead = Math.min(tl * 0.35, 13);
          goalX = player.pos.x + tx * ahead + tz * lat;
          goalZ = player.pos.z + tz * ahead - tx * lat;
          const arrive = Math.hypot(bot.pos.x - goalX, bot.pos.z - goalZ);
          speed = arrive < 1.2 ? 0 : Math.min(this.maxGroundSpeed, 6 + arrive * 0.5);
          if (bot.stateTimer <= 0) {
            bot.stateTimer = 0.8 + Math.random() * 1.2;
            if (commit || (distToPlayer < 11 && huntingCount < 3)) {
              bot.state = 'hunting';
              bot.stateTimer = 3.5 + Math.random() * 2.5;
            }
          }
        } else {
          goalX = post.x; goalZ = post.z;
          const arrive = Math.hypot(bot.pos.x - post.x, bot.pos.z - post.z);
          speed = arrive < 1.5 ? 0 : (arrive > 10 ? this.maxGroundSpeed : 4);
          if (bot.stateTimer <= 0) {
            bot.stateTimer = 1.5 + Math.random() * 2;
            if (distToPlayer < 8 && huntingCount < 2) {
              bot.state = 'hunting';
              bot.stateTimer = 3.5 + Math.random() * 2.5;
            }
          }
        }
      } else {
        // Stalker — lurk on a leash, occasionally ambush.
        const LEASH = 8;
        const leashPulling = distToPlayer > LEASH;
        if (leashPulling) {
          goalX = player.pos.x; goalZ = player.pos.z;
          speed = this.maxGroundSpeed * 1.3;
          bot.targetPos = { ...player.pos };
        } else if (bot.state !== 'hunting') {
          if (bot.stateTimer <= 0) {
            bot.stateTimer = 2 + Math.random() * 3;
            const angle = Math.random() * Math.PI * 2;
            const dist = 3 + Math.random() * (LEASH - 3);
            bot.targetPos = { x: player.pos.x + Math.cos(angle) * dist, y: 1.5, z: player.pos.z + Math.sin(angle) * dist };
            const maxHunters = this.level === 2 ? 3 : 1;
            if (Math.random() < 0.22 && huntingCount < maxHunters) {
              bot.state = 'hunting';
              bot.isHidden = false;
              bot.stateTimer = 22;
            }
          }
          goalX = bot.targetPos?.x ?? player.pos.x;
          goalZ = bot.targetPos?.z ?? player.pos.z;
          speed = 5.5;
        } else {
          goalX = player.pos.x; goalZ = player.pos.z;
          speed = this.maxGroundSpeed * 0.82;
          bot.targetPos = { ...player.pos };
          if (bot.stateTimer <= 0) {
            bot.state = 'wandering';
            bot.isHidden = true;
            bot.stateTimer = 8 + Math.random() * 12;
          }
        }
      }

      // Separation — repel from every other monster inside SEP so the pack fans out, never clumps.
      let sepX = 0, sepZ = 0;
      for (const other of bots) {
        if (other === bot || !other.isMonster) continue;
        const ox = bot.pos.x - other.pos.x, oz = bot.pos.z - other.pos.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.001 && od < SEP) {
          const f = (SEP - od) / SEP;
          sepX += (ox / od) * f;
          sepZ += (oz / od) * f;
        }
      }
      const sepMag = Math.hypot(sepX, sepZ);
      if (sepMag > 1) { sepX /= sepMag; sepZ /= sepMag; }

      // Blend: a unit vector toward the goal plus a BOUNDED separation nudge, so the pack fans out
      // without separation ever swamping the goal and flinging monsters across the map.
      let gdx = goalX - bot.pos.x, gdz = goalZ - bot.pos.z;
      const gdl = Math.hypot(gdx, gdz);
      const hasGoal = gdl > 0.8 && speed > 0.01;
      if (hasGoal) { gdx /= gdl; gdz /= gdl; } else { gdx = 0; gdz = 0; }

      if (!hasGoal && sepMag < 0.05) {
        bot.vel.x = 0; bot.vel.z = 0;               // parked on post, nobody crowding — hold still
      } else {
        const mvX = gdx + sepX * 0.45;
        const mvZ = gdz + sepZ * 0.45;
        const mvLen = Math.hypot(mvX, mvZ) || 1;
        const mvSpeed = hasGoal ? speed : 2.5;      // creep apart at walking pace when only separating
        bot.vel.x = (mvX / mvLen) * mvSpeed;
        bot.vel.z = (mvZ / mvLen) * mvSpeed;
      }
      bot.targetPos = { x: goalX, y: 1.5, z: goalZ };

      // Physics
      bot.vel.y += this.gravity * dt;
      bot.pos.x += bot.vel.x * dt;
      this.checkWallAxisBound(bot.pos, bot.vel, 'x', 1.2, 2.0);
      bot.pos.y += bot.vel.y * dt;
      let botOnGround = this.checkWallAxisBound(bot.pos, bot.vel, 'y', 1.2, 2.0);
      if (bot.pos.y < 1.0) { bot.pos.y = 1.0; bot.vel.y = 0; botOnGround = true; }
      bot.pos.z += bot.vel.z * dt;
      this.checkWallAxisBound(bot.pos, bot.vel, 'z', 1.2, 2.0);
      if (botOnGround) bot.vel.y = 0;

      // Kill on contact. Distances are recomputed AFTER this frame's move so a fast approach can't
      // tunnel past the check on a stale pre-move distance. Three zones:
      //  - Overlap (< 1.3u): bodies are interpenetrating. No sightline check — the segment between
      //    two overlapping points hugs whatever wall you're both standing against and the slab test
      //    wrongly reports it as blocking, which is exactly why "walked into the monster but didn't
      //    die" happened. If you're inside it, it has you.
      //  - Grab (1.3–1.7u): needs a clear sightline (so it can't grab through a thin wall from the
      //    next corridor) but no view-cone check — you can't fail to notice something on top of you.
      //  - Lunge (out to lungeRange): needs sightline AND to be inside your view cone, so sprinting
      //    past one with your eyes forward still lets you slip by.
      const isCharging = bot.state === 'hunting';
      const canGrab = isCharging || isInterceptor;
      const kdx = player.pos.x - bot.pos.x;
      const kdz = player.pos.z - bot.pos.z;
      const contactDist = Math.hypot(kdx, kdz);
      const lungeRange = isCharging ? 2.4 : (isInterceptor ? 2.0 : 0);
      if (canGrab) {
        if (contactDist < 1.3) {
          this.damagePlayer(9999, bot.id);
        } else if (this.hasClearLineOfSight(bot.pos, player.pos)) {
          if (contactDist < 1.7) {
            this.damagePlayer(9999, bot.id);
          } else if (lungeRange > 0 && contactDist < lungeRange) {
            const forwardX = Math.sin(player.yaw);
            const forwardZ = -Math.cos(player.yaw);
            const facingDot = contactDist > 0.001 ? (-kdx / contactDist) * forwardX + (-kdz / contactDist) * forwardZ : 1;
            if (facingDot > 0.4) {
              this.damagePlayer(9999, bot.id);
            }
          }
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
      if (wall.id === this.lvl.ESCAPE_WALL_ID || wall.emissive || wall.doorDecor) continue;
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
      if (wall.id === this.lvl.ESCAPE_WALL_ID) continue; // not a real wall — projectiles pass through it too
      if (wall.doorDecor) continue; // flush hotel door set-dressing — never collidable
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

  private checkWallAxisBound(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }, axis: 'x' | 'y' | 'z', lateralRadius: number, verticalRadius: number, skipCollisionOnly = false): boolean {
    let touchedFloor = false;

    // No horizontal boundary clamp — the maze streams outward forever (see updateStreamedChunks),
    // so there is no edge of the map to bound the player against.
    if (axis === 'y') {
      if (pos.y < 1.0) { pos.y = 1.0; vel.y = 0; touchedFloor = true; } // ground floor
      // Absolute fail-safe ceiling clamp — mirrors the floor clamp above. Without this, a big
      // enough single-frame vertical jump (rocket/grenade splash, chained bunny-hops) can move the
      // player past the thin ceiling slab before the wall-overlap check below ever sees it, letting
      // them fly around in the void above the map. The room is never taller than WALL_H anywhere.
      const ceilingY = this.lvl.WALL_H - 0.3;
      if (pos.y > ceilingY) { pos.y = ceilingY; vel.y = Math.min(vel.y, 0); }
    }

    // Check dynamic wall objects
    for (const wall of this.walls) {
      // The escape wall is a trigger, not a wall — walk straight through it (see checkEscapeWall)
      if (wall.id === this.lvl.ESCAPE_WALL_ID) continue;
      // Flush hotel-door set-dressing sits on a solid block face — never collide with it
      if (wall.doorDecor) continue;
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

      // X/Z overlap must always use the lateral radius and Y overlap the vertical radius,
      // regardless of which axis is currently being resolved. Reusing whichever single radius
      // this call happened to receive (as this used to do — the 'y' pass called in with the much
      // bigger vertical radius) made the X/Z overlap test far too generous during the vertical
      // pass, registering a "collision" against a wall the player was still clearly short of
      // laterally, and launching them straight up past the ceiling and clean over the wall. That
      // was the actual cause of running into a wall (with any vertical velocity at all, e.g. from
      // a jump) appearing to phase straight through it.
      const inX = pos.x + lateralRadius >= wall.pos.x - hX && pos.x - lateralRadius <= wall.pos.x + hX;
      const inY = pos.y + verticalRadius >= wall.pos.y - hY && pos.y - verticalRadius <= wall.pos.y + hY;
      const inZ = pos.z + lateralRadius >= wall.pos.z - hZ && pos.z - lateralRadius <= wall.pos.z + hZ;

      if (inX && inY && inZ) {
        // Push out by a hair more than exact contact (skin margin) so the position doesn't rest
        // exactly on the boundary — sitting exactly on it made the overlap test flip in/out from
        // floating-point rounding alone, re-triggering this branch every frame and reading as the
        // player being stuck/juddering inside the wall.
        const skin = 0.02;
        if (axis === 'x') {
          const pushDir = pos.x > wall.pos.x ? 1 : -1;
          pos.x = wall.pos.x + pushDir * (hX + lateralRadius + skin);
          // Kill the incoming velocity instead of bouncing it back — a bounce plus held movement
          // input re-drove the player into the wall next frame, then bounced again, forever.
          vel.x = 0;
        } else if (axis === 'z') {
          const pushDir = pos.z > wall.pos.z ? 1 : -1;
          pos.z = wall.pos.z + pushDir * (hZ + lateralRadius + skin);
          vel.z = 0;
        } else if (axis === 'y') {
          const pushDir = pos.y > wall.pos.y ? 1 : -1;
          pos.y = wall.pos.y + pushDir * (hY + verticalRadius + skin);
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
