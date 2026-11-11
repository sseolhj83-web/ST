import { useState } from 'react';
import { motion } from 'motion/react';

interface NameInputProps {
  onSubmit: (name: string) => void;
  onBack: () => void;
}

export function NameInput({ onSubmit, onBack }: NameInputProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 text-white flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <button
        onClick={onBack}
        className="absolute top-6 left-6 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors z-20"
      >
        ← 뒤로가기
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center px-4 max-w-md w-full"
      >
        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          캐릭터 이름
        </h2>
        <p className="text-slate-300 mb-8">당신의 히어로 이름을 입력하세요</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="이름을 입력하세요"
            className="w-full px-6 py-4 text-lg bg-slate-800/80 border-2 border-slate-600 rounded-xl focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all text-center"
            autoFocus
          />
          <motion.button
            type="submit"
            disabled={!name.trim()}
            whileHover={name.trim() ? { scale: 1.05 } : {}}
            whileTap={name.trim() ? { scale: 0.95 } : {}}
            className={`w-full px-8 py-4 text-lg font-bold rounded-xl transition-all ${
              name.trim()
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/50'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            다음
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
