import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
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
  Globe 
} from 'lucide-react';

interface LobbyProps {
  user: any;
  onLogout: () => void;
  onStartGame: (roomId: string, isHost: boolean, currentPlayers: any[]) => void;
}

interface Room {
  id: string;
  name: string;
  host_id: string;
  host_username: string;
  max_players: number;
  status: 'waiting' | 'playing' | 'finished';
}

interface UserProfile {
  username: string;
  avatar_url?: string;
}

interface UserStats {
  highest_score: number;
  total_frags: number;
  total_deaths: number;
  matches_played: number;
}

export const Lobby = ({ user, onLogout, onStartGame }: LobbyProps) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Real-time states
  const [onlineLobbyUsers, setOnlineLobbyUsers] = useState<any[]>([]);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);

  // Supabase Channels Refs
  const lobbyChannelRef = useRef<any>(null);
  const roomChannelRef = useRef<any>(null);

  // 1. Fetch User Profile and Stats
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Fetch Profile
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();

        if (profileErr) throw profileErr;
        setProfile(profileData);

        // Fetch Stats
        const { data: statsData, error: statsErr } = await supabase
          .from('user_stats')
          .select('highest_score, total_frags, total_deaths, matches_played')
          .eq('user_id', user.id)
          .single();

        if (statsErr) throw statsErr;
        setStats(statsData);
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };

    fetchUserData();
  }, [user.id]);

  // 2. Fetch Rooms & Subscribe to Rooms DB Changes
  useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRooms(data);
      }
      setLoading(false);
    };

    fetchRooms();

    // Subscribe to Rooms postgres changes
    const roomsSub = supabase
      .channel('public-rooms-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRoom = payload.new as Room;
            if (newRoom.status === 'waiting') {
              setRooms((prev) => [newRoom, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedRoom = payload.new as Room;
            if (updatedRoom.status !== 'waiting') {
              setRooms((prev) => prev.filter((r) => r.id !== updatedRoom.id));
            } else {
              setRooms((prev) =>
                prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRoom = payload.old as { id: string };
            setRooms((prev) => prev.filter((r) => r.id !== oldRoom.id));
            
            // If the user's active room was deleted, boot them to lobby
            setActiveRoom((current) => {
              if (current && current.id === oldRoom.id) {
                alert('방이 방장에 의해 해체되었습니다.');
                return null;
              }
              return current;
            });
          }
        }
      )
      .subscribe();

    return () => {
      roomsSub.unsubscribe();
    };
  }, []);

  // 3. Online Players Lobby Presence Sync
  useEffect(() => {
    if (!profile) return;

    // Join lobby presence channel
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
      .subscribe(async (status) => {
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
  }, [profile]);

  // 4. Room Specific Channel (Real-time Broadcast & Presence)
  useEffect(() => {
    if (!activeRoom || !profile) {
      setRoomPlayers([]);
      return;
    }

    // Subscribe to room specific channel for player presence and game launch broadcast
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
      .on('broadcast', { event: 'start-game' }, (payload) => {
        // Trigger startGame callback on all clients in the room
        onStartGame(activeRoom.id, activeRoom.host_id === user.id, payload.payload.players);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChan.track({
            username: profile.username,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (roomChannelRef.current) {
        roomChannelRef.current.unsubscribe();
      }
    };
  }, [activeRoom, profile]);

  // Actions
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNameInput.trim() || !profile) return;

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          name: roomNameInput.trim(),
          host_id: user.id,
          host_username: profile.username,
          max_players: 4,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;
      setActiveRoom(data);
      setRoomNameInput('');
    } catch (err: any) {
      alert(`방 생성 실패: ${err.message}`);
    }
  };

  const handleJoinRoom = (room: Room) => {
    setActiveRoom(room);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;

    // If host leaves, delete the room
    if (activeRoom.host_id === user.id) {
      const confirmDelete = window.confirm('방장 권한으로 방을 폭파하시겠습니까?');
      if (!confirmDelete) return;

      try {
        await supabase
          .from('rooms')
          .delete()
          .eq('id', activeRoom.id);
        setActiveRoom(null);
      } catch (err: any) {
        console.error('Error deleting room:', err);
      }
    } else {
      setActiveRoom(null);
    }
  };

  const handleStartGame = async () => {
    if (!activeRoom || activeRoom.host_id !== user.id) return;

    try {
      // 1. Update room status to 'playing' in database
      await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', activeRoom.id);

      // 2. Broadcast start event to all OTHER players in the room channel
      // (Supabase broadcast does NOT echo back to the sender)
      if (roomChannelRef.current) {
        await roomChannelRef.current.send({
          type: 'broadcast',
          event: 'start-game',
          payload: { players: roomPlayers },
        });
      }

      // 3. Host starts the game directly (broadcast doesn't reach the sender)
      onStartGame(activeRoom.id, true, roomPlayers);
    } catch (err: any) {
      alert(`게임 시작 에러: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    const confirmOut = window.confirm('정말 로그아웃 하시겠습니까?');
    if (confirmOut) {
      await supabase.auth.signOut();
      onLogout();
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
            <h1 className="text-2xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
              Xonotic Lobby
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
        <AnimatePresence mode="wait">
          {!activeRoom ? (
            /* ========================================================================= */
            /* LOBBY STATE (Profile, Online Users, Room List)                            */
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
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Logged In As</span>
                      <span className="font-black text-white">{profile?.username || '전투원'}</span>
                    </div>
                  </div>

                  {/* User Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-yellow-400 text-[10px] font-bold uppercase mb-0.5">
                        <Trophy className="w-3 h-3" />
                        <span>Max Frags</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats?.highest_score ?? 0}</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-bold uppercase mb-0.5">
                        <Target className="w-3 h-3" />
                        <span>Total Kills</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats?.total_frags ?? 0}</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-rose-500 text-[10px] font-bold uppercase mb-0.5">
                        <Skull className="w-3 h-3" />
                        <span>Deaths</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats?.total_deaths ?? 0}</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-indigo-400 text-[10px] font-bold uppercase mb-0.5">
                        <Flame className="w-3 h-3" />
                        <span>Matches</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{stats?.matches_played ?? 0}</span>
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

              {/* Right Columns: Rooms list & Creation */}
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
                </div>

                {/* Rooms List Grid */}
                <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-xl flex-1 min-h-[300px] flex flex-col">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-4">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      대기 중인 아레나 목록 (Open Matches)
                    </h3>
                  </div>

                  {loading ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm font-mono">
                      <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mr-2" />
                      FETCHING STADIUMS...
                    </div>
                  ) : rooms.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10">
                      <Gamepad2 className="w-12 h-12 stroke-[1] mb-2 opacity-50" />
                      <p className="text-xs text-center leading-normal">
                        현재 대기 중인 경기장이 없습니다.<br />
                        위의 양식을 입력해 먼저 첫 방을 개설해보세요!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[350px] pr-1">
                      {rooms.map((room) => (
                        <div 
                          key={room.id}
                          className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/20 rounded-xl p-4 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider block mb-0.5">
                              Host: {room.host_username}
                            </span>
                            <h4 className="font-bold text-sm text-white truncate mb-3">{room.name}</h4>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                            <span className="text-[10px] text-slate-400 font-mono">
                              최대 4인전
                            </span>
                            <button
                              onClick={() => handleJoinRoom(room)}
                              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                            >
                              입장
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                          {player.id === activeRoom.host_id ? '방장' : '전투 대기'}
                        </div>
                      </div>
                      
                      {player.id === activeRoom.host_id && (
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
