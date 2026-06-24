import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XonoticEngine } from './game/xonoticEngine';
import { XonoticGameState } from './game/xonoticTypes';
import { XonoticCanvas } from './components/XonoticCanvas';
import { XonoticHUD } from './components/XonoticHUD';
import { MobileControls } from './components/MobileControls';
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

  // Auto-dismiss game result banner after 3 seconds
  useEffect(() => {
    if (gameResult === 'NONE') return;
    const timer = setTimeout(() => setGameResult('NONE'), 3000);
    return () => clearTimeout(timer);
  }, [gameResult]);

  // Mobile detection
  const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < window.innerHeight
  );

  useEffect(() => {
    if (!isMobile) return;
    // Request landscape lock (best-effort, not supported on all browsers)
    if (screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('landscape').catch(() => {});
    }
    const onResize = () => setIsPortrait(window.innerWidth < window.innerHeight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [isMobile]);

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
      const endGame = (result: 'VICTORY' | 'DEFEAT') => {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (engine.supabaseChannel) engine.supabaseChannel.unsubscribe();
        engineRef.current = null;
        setGameResult(result);
        setAppState('LOBBY');
        saveStatsToSupabase(engine.state.player.score, engine.state.player.deaths);
      };

      // 1. Victory condition: All enemies are dead (Teammates are excluded)!
      const enemiesCount = engine.state.bots.filter(b => !b.isTeammate).length;
      if (enemiesCount === 0) {
        endGame('VICTORY');
        return;
      }

      // 2. Defeat condition: Player died (HP reached zero)!
      if (engine.state.player.health <= 0) {
        endGame('DEFEAT');
        return;
      }

      // 3. Match Time Limit condition: 7 minutes (420 seconds)
      if (engine.state.matchTime >= 420) {
        endGame('VICTORY');
        return;
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
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (engineRef.current?.supabaseChannel) {
      engineRef.current.supabaseChannel.unsubscribe();
    }
    engineRef.current = null;
    setGameResult('NONE');
    setAppState('LOBBY');
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
    <div className="w-full h-screen bg-slate-950 text-white select-none overflow-hidden relative" style={{ touchAction: 'none' }}>
      {/* Portrait-mode rotation prompt (mobile only) */}
      {isMobile && isPortrait && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6"
          style={{ background: 'rgba(2,6,23,0.97)' }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="18" y="8" width="28" height="48" rx="4" stroke="white" strokeWidth="3" fill="none"/>
            <path d="M50 32 A22 22 0 0 1 14 32" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" fill="none"/>
            <polyline points="46,26 50,32 44,35" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-white text-lg font-bold">기기를 가로로 돌려주세요</p>
          <p className="text-slate-400 text-sm">게임은 가로 모드에서만 플레이할 수 있습니다</p>
        </div>
      )}

      <AnimatePresence>
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

            {/* 게임 결과 토스트 배너 (로비 상단에 잠깐 표시) */}
            <AnimatePresence>
              {gameResult !== 'NONE' && (
                <motion.div
                  initial={{ opacity: 0, y: -30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                >
                  <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-mono font-bold text-sm shadow-xl border backdrop-blur-md ${
                    gameResult === 'VICTORY'
                      ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-900/80 border-rose-500/50 text-rose-300'
                  }`}>
                    {gameResult === 'VICTORY'
                      ? <Award className="w-5 h-5" />
                      : <ShieldAlert className="w-5 h-5" />}
                    {gameResult === 'VICTORY' ? '승리! 로비로 복귀합니다.' : '패배! 로비로 복귀합니다.'}
                  </div>
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
            transition={{ duration: 0.15 }}
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

            {/* Mobile touch controls (only on touch devices) */}
            {isMobile && (
              <MobileControls
                keysRef={keysRef}
                mouseDeltaRef={mouseDeltaRef}
                isMouseDownRef={isMouseDownRef}
              />
            )}

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
