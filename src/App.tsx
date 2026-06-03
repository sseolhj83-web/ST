import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XonoticEngine } from './game/xonoticEngine';
import { XonoticGameState } from './game/xonoticTypes';
import { XonoticCanvas } from './components/XonoticCanvas';
import { XonoticHUD } from './components/XonoticHUD';
import { RotateCcw, Award, ShieldAlert } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Auth } from './components/Auth';
import { Lobby } from './components/Lobby';

type AppState = 'AUTH' | 'LOBBY' | 'PLAYING';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [appState, setAppState] = useState<AppState>('AUTH');
  const [gameState, setGameState] = useState<XonoticGameState | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [gameResult, setGameResult] = useState<'NONE' | 'VICTORY' | 'DEFEAT'>('NONE');
  const [roomContext, setRoomContext] = useState<{ roomId: string; isHost: boolean; players: any[] } | null>(null);

  const engineRef = useRef<XonoticEngine | null>(null);
  const gameStateRef = useRef<XonoticGameState | null>(null);
  const keysRef = useRef({ w: false, s: false, a: false, d: false, space: false, arrowleft: false, arrowright: false, arrowup: false, arrowdown: false });
  const mouseDeltaRef = useRef({ dx: 0, dy: 0 });
  const isMouseDownRef = useRef(false);
  const isRightMouseDownRef = useRef(false);
  const lastTimeRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const appStateRef = useRef<AppState>('AUTH');

  // Handle active session check on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setAppState('LOBBY');
      } else {
        setAppState('AUTH');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setAppState('LOBBY');
      } else {
        setUser(null);
        setAppState('AUTH');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync highscore from user_stats table on login
  useEffect(() => {
    if (!user) return;
    const fetchHighScore = async () => {
      const { data } = await supabase
        .from('user_stats')
        .select('highest_score')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setHighScore(data.highest_score);
      }
    };
    fetchHighScore();
  }, [user]);

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

  // Save stats to Supabase on match completion
  const saveStatsToSupabase = useCallback(async (score: number, deaths: number) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('highest_score, total_frags, total_deaths, matches_played')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const currentHighest = data ? data.highest_score : 0;
      const currentFrags = data ? data.total_frags : 0;
      const currentDeaths = data ? data.total_deaths : 0;
      const currentMatches = data ? data.matches_played : 0;

      const newHighest = Math.max(currentHighest, score);
      const newFrags = currentFrags + score;
      const newDeaths = currentDeaths + deaths;
      const newMatches = currentMatches + 1;

      const { error: upsertErr } = await supabase
        .from('user_stats')
        .upsert({
          user_id: user.id,
          highest_score: newHighest,
          total_frags: newFrags,
          total_deaths: newDeaths,
          matches_played: newMatches,
          updated_at: new Date().toISOString()
        });

      if (upsertErr) throw upsertErr;
      setHighScore(newHighest);
    } catch (err) {
      console.error('Error saving user stats:', err);
    }
  }, [user]);

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
        setAppState('LOBBY');
        saveStatsToSupabase(engine.state.player.score, engine.state.player.deaths);
        return; // Break frame simulation
      }

      // 2. Defeat condition: Player died (HP reached zero)!
      if (engine.state.player.health <= 0) {
        setGameResult('DEFEAT');
        setAppState('LOBBY');
        saveStatsToSupabase(engine.state.player.score, engine.state.player.deaths);
        return; // Break frame simulation
      }

      // 3. Match Time Limit condition: 7 minutes (420 seconds)
      if (engine.state.matchTime >= 420) {
        setGameResult('VICTORY'); // survive and win!
        setAppState('LOBBY');
        saveStatsToSupabase(engine.state.player.score, engine.state.player.deaths);
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
  }, [saveStatsToSupabase]);

  // Activate game renderer execution - completely re-instantiates the engine for clean isolation
  const startGame = useCallback(() => {
    const engine = new XonoticEngine((updatedState) => {
      gameStateRef.current = updatedState;
      setGameState({ ...updatedState });
    });
    engineRef.current = engine;
    gameStateRef.current = engine.state;
    setGameState(engine.state);

    // Connect to real-time multiplayer room if context exists
    if (roomContext && user) {
      const displayName = user.user_metadata?.username || user.email || 'Player';
      engine.connectRealtime(roomContext.roomId, user.id, supabase, displayName);
    }
    
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
  }, [tick, roomContext, user]);

  const stopGameToMenu = useCallback(() => {
    setGameResult('NONE');
    setAppState('LOBBY');
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

  const handleStartGameFromLobby = useCallback((roomId: string, isHost: boolean, currentPlayers: any[]) => {
    setRoomContext({ roomId, isHost, players: currentPlayers });
    startGame();
  }, [startGame]);

  return (
    <div className="w-full h-screen bg-slate-950 text-white select-none overflow-hidden relative">
      <AnimatePresence mode="wait">
        {appState === 'AUTH' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <Auth onAuthSuccess={(u) => { setUser(u); setAppState('LOBBY'); }} />
          </motion.div>
        )}

        {appState === 'LOBBY' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <Lobby
              user={user}
              onLogout={() => {
                setUser(null);
                setAppState('AUTH');
              }}
              onStartGame={handleStartGameFromLobby}
            />

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
