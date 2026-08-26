import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
import { loadLocalStats, UserStats } from '../game/localStats';
import {
  User,
  Gamepad2,
  LogOut,
  Plus,
  Users,
  ArrowLeft,
  Play,
  Trophy,
  Skull,
  Target,
  Flame,
  Globe,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';

interface LobbyProps {
  user: any;
  onLogout: () => void;
  onStartGame: (roomId: string, isHost: boolean, currentPlayers: any[]) => void;
}

interface Room {
  id: string; // the room code — also the Realtime channel key, no database row involved
  name: string;
  host_id: string; // '' when we joined by code and don't actually know who the host is
  host_username: string;
  max_players: number;
  status: 'waiting' | 'playing' | 'finished';
}

interface UserProfile {
  username: string;
}

// No ambiguous-looking characters (0/O, 1/I/L) — codes get read aloud/typed by hand.
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export const Lobby = ({ user, onLogout, onStartGame }: LobbyProps) => {
  // No accounts anymore — display name comes straight from the nickname the player entered,
  // and stats are on-device only (see game/localStats.ts). Nothing to fetch, nothing to await.
  const profile: UserProfile = { username: user.user_metadata?.username || user.email || '전투원' };
  const [stats, setStats] = useState<UserStats>(() => loadLocalStats(user.id));

  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  // Real-time states
  const [onlineLobbyUsers, setOnlineLobbyUsers] = useState<any[]>([]);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);

  // Supabase Realtime Channels Refs (presence/broadcast only — no database tables involved)
  const lobbyChannelRef = useRef<any>(null);
  const roomChannelRef = useRef<any>(null);

  // Re-read on-device stats whenever the player identity changes (also naturally picks up a
  // fresh match's result, since this component unmounts/remounts on every LOBBY <-> PLAYING switch).
  useEffect(() => {
    setStats(loadLocalStats(user.id));
  }, [user.id]);

  // 1. Online Players Lobby Presence Sync
  useEffect(() => {
    const lobbyChan = supabase.channel('lobby_online_users');
    lobbyChannelRef.current = lobbyChan;

    lobbyChan
      .on('presence', { event: 'sync' }, () => {
        const presenceState = lobbyChan.presenceState();
        const users = Object.keys(presenceState).map((key) => {
          const presences = presenceState[key] as any[];
          return {
            id: key,
            ...presences[0]
          };
        });
        setOnlineLobbyUsers(users);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await lobbyChan.track({
            username: profile.username,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (lobbyChannelRef.current) {
        lobbyChannelRef.current.unsubscribe();
      }
    };
  }, [profile.username]);

  // 2. Room Specific Channel (Real-time Broadcast & Presence) — this is the entire multiplayer
  // room mechanism now. No database row backs a room; joining by code just means subscribing to
  // the same `room_<code>` channel the host is on.
  useEffect(() => {
    if (!activeRoom) {
      setRoomPlayers([]);
      return;
    }

    const isHost = activeRoom.host_id === user.id;
    const roomChan = supabase.channel(`room_${activeRoom.id}`);
    roomChannelRef.current = roomChan;

    roomChan
      .on('presence', { event: 'sync' }, () => {
        const presenceState = roomChan.presenceState();
        const players = Object.keys(presenceState).map((key) => {
          const presences = presenceState[key] as any[];
          return {
            id: key,
            ...presences[0]
          };
        });
        setRoomPlayers(players);
      })
      .on('broadcast', { event: 'start-game' }, (payload: any) => {
        onStartGame(activeRoom.id, isHost, payload.payload.players);
      })
      .on('broadcast', { event: 'room-closed' }, () => {
        alert('방이 방장에 의해 해체되었습니다.');
        setActiveRoom(null);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await roomChan.track({
            username: profile.username,
            isHost,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (roomChannelRef.current) {
        roomChannelRef.current.unsubscribe();
      }
    };
  }, [activeRoom, profile.username]);

  // Actions
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNameInput.trim()) return;

    // No network round-trip at all anymore — the room code IS the room, there's nothing to
    // insert into a database and nothing to wait on.
    setActiveRoom({
      id: generateRoomCode(),
      name: roomNameInput.trim(),
      host_id: user.id,
      host_username: profile.username,
      max_players: 4,
      status: 'waiting',
    });
    setRoomPlayers([{ id: user.id, username: profile.username }]);
    setRoomNameInput('');
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length < 4) return;

    // We don't know this room's real name/host until presence sync tells us who's actually in
    // it — host_id stays '' (never matches our own id) so we never mistakenly show a start button.
    setActiveRoom({
      id: code,
      name: `방 코드 ${code}`,
      host_id: '',
      host_username: '???',
      max_players: 4,
      status: 'waiting',
    });
    setRoomPlayers([{ id: user.id, username: profile.username }]);
    setJoinCodeInput('');
  };

  const handleLeaveRoom = () => {
    if (!activeRoom) return;

    if (activeRoom.host_id === user.id) {
      const confirmDelete = window.confirm('방장 권한으로 방을 폭파하시겠습니까?');
      if (!confirmDelete) return;
      // Let anyone still in the room know it's gone (no DB row to delete/watch anymore).
      roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'room-closed',
        payload: {},
      });
    }
    setActiveRoom(null);
  };

  const handleStartGame = () => {
    if (!activeRoom || activeRoom.host_id !== user.id) return;

    // Host starts locally right away — the broadcast to other players happens in the background,
    // nothing to wait on.
    onStartGame(activeRoom.id, true, roomPlayers);
    roomChannelRef.current?.send({
      type: 'broadcast',
      event: 'start-game',
      payload: { players: roomPlayers },
    });
  };

  const handleSignOut = () => {
    const confirmOut = window.confirm('닉네임을 초기화하고 처음 화면으로 돌아가시겠습니까?');
    if (confirmOut) onLogout();
  };

  const handleCopyCode = async () => {
    if (!activeRoom) return;
    try {
      await navigator.clipboard.writeText(activeRoom.id);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch (err) {
      console.warn('클립보드 복사 실패:', err);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white font-sans overflow-y-auto">
      {/* Sci-Fi Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-8 h-8 text-cyan-400 animate-pulse" />
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-yellow-400">
              BACk ROOM
            </h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-none mt-1">
              Command Center
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-4 py-2 border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-bold uppercase transition-all tracking-wider font-mono cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 max-w-7xl mx-auto w-full">
        {/* mode="wait" would serialize this switch (finish the lobby's exit fade before the room
            view even starts animating in) — an extra beat of visible delay on top of the actual
            state change, which is exactly what must NOT happen here. Default (concurrent) mode
            lets the incoming view start animating immediately. */}
        <AnimatePresence>
          {!activeRoom ? (
            /* ========================================================================= */
            /* LOBBY STATE (Profile, Online Users, Room Create/Join)                     */
            /* ========================================================================= */
            <>
              {/* Left Column: Profile & Stats / Online players */}
              <motion.div
                key="lobby-left"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 md:col-span-1"
              >
                {/* Profile Box */}
                <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Call Sign</span>
                      <span className="font-black text-white">{profile.username}</span>
                    </div>
                  </div>

                  {/* User Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-yellow-400 text-[10px] font-bold uppercase mb-0.5">
                        <Trophy className="w-3 h-3" />
                        <span>Max Frags</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats.highest_score}</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-bold uppercase mb-0.5">
                        <Target className="w-3 h-3" />
                        <span>Total Kills</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats.total_frags}</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-rose-500 text-[10px] font-bold uppercase mb-0.5">
                        <Skull className="w-3 h-3" />
                        <span>Deaths</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats.total_deaths}</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-indigo-400 text-[10px] font-bold uppercase mb-0.5">
                        <Flame className="w-3 h-3" />
                        <span>Matches</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats.matches_played}</span>
                    </div>
                  </div>
                </div>

                {/* Online Users List */}
                <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl flex-1 flex flex-col min-h-[220px]">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-3">
                    <Globe className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      Online Players ({onlineLobbyUsers.length})
                    </h3>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[240px] pr-1">
                    {onlineLobbyUsers.map((onlineUser) => (
                      <div
                        key={onlineUser.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                      >
                        <span className="font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          {onlineUser.username}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {onlineUser.id === user.id ? 'You' : 'Lobby'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Right Columns: Room Create / Join by Code */}
              <motion.div
                key="lobby-right"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="md:col-span-2 space-y-6 flex flex-col"
              >
                {/* Room Creation Panel */}
                <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl">
                  <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">
                    새 경기장 개설 (Create Game Room)
                  </h3>
                  <form onSubmit={handleCreateRoom} className="flex gap-3">
                    <input
                      type="text"
                      placeholder="방 제목을 입력하세요 (예: 불꽃 튀는 전장)"
                      required
                      value={roomNameInput}
                      onChange={(e) => setRoomNameInput(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-950/80 border border-white/10 focus:border-cyan-500/50 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 rounded-xl font-bold text-sm flex items-center gap-1.5 border border-cyan-400/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      개설
                    </button>
                  </form>
                  <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                    개설하면 6자리 방 코드가 발급됩니다. 그 코드를 친구에게 알려주세요.
                  </p>
                </div>

                {/* Join by Code Panel */}
                <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl">
                  <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">
                    코드로 참가하기 (Join by Code)
                  </h3>
                  <form onSubmit={handleJoinByCode} className="flex gap-3">
                    <input
                      type="text"
                      placeholder="방 코드 입력 (예: K3F9QX)"
                      required
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="flex-1 px-4 py-3 bg-slate-950/80 border border-white/10 focus:border-cyan-500/50 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all font-mono uppercase tracking-widest"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90 rounded-xl font-bold text-sm flex items-center gap-1.5 border border-indigo-400/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <KeyRound className="w-4 h-4" />
                      참가
                    </button>
                  </form>
                </div>
              </motion.div>
            </>
          ) : (
            /* ========================================================================= */
            /* GAME ROOM WAITING STATE                                                   */
            /* ========================================================================= */
            <motion.div
              key="room-waiting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="col-span-1 md:col-span-3 max-w-2xl mx-auto w-full bg-slate-900/60 backdrop-blur-md rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl flex flex-col gap-6"
            >
              {/* Back button & Room title */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button
                  onClick={handleLeaveRoom}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-slate-950/50 hover:bg-slate-950 hover:text-white rounded-lg text-xs text-slate-400 transition-all font-mono cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  LEAVE
                </button>
                <div className="text-right">
                  <span className="text-[9px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {activeRoom.host_id === user.id ? 'Host' : 'Guest'}
                  </span>
                  <span className="text-xs text-slate-500 font-mono ml-2">ROOM STATUS</span>
                </div>
              </div>

              {/* Room details */}
              <div className="text-center py-4">
                <h2 className="text-2xl font-black text-white">{activeRoom.name}</h2>
                <p className="text-xs text-slate-400 mt-1">방장: {activeRoom.host_username}</p>

                <button
                  onClick={handleCopyCode}
                  title="코드 복사"
                  className="mt-4 inline-flex items-center gap-2.5 px-5 py-2.5 bg-slate-950/80 border border-cyan-500/30 hover:border-cyan-500/60 rounded-xl font-mono text-lg tracking-[0.3em] text-cyan-300 transition-all cursor-pointer"
                >
                  {activeRoom.id}
                  {codeCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500" />}
                </button>
                <p className="text-[10px] text-slate-500 mt-2">이 코드를 친구에게 알려주면 같이 플레이할 수 있어요</p>
              </div>

              {/* Players presence grid */}
              <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  참가한 플레이어 목록 ({roomPlayers.length} / 4)
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {roomPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="bg-white/5 border border-white/5 rounded-xl p-3.5 flex items-center gap-3 relative"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 font-mono text-sm font-bold">
                        P
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white truncate max-w-[150px]">
                          {player.username}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          {player.isHost ? '방장' : '전투 대기'}
                        </div>
                      </div>

                      {player.isHost && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]" title="Host" />
                      )}
                    </div>
                  ))}

                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, 4 - roomPlayers.length) }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="border border-dashed border-white/5 bg-transparent rounded-xl p-3.5 flex items-center justify-center text-[10px] text-slate-600 font-mono"
                    >
                      WAITING FOR COMBATANT...
                    </div>
                  ))}
                </div>
              </div>

              {/* Action trigger: Start game */}
              <div className="flex flex-col items-center mt-2">
                {activeRoom.host_id === user.id ? (
                  <button
                    onClick={handleStartGame}
                    disabled={roomPlayers.length < 1} // Can play solo or multi
                    className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 hover:opacity-95 text-white font-mono rounded-xl font-black text-base uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    START MATCH (경기 개시)
                  </button>
                ) : (
                  <div className="text-center font-mono text-xs text-slate-400 flex items-center gap-2 bg-white/5 px-6 py-3.5 rounded-xl border border-white/5 animate-pulse">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                    <span>방장이 경기를 시작하기를 기다리는 중...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
