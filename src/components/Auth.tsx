/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { User, LogIn, ShieldAlert, Gamepad2 } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: any) => void;
}

const GUEST_ID_KEY = 'xonotic_guest_id';
const PLAYER_KEY = 'xonotic_player';

// No accounts anymore — multiplayer is entirely room-code based (see Lobby.tsx), so all this
// needs is a display name plus a stable per-device id for local stats/session identity.
function getOrCreateGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
  } catch {}
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `guest-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  try { localStorage.setItem(GUEST_ID_KEY, id); } catch {}
  return id;
}

export const Auth = ({ onAuthSuccess }: AuthProps) => {
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setErrorMessage('닉네임은 2자 이상 입력해야 합니다.');
      return;
    }

    const guestUser = {
      id: getOrCreateGuestId(),
      user_metadata: { username: trimmed },
    };
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify(guestUser)); } catch {}
    onAuthSuccess(guestUser);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      {/* Sci-Fi Grid Background Effect */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full px-8 py-10 bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)] relative z-10"
      >
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-bold tracking-widest uppercase mb-3">
            <Gamepad2 className="w-3.5 h-3.5 animate-pulse" />
            <span>BACk ROOM</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 leading-none">
            ENTER
          </h2>
          <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">
            계정 없이 닉네임만으로 바로 입장
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleEnter} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase block">닉네임 (Nickname)</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="호출명을 입력하세요 (2자 이상)"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-white/10 focus:border-cyan-500/50 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all font-sans"
              />
            </div>
          </div>

          {/* Feedback message */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-400 font-sans"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white font-mono rounded-xl font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.2)] border border-cyan-400/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>입장 (Enter)</span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-sans text-slate-500 leading-relaxed">
          방을 만들면 방 코드가 발급됩니다.<br />
          친구에게 그 코드를 알려주면 코드 입력만으로 같이 플레이할 수 있어요.
        </p>
      </motion.div>
    </div>
  );
};
