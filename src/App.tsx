/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XonoticEngine } from './game/xonoticEngine';
import { XonoticGameState, WeaponType } from './game/xonoticTypes';
import { XonoticCanvas } from './components/XonoticCanvas';
import { XonoticHUD } from './components/XonoticHUD';
import { RotateCcw, Play, Compass, Award, ShieldAlert } from 'lucide-react';

type AppState = 'MENU' | 'PLAYING';

export default function App() {
  const [appState, setAppState] = useState<AppState>('MENU');
  const [gameState, setGameState] = useState<XonoticGameState | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [gameResult, setGameResult] = useState<'NONE' | 'VICTORY' | 'DEFEAT'>('NONE');

  const engineRef = useRef<XonoticEngine | null>(null);
  const gameStateRef = useRef<XonoticGameState | null>(null);
  const keysRef = useRef({ w: false, s: false, a: false, d: false, space: false, arrowleft: false, arrowright: false, arrowup: false, arrowdown: false });
  const mouseDeltaRef = useRef({ dx: 0, dy: 0 });
  const isMouseDownRef = useRef(false);
  const isRightMouseDownRef = useRef(false);
  const lastTimeRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const appStateRef = useRef<AppState>('MENU');

  // Keep appState synced with ref for thread-safe tick loop reading
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // Initialize key listeners once. Bound to engineRef.current dynamically to avoid stale closures
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      if (code === 'KeyW' || key === 'w' || key === 'ㅈ') keysRef.current.w = true;
      if (code === 'KeyS' || key === 's' || key === 'ㄴ') keysRef.current.s = true;
      if (code === 'KeyA' || key === 'a' || key === 'ㅁ') keysRef.current.a = true;
      if (code === 'KeyD' || key === 'd' || key === 'ㅇ') keysRef.current.d = true;
      if (code === 'Space') {
        keysRef.current.space = true;
        e.preventDefault(); // prevent scroll jump
      }
      
      // Arrow keys for turning assistance
      if (code === 'ArrowLeft') { keysRef.current.arrowleft = true; e.preventDefault(); }
      if (code === 'ArrowRight') { keysRef.current.arrowright = true; e.preventDefault(); }
      if (code === 'ArrowUp') { keysRef.current.arrowup = true; e.preventDefault(); }
      if (code === 'ArrowDown') { keysRef.current.arrowdown = true; e.preventDefault(); }

      // Gun Hotkeys - dynamic delegation prevents stale closure gaps
      if (key === '1') engineRef.current?.changeWeapon('laser');
      if (key === '2') engineRef.current?.changeWeapon('vaporizer');
      if (key === '3') engineRef.current?.changeWeapon('rocket');
      if (key === '4') engineRef.current?.changeWeapon('electro');
      if (key === '5') engineRef.current?.changeWeapon('grenade');

      // Time Freeze Hotkey
      if (code === 'KeyF' || key === 'f' || key === 'ㄹ') {
        engineRef.current?.toggleFreeze();
      }

      // Dimension Shift Hotkey (P / T)
      if (code === 'KeyP' || key === 'p' || key === 'ㅔ' || code === 'KeyT' || key === 't' || key === 'ㅅ') {
        engineRef.current?.toggleDimension();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      if (code === 'KeyW' || key === 'w' || key === 'ㅈ') keysRef.current.w = false;
      if (code === 'KeyS' || key === 's' || key === 'ㄴ') keysRef.current.s = false;
      if (code === 'KeyA' || key === 'a' || key === 'ㅁ') keysRef.current.a = false;
      if (code === 'KeyD' || key === 'd' || key === 'ㅇ') keysRef.current.d = false;
      if (code === 'Space') keysRef.current.space = false;
      
      if (code === 'ArrowLeft') keysRef.current.arrowleft = false;
      if (code === 'ArrowRight') keysRef.current.arrowright = false;
      if (code === 'ArrowUp') keysRef.current.arrowup = false;
      if (code === 'ArrowDown') keysRef.current.arrowdown = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownRef.current = true;
      } else if (e.button === 2) {
        isRightMouseDownRef.current = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownRef.current = false;
      } else if (e.button === 2) {
        isRightMouseDownRef.current = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Sync highscore
  useEffect(() => {
    if (gameState && gameState.player.score > highScore) {
      setHighScore(gameState.player.score);
    }
  }, [gameState, highScore]);

  // Main game tick animation frame
  const tick = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }
    const dt = Math.min(0.03, (timestamp - lastTimeRef.current) / 1000); // capped max delta to avoid huge physics warp
    lastTimeRef.current = timestamp;

    const engine = engineRef.current;
    if (engine && appStateRef.current === 'PLAYING') {
      // 1. Victory condition: All enemies are dead (Teammates are excluded)!
      const enemiesCount = engine.state.bots.filter(b => !b.isTeammate).length;
      if (enemiesCount === 0) {
        setGameResult('VICTORY');
        setAppState('MENU');
        return; // Break frame simulation
      }

      // 2. Defeat condition: Player died (HP reached zero)!
      if (engine.state.player.health <= 0) {
        setGameResult('DEFEAT');
        setAppState('MENU');
        return; // Break frame simulation
      }

      // 3. Match Time Limit condition: 7 minutes (420 seconds)
      if (engine.state.matchTime >= 420) {
        setGameResult('VICTORY'); // survive and win!
        setAppState('MENU');
        return; // Break frame simulation
      }

      // Step 1: Feed player view movement controls
      engine.updateInputs(
        keysRef.current,
        mouseDeltaRef.current.dx,
        mouseDeltaRef.current.dy,
        isMouseDownRef.current,
        isRightMouseDownRef.current,
        dt
      );
      // Reset mouse move delta registers after consuming
      mouseDeltaRef.current = { dx: 0, dy: 0 };

      // Step 2: Step bot mechanics & physics states
      engine.stepSimulator(dt);
    }

    animationFrameIdRef.current = requestAnimationFrame(tick);
  }, []);

  // Activate game renderer execution - completely re-instantiates the engine for clean isolation
  const startGame = useCallback(() => {
    const engine = new XonoticEngine((updatedState) => {
      gameStateRef.current = updatedState;
      setGameState({ ...updatedState });
    });
    engineRef.current = engine;
    gameStateRef.current = engine.state;
    setGameState(engine.state);
    
    // Smooth reset controls states
    keysRef.current = { w: false, s: false, a: false, d: false, space: false };
    mouseDeltaRef.current = { dx: 0, dy: 0 };
    isMouseDownRef.current = false;
    
    setGameResult('NONE');
    setAppState('PLAYING');
    lastTimeRef.current = performance.now();
    
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopGameToMenu = useCallback(() => {
    setGameResult('NONE');
    setAppState('MENU');
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
  }, []);

  const handlePointerLockChange = useCallback((locked: boolean) => {
    setIsPointerLocked(locked);
  }, []);

  const handleMouseMove = useCallback((dx: number, dy: number) => {
    // If aiming, drastically reduce camera lookaround speed for ultra pinpoint tracking precision
    const sensFactor = isRightMouseDownRef.current ? 0.35 : 1.0;
    mouseDeltaRef.current.dx += dx * sensFactor;
    mouseDeltaRef.current.dy += dy * sensFactor;
  }, []);

  return (
    <div className="w-full h-screen bg-slate-950 text-white select-none overflow-hidden relative">
      <AnimatePresence mode="wait">
        {appState === 'MENU' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black"
          >
            {/* Ambient glowing lines in background */}
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

            <div className="max-w-xl text-center relative z-10 w-full px-4">
              {/* Sci-Fi title heading */}
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="mb-8"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>3D SCI-FI ARENA SHOOTER</span>
                </div>
                <h1 className="text-6xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 leading-none">
                  XONOTIC
                </h1>
                <p className="text-sm font-light text-slate-400 mt-3 tracking-widest uppercase">
                  WEB INSTAGIB CHRONICLES
                </p>
              </motion.div>

              {/* Game Control Card panels */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl mb-8 text-left space-y-4"
              >
                <h3 className="text-cyan-400 font-bold uppercase tracking-wider text-sm border-b border-white/5 pb-2">
                  ARENA MECHANICS (아레나 조작법)
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-300">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-pink-400 block font-bold mb-1">WASD KEYS</span>
                    W, A, S, D 이동 (Korean ㅈ, ㄴ, ㅁ, ㅇ 지원)
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-cyan-400 block font-bold mb-1">STRAFE JUMP</span>
                    SPACEBAR 계속 입력 시 버니합 가속 (1000+ UPS!)
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-yellow-400 block font-bold mb-1">WEAPONS SWITCH</span>
                    1: 블래스터, 2: 넥스 레이저, 3: 로켓, 4: 일렉트로
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-purple-400 block font-bold mb-1">ROCKET JUMP</span>
                    발 밑에 로켓을 쏘며 점프하여 공중 발사!
                  </div>
                </div>
              </motion.div>

              {/* Score banner & Launch actions */}
              <div className="flex flex-col items-center gap-5">
                {highScore > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-medium">
                    <Award className="w-4 h-4 text-yellow-400" />
                    <span>최고 Frags 수: <strong className="font-black text-white">{highScore}</strong></span>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-10 py-5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 hover:opacity-90 rounded-2xl font-black text-xl italic uppercase tracking-wider shadow-[0_0_30px_rgba(6,182,212,0.3)] border border-cyan-400/20 active:scale-95 transition-all flex items-center gap-3 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  ENTER ARENA (경기장 입장)
                </motion.button>
              </div>
            </div>

            {/* Victory / Defeat Modal HUD Dialogues (Permanent Death / Finite bots result outcome) */}
            <AnimatePresence>
              {gameResult !== 'NONE' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-55 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                >
                  <motion.div
                    initial={{ scale: 0.92, y: 15 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 10 }}
                    className="max-w-md w-full bg-slate-900 border-2 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(0,0,0,0.85)] flex flex-col items-center gap-6 border-cyan-500/35"
                  >
                    {gameResult === 'VICTORY' ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/35 flex items-center justify-center text-emerald-400">
                          <Award className="w-9 h-9 fill-current animate-bounce" />
                        </div>
                        <div>
                          <h2 className="text-4xl font-black text-emerald-400 uppercase tracking-tighter">VICTORY (승리!)</h2>
                          <p className="text-sm font-sans mt-2 text-slate-400 font-medium leading-relaxed">적들을 완벽하게 섬멸했습니다. 아레나의 진정한 정복자입니다!</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/35 flex items-center justify-center text-rose-500">
                          <ShieldAlert className="w-9 h-9 animate-pulse" />
                        </div>
                        <div>
                          <h2 className="text-4xl font-black text-rose-500 uppercase tracking-tighter">DEFEAT (패배!)</h2>
                          <p className="text-sm font-sans mt-2 text-slate-400 font-medium leading-relaxed">전사하셨습니다. 이번 매치 플레이에서는 부활이 지원되지 않습니다.</p>
                        </div>
                      </>
                    )}

                    {/* Stats display block */}
                    <div className="w-full bg-slate-950 rounded-2xl border border-white/5 p-4 grid grid-cols-2 gap-4 font-mono text-xs">
                      <div className="text-left border-r border-white/5 pr-4 flex flex-col justify-center">
                        <span className="text-slate-500 text-[10px] uppercase block tracking-wider mb-0.5">ELIMINATIONS</span>
                        <span className="text-xl font-bold text-cyan-400">{gameState?.player.score} Frags</span>
                      </div>
                      <div className="text-left pl-2 flex flex-col justify-center">
                        <span className="text-slate-500 text-[10px] uppercase block tracking-wider mb-0.5">SURVIVED TIME</span>
                        <span className="text-xl font-bold text-white">
                          {gameState ? `${Math.floor(gameState.matchTime / 60)}분 ${Math.floor(gameState.matchTime % 60)}초` : '0초'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setGameResult('NONE')}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 hover:opacity-95 text-white font-mono rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all cursor-pointer shadow-xl border border-white/10"
                    >
                      확인 및 메인 로비
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}

        {appState === 'PLAYING' && gameState && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            {/* Custom high-performance 3D canvas rendering engine */}
            <XonoticCanvas
              state={gameState}
              gameStateRef={gameStateRef}
              onPointerLockChange={handlePointerLockChange}
              onMouseMove={handleMouseMove}
            />

            {/* Futuristic Sci-fi HUD element layout overlay with keys telemetry diagnostic */}
            <XonoticHUD
              player={gameState.player}
              bots={gameState.bots}
              fragFeed={gameState.fragFeed}
              matchTime={gameState.matchTime}
              isFrozen={gameState.isFrozen}
              dimension={gameState.dimension}
              onToggleDimension={() => engineRef.current?.toggleDimension()}
              activeKeys={{
                w: keysRef.current.w,
                a: keysRef.current.a,
                s: keysRef.current.s,
                d: keysRef.current.d,
                space: keysRef.current.space,
              }}
            />

            {/* Exit/Return button back to lobby menu */}
            <div className="absolute top-6 left-6 z-50 pointer-events-auto">
              <button
                onClick={stopGameToMenu}
                className="flex items-center gap-1.5 px-4 py-2 border border-white/10 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold uppercase transition-all tracking-wider font-mono cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                RETURN TO LOBBY
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
