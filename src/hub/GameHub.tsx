import { motion } from 'motion/react';

interface GameHubProps {
  onSelect: (game: 'BACKROOMS' | 'HEROFACTORY') => void;
}

export function GameHub({ onSelect }: GameHubProps) {

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent" />
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent tracking-wider">
            GAME SELECT
          </h1>
          <p className="text-slate-400 text-lg">플레이할 게임을 선택하세요</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          <motion.button
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('BACKROOMS')}
            className="relative group overflow-hidden rounded-2xl border-2 border-slate-700 hover:border-cyan-500 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative p-8 h-64 flex flex-col justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2 text-cyan-400">BACKROOMS</h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  3D 공포 탈출 게임<br />
                  어둠 속에서 탈출구를 찾아야 합니다
                </p>
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">
                FPS • 호러 • 탐험
              </div>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('HEROFACTORY')}
            className="relative group overflow-hidden rounded-2xl border-2 border-slate-700 hover:border-yellow-500 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative p-8 h-64 flex flex-col justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  HERO FACTORY
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  2D 만화풍 슈퍼히어로 게임<br />
                  자신만의 히어로 또는 빌런을 제작하세요
                </p>
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">
                2D • 액션 • 캐릭터 제작
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
