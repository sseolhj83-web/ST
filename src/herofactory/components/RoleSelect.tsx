import { motion } from 'motion/react';
import { Role } from '../game/types';
import { Shield, Zap } from 'lucide-react';

interface RoleSelectProps {
  onSelect: (role: Role) => void;
  onBack: () => void;
}

export function RoleSelect({ onSelect, onBack }: RoleSelectProps) {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
      </div>

      <button
        onClick={onBack}
        className="absolute top-6 left-6 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors z-20"
      >
        ← 뒤로가기
      </button>

      <div className="relative z-10 text-center px-4 max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            역할 선택
          </h2>
          <p className="text-slate-300 text-lg">히어로가 될 것인가, 빌런이 될 것인가</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.button
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(59, 130, 246, 0.5)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('HERO')}
            className="relative group overflow-hidden rounded-2xl border-2 border-blue-500/50 hover:border-blue-400 bg-gradient-to-br from-blue-900/40 to-slate-900/40 p-8 h-80 flex flex-col items-center justify-center gap-6"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Shield className="w-24 h-24 text-blue-400 relative z-10" />
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-2 text-blue-400">히어로</h3>
              <p className="text-slate-300">정의를 수호하는 수호자</p>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(239, 68, 68, 0.5)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('VILLAIN')}
            className="relative group overflow-hidden rounded-2xl border-2 border-red-500/50 hover:border-red-400 bg-gradient-to-br from-red-900/40 to-slate-900/40 p-8 h-80 flex flex-col items-center justify-center gap-6"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Zap className="w-24 h-24 text-red-400 relative z-10" />
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-2 text-red-400">빌런</h3>
              <p className="text-slate-300">세계를 뒤흔드는 악당</p>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
