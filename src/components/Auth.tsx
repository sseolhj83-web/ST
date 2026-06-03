import { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, User, LogIn, UserPlus, ShieldAlert, Gamepad2 } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: any) => void;
}

export const Auth = ({ onAuthSuccess }: AuthProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    if (isSignUp) {
      if (username.trim().length < 2) {
        setErrorMessage('닉네임은 2자 이상 입력해야 합니다.');
        setLoading(false);
        return;
      }
      
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
          },
        },
      });

      if (signUpError) {
        setErrorMessage(signUpError.message);
      } else {
        // 이메일 인증 없이 즉시 로그인
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setErrorMessage('가입은 완료되었으나 로그인에 실패했습니다: ' + signInError.message);
        } else if (signInData.user) {
          onAuthSuccess(signInData.user);
        }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 잘못되었습니다.' : error.message);
      } else if (data.user) {
        onAuthSuccess(data.user);
      }
    }
    setLoading(false);
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
            <span>XONOTIC SECURITY GATE</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 leading-none">
            {isSignUp ? 'REGISTER' : 'LOGIN'}
          </h2>
          <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">
            {isSignUp ? 'Create your combat profile' : 'Enter your credentials to deploy'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-5">
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase block">닉네임 (Nickname)</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="호출명을 입력하세요 (2자 이상)"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-white/10 focus:border-cyan-500/50 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all font-sans"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase block">이메일 (Email)</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="email@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-white/10 focus:border-cyan-500/50 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase block">비밀번호 (Password)</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-white/10 focus:border-cyan-500/50 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all font-sans"
              />
            </div>
          </div>

          {/* Feedback messages */}
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

          {infoMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400 font-sans leading-relaxed"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-ping" />
              <span>{infoMessage}</span>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white font-mono rounded-xl font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.2)] border border-cyan-400/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>계정 생성 (Sign Up)</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>경기장 로그인 (Log In)</span>
              </>
            )}
          </button>
        </form>

        {/* Tab Toggle */}
        <div className="mt-6 text-center text-xs font-sans text-slate-400">
          {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMessage('');
              setInfoMessage('');
            }}
            className="text-cyan-400 font-bold hover:underline ml-1.5 focus:outline-none cursor-pointer"
          >
            {isSignUp ? '로그인하기' : '회원가입하기'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
