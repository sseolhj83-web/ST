import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { StartScreen } from './components/StartScreen';
import { RoleSelect } from './components/RoleSelect';
import { NameInput } from './components/NameInput';
import { DrawingCustomizer } from './components/DrawingCustomizer';
import { DrawingPreview } from './components/DrawingPreview';
import { StageGame } from './components/StageGame';
import { HeroCharacter, Role } from './game/types';

type Step = 'START' | 'ROLE' | 'NAME' | 'CUSTOMIZE' | 'COMPLETE' | 'SKILL' | 'STAGE';

interface HeroFactoryRootProps {
  onExit: () => void;
}

export function HeroFactoryRoot({ onExit }: HeroFactoryRootProps) {
  const [step, setStep] = useState<Step>('START');
  const [character, setCharacter] = useState<HeroCharacter>({
    name: '',
    role: 'HERO',
    drawing: [],
  });

  const handleRoleSelect = (role: Role) => {
    setCharacter(prev => ({ ...prev, role }));
    setStep('NAME');
  };

  const handleNameSubmit = (name: string) => {
    setCharacter(prev => ({ ...prev, name }));
    setStep('CUSTOMIZE');
  };

  const handleUpdateCharacter = (updates: Partial<HeroCharacter>) => {
    setCharacter(prev => ({ ...prev, ...updates }));
  };

  const handleComplete = () => {
    setStep('COMPLETE');
  };

  const handleSkillComplete = () => {
    setStep('STAGE');
  };

  const goBack = () => {
    if (step === 'ROLE') setStep('START');
    else if (step === 'NAME') setStep('ROLE');
    else if (step === 'CUSTOMIZE') setStep('NAME');
    else if (step === 'SKILL') setStep('COMPLETE');
    else if (step === 'STAGE') setStep('COMPLETE');
  };

  return (
    <div className="w-full h-screen relative">
      <button
        onClick={onExit}
        className="absolute top-6 right-6 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-xl text-sm font-medium transition-colors z-50 flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        게임 선택으로 돌아가기
      </button>

      <AnimatePresence mode="wait">
        {step === 'START' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <StartScreen onStart={() => setStep('ROLE')} />
          </motion.div>
        )}

        {step === 'ROLE' && (
          <motion.div
            key="role"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.4 }}
          >
            <RoleSelect onSelect={handleRoleSelect} onBack={goBack} />
          </motion.div>
        )}

        {step === 'NAME' && (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.4 }}
          >
            <NameInput onSubmit={handleNameSubmit} onBack={goBack} />
          </motion.div>
        )}

        {step === 'CUSTOMIZE' && (
          <motion.div
            key="customize"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.4 }}
          >
            <DrawingCustomizer
              character={character}
              onUpdate={handleUpdateCharacter}
              onComplete={handleComplete}
              onBack={goBack}
            />
          </motion.div>
        )}

        {step === 'COMPLETE' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-screen bg-gradient-to-br from-slate-950 via-green-950 to-emerald-950 text-white flex items-center justify-center relative overflow-hidden"
          >
            <div className="absolute inset-0">
              <div className="absolute top-20 left-20 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 text-center px-4 max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  캐릭터 완성!
                </h2>
                <p className="text-xl text-slate-300 mb-8">당신의 캐릭터가 성공적으로 제작되었습니다</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="mb-8 flex justify-center"
              >
                <div className="p-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border-2 border-green-500/50">
                  <DrawingPreview character={character} size={250} className="rounded-2xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="mb-8"
              >
                <h3 className="text-2xl font-bold mb-2">{character.name}</h3>
                <p className={`text-lg font-semibold mb-4 ${character.role === 'HERO' ? 'text-blue-400' : 'text-red-400'}`}>
                  {character.role === 'HERO' ? '히어로' : '빌런'}
                </p>
                <p className="text-slate-400">이제 직접 그린 기술로 스테이지에 도전하세요!</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }}
                className="flex flex-wrap gap-3 justify-center"
              >
                <button
                  onClick={() => setStep('SKILL')}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/40 rounded-lg font-bold transition-all"
                >
                  기술 만들고 전투 시작
                </button>
                <button
                  onClick={() => {
                    setCharacter({
                      name: '',
                      role: 'HERO',
                      drawing: [],
                      skill: [],
                    });
                    setStep('START');
                  }}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  다시 만들기
                </button>
                <button
                  onClick={onExit}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg hover:shadow-blue-500/50 rounded-lg transition-all"
                >
                  게임 선택으로 돌아가기
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {step === 'SKILL' && (
          <motion.div
            key="skill"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.4 }}
          >
            <DrawingCustomizer
              character={character}
              onUpdate={handleUpdateCharacter}
              onComplete={handleSkillComplete}
              onBack={goBack}
              mode="SKILL"
            />
          </motion.div>
        )}

        {step === 'STAGE' && (
          <motion.div
            key="stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-screen"
          >
            <StageGame
              character={character}
              onExit={onExit}
              onBackToCharacter={() => setStep('COMPLETE')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
