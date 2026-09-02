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
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadLocalStats, saveLocalMatchResult } from './game/localStats';

type AppState = 'NICKNAME' | 'LOBBY' | 'PLAYING';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [appState, setAppState] = useState<AppState>('NICKNAME');
  const [gameState, setGameState] = useState<XonoticGameState | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [gameResult, setGameResult] = useState<'NONE' | 'VICTORY' | 'DEFEAT'>('NONE');
  const [activeLevel, setActiveLevel] = useState<1 | 2>(1);
  const [roomContext, setRoomContext] = useState<{ roomId: string; isHost: boolean; players: any[] } | null>(null);

  const engineRef = useRef<XonoticEngine | null>(null);
  const gameStateRef = useRef<XonoticGameState | null>(null);
  const pendingLevelRef = useRef<1 | 2>(1);
  const keysRef = useRef({ w: false, s: false, a: false, d: false, space: false, arrowleft: false, arrowright: false, arrowup: false, arrowdown: false });
  const mouseDeltaRef = useRef({ dx: 0, dy: 0 });
  const lastTimeRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const appStateRef = useRef<AppState>('NICKNAME');
  const userRef = useRef<any>(null);
  const saveStatsRef = useRef<(score: number, deaths: number) => void>(() => {});

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

  // Handle active session check on mount — no backend account, just a remembered nickname/guest id
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xonotic_player');
      if (saved) {
        setUser(JSON.parse(saved));
        setAppState('LOBBY');
        return;
      }
    } catch {}
    setAppState('NICKNAME');
  }, []);

  // Sync highscore from on-device stats (see game/localStats.ts) whenever the player is set
  useEffect(() => {
    if (!user) return;
    setHighScore(loadLocalStats(user.id).highest_score);
  }, [user]);

  // Save stats on-device on match completion — no account system, so nothing to sync to a server
  const saveMatchStats = useCallback((score: number, deaths: number) => {
    if (!user) return;
    const updated = saveLocalMatchResult(user.id, score, deaths);
    setHighScore(updated.highest_score);
  }, [user]);

  // Keep mutable values synced with refs for use inside RAF/engine callbacks
  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { saveStatsRef.current = saveMatchStats; }, [saveMatchStats]);

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

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Main game tick animation frame — only runs physics, no game-over logic
  const tick = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }
    const dt = Math.min(0.03, (timestamp - lastTimeRef.current) / 1000); // capped max delta to avoid huge physics warp
    lastTimeRef.current = timestamp;

    const engine = engineRef.current;
    if (engine && appStateRef.current === 'PLAYING') {
      // Step 1: Feed player view movement controls
      engine.updateInputs(
        keysRef.current,
        mouseDeltaRef.current.dx,
        mouseDeltaRef.current.dy,
        dt
      );
      // Reset mouse move delta registers after consuming
      mouseDeltaRef.current = { dx: 0, dy: 0 };

      // Step 2: Step bot mechanics & physics states
      engine.stepSimulator(dt);
    }

    // Only reschedule if engine is still alive (cleared on game-over)
    if (engineRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(tick);
    }
  }, []);

  // Activate game renderer execution - completely re-instantiates the engine for clean isolation
  const startGame = useCallback(() => {
    let gameOverFired = false; // prevent double-fire within same game session
    const runLevel = pendingLevelRef.current;
    setActiveLevel(runLevel);

    const engine = new XonoticEngine((updatedState) => {
      gameStateRef.current = updatedState;
      setGameState({ ...updatedState });

      // Game-over detection runs synchronously every frame — no React batching delay
      if (gameOverFired || appStateRef.current !== 'PLAYING') return;
      const isDefeat  = updatedState.player.health <= 0;
      const isVictory = updatedState.escaped === true;
      if (!isDefeat && !isVictory) return;

      gameOverFired = true;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      try { if (engine.supabaseChannel) engine.supabaseChannel.unsubscribe(); } catch {}
      engineRef.current = null;
      setGameResult(isDefeat ? 'DEFEAT' : 'VICTORY');
      setAppState('LOBBY');
      // Save stats via ref — always uses current user/saveStats function
      if (userRef.current) {
        saveStatsRef.current(updatedState.player.score, updatedState.player.deaths);
      }
    }, runLevel);
    engineRef.current = engine;
    gameStateRef.current = engine.state;
    setGameState(engine.state);

    // Connect to real-time multiplayer room if context exists
    if (roomContext && user) {
      const displayName = user.user_metadata?.username || user.email || 'Player';
      engine.connectRealtime(roomContext.roomId, user.id, supabase, displayName);
    }
    
    // Smooth reset controls states
    keysRef.current = { w: false, s: false, a: false, d: false, space: false, arrowleft: false, arrowright: false, arrowup: false, arrowdown: false };
    mouseDeltaRef.current = { dx: 0, dy: 0 };
    
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
    mouseDeltaRef.current.dx += dx;
    mouseDeltaRef.current.dy += dy;
  }, []);

  const handleStartGameFromLobby = useCallback((roomId: string, isHost: boolean, currentPlayers: any[], level: 1 | 2 = 1) => {
    pendingLevelRef.current = level;
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
        {appState === 'NICKNAME' && (
          <motion.div
            key="nickname"
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
                localStorage.removeItem('xonotic_player');
                setUser(null);
                setAppState('NICKNAME');
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
                    {gameResult === 'VICTORY'
                      ? `레벨 ${activeLevel} 탈출 성공! 로비로 복귀합니다.`
                      : '패배! 로비로 복귀합니다.'}
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
            <ErrorBoundary onReset={stopGameToMenu}>
              {/* Custom high-performance 3D canvas rendering engine */}
              <XonoticCanvas
                state={gameState}
                gameStateRef={gameStateRef}
                level={activeLevel}
                onPointerLockChange={handlePointerLockChange}
                onMouseMove={handleMouseMove}
              />

              {/* Futuristic Sci-fi HUD element layout overlay with keys telemetry diagnostic */}
              <XonoticHUD
                player={gameState.player}
                fragFeed={gameState.fragFeed}
                matchTime={gameState.matchTime}
                level={activeLevel}
                monsterWarning={gameState.monsterWarning}
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
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
