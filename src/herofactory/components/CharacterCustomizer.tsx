import { useState, ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  HeroCharacter,
  Hairstyle,
  Face,
  Outfit,
  Cape,
  CharacterColors,
  HAIRSTYLE_LABELS,
  FACE_LABELS,
  OUTFIT_LABELS,
  CAPE_LABELS,
  SKIN_COLORS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  CAPE_COLORS,
  ACCENT_COLORS,
} from '../game/types';
import { CharacterPreview } from './CharacterPreview';
import {
  Check,
  Scissors,
  Smile,
  Shirt,
  Wind,
  Palette,
  Dices,
  ArrowLeft,
} from 'lucide-react';

interface CharacterCustomizerProps {
  character: HeroCharacter;
  onUpdate: (updates: Partial<HeroCharacter>) => void;
  onComplete: () => void;
  onBack: () => void;
}

const HAIRSTYLES: Hairstyle[] = ['SHORT', 'LONG', 'SPIKY', 'CURLY', 'MOHAWK'];
const FACES: Face[] = ['NORMAL', 'SQUARE', 'ROUND', 'ANGULAR', 'SHARP'];
const OUTFITS: Outfit[] = ['CLASSIC', 'SUIT', 'ARMOR', 'HOODIE', 'TACTICAL'];
const CAPES: Cape[] = ['NONE', 'SHORT', 'LONG', 'FLOWING'];

type TabId = 'HAIR' | 'FACE' | 'OUTFIT' | 'CAPE' | 'COLOR';

const TABS: { id: TabId; label: string; icon: typeof Scissors }[] = [
  { id: 'HAIR', label: '헤어스타일', icon: Scissors },
  { id: 'FACE', label: '얼굴', icon: Smile },
  { id: 'OUTFIT', label: '의상', icon: Shirt },
  { id: 'CAPE', label: '망토', icon: Wind },
  { id: 'COLOR', label: '색상', icon: Palette },
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/* ── 옵션 카드: 미니 미리보기 + 라벨 ── */
function OptionCard({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-500/25'
          : 'border-slate-700/80 bg-slate-800/60 hover:border-slate-400 hover:bg-slate-800'
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center shadow-md">
          <Check className="w-3.5 h-3.5 text-slate-900" strokeWidth={3.5} />
        </span>
      )}
      <div className="h-[88px] flex items-end justify-center overflow-hidden rounded-xl bg-slate-900/60 w-full">
        {children}
      </div>
      <span
        className={`text-sm font-bold transition-colors ${
          selected ? 'text-cyan-300' : 'text-slate-300'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

/* ── 색상 선택 섹션 ── */
function ColorSection({
  title,
  colors,
  current,
  onSelect,
}: {
  title: string;
  colors: string[];
  current: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-slate-200">{title}</h4>
        <span
          className="w-4 h-4 rounded-full border border-white/40"
          style={{ backgroundColor: current }}
        />
      </div>
      <div className="flex gap-2.5 flex-wrap">
        {colors.map((color) => {
          const selected = current === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              title={color}
              aria-pressed={selected}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                selected
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-slate-600 hover:border-slate-300 hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            >
              {selected && (
                <Check className="w-5 h-5 text-white mix-blend-difference" strokeWidth={3.5} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CharacterCustomizer({
  character,
  onUpdate,
  onComplete,
  onBack,
}: CharacterCustomizerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('HAIR');
  const isHero = character.role === 'HERO';

  const randomizeLook = () => {
    onUpdate({
      hairstyle: pickRandom(HAIRSTYLES),
      face: pickRandom(FACES),
      outfit: pickRandom(OUTFITS),
      cape: pickRandom(CAPES),
      colors: {
        skin: pickRandom(SKIN_COLORS),
        hair: pickRandom(HAIR_COLORS),
        outfit: pickRandom(OUTFIT_COLORS),
        cape: pickRandom(CAPE_COLORS),
        accent: pickRandom(ACCENT_COLORS),
      },
    });
  };

  const setColor = (key: keyof CharacterColors, color: string) => {
    onUpdate({ colors: { ...character.colors, [key]: color } });
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white overflow-hidden flex">
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-white/10 rounded-xl text-sm font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        뒤로가기
      </button>

      {/* ── 왼쪽 패널: 실시간 미리보기 ── */}
      <aside className="w-[330px] md:w-[380px] shrink-0 bg-slate-900/40 border-r border-slate-700/60 backdrop-blur-sm flex flex-col items-center justify-center p-6">
        <p className="text-xs font-bold tracking-[0.3em] text-cyan-300/80 uppercase mb-4">
          Live Preview
        </p>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="p-5 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600/50 shadow-2xl"
        >
          <CharacterPreview character={character} size={230} />
        </motion.div>

        <h3 className="mt-6 text-3xl font-black">{character.name}</h3>
        <span
          className={`mt-1 px-4 py-1 rounded-full text-sm font-bold ${
            isHero
              ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
              : 'bg-red-500/20 text-red-300 border border-red-400/40'
          }`}
        >
          {isHero ? '히어로' : '빌런'}
        </span>

        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-slate-300 max-w-[280px]">
          <span className="px-3 py-1.5 bg-slate-800/80 rounded-full border border-slate-700">
            {HAIRSTYLE_LABELS[character.hairstyle]}
          </span>
          <span className="px-3 py-1.5 bg-slate-800/80 rounded-full border border-slate-700">
            {FACE_LABELS[character.face]}
          </span>
          <span className="px-3 py-1.5 bg-slate-800/80 rounded-full border border-slate-700">
            {OUTFIT_LABELS[character.outfit]}
          </span>
          <span className="px-3 py-1.5 bg-slate-800/80 rounded-full border border-slate-700">
            {CAPE_LABELS[character.cape]}
          </span>
        </div>
      </aside>

      {/* ── 오른쪽 패널: 옵션 선택 ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-end justify-between gap-4 px-8 pt-20 pb-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              캐릭터 외형 제작
            </h2>
            <p className="text-sm text-slate-400 mt-1">선택한 항목이 즉시 미리보기에 반영됩니다</p>
          </div>
          <button
            onClick={randomizeLook}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 border border-white/10 rounded-xl text-sm font-bold transition-colors shrink-0"
          >
            <Dices className="w-4 h-4 text-amber-400" />
            랜덤 외형
          </button>
        </header>

        {/* 탭 */}
        <nav className="px-8 pb-3">
          <div className="flex gap-2 p-1.5 bg-slate-900/60 rounded-2xl border border-slate-700/60">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* 본문 */}
        <main className="flex-1 px-8 pb-4 overflow-y-auto">
          {activeTab === 'HAIR' && (
            <motion.div
              key="tab-hair"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              {HAIRSTYLES.map((h) => (
                <OptionCard
                  key={h}
                  label={HAIRSTYLE_LABELS[h]}
                  selected={character.hairstyle === h}
                  onClick={() => onUpdate({ hairstyle: h })}
                >
                  <CharacterPreview character={{ ...character, hairstyle: h }} size={62} />
                </OptionCard>
              ))}
            </motion.div>
          )}

          {activeTab === 'FACE' && (
            <motion.div
              key="tab-face"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              {FACES.map((f) => (
                <OptionCard
                  key={f}
                  label={FACE_LABELS[f]}
                  selected={character.face === f}
                  onClick={() => onUpdate({ face: f })}
                >
                  <CharacterPreview character={{ ...character, face: f }} size={62} />
                </OptionCard>
              ))}
            </motion.div>
          )}

          {activeTab === 'OUTFIT' && (
            <motion.div
              key="tab-outfit"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              {OUTFITS.map((o) => (
                <OptionCard
                  key={o}
                  label={OUTFIT_LABELS[o]}
                  selected={character.outfit === o}
                  onClick={() => onUpdate({ outfit: o })}
                >
                  <CharacterPreview character={{ ...character, outfit: o }} size={62} />
                </OptionCard>
              ))}
            </motion.div>
          )}

          {activeTab === 'CAPE' && (
            <motion.div
              key="tab-cape"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              {CAPES.map((c) => (
                <OptionCard
                  key={c}
                  label={CAPE_LABELS[c]}
                  selected={character.cape === c}
                  onClick={() => onUpdate({ cape: c })}
                >
                  <CharacterPreview character={{ ...character, cape: c }} size={62} />
                </OptionCard>
              ))}
            </motion.div>
          )}

          {activeTab === 'COLOR' && (
            <motion.div
              key="tab-color"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid xl:grid-cols-2 gap-x-8 gap-y-6 max-w-3xl"
            >
              <ColorSection
                title="피부색"
                colors={SKIN_COLORS}
                current={character.colors.skin}
                onSelect={(c) => setColor('skin', c)}
              />
              <ColorSection
                title="헤어색"
                colors={HAIR_COLORS}
                current={character.colors.hair}
                onSelect={(c) => setColor('hair', c)}
              />
              <ColorSection
                title="의상색"
                colors={OUTFIT_COLORS}
                current={character.colors.outfit}
                onSelect={(c) => setColor('outfit', c)}
              />
              <ColorSection
                title="망토색"
                colors={CAPE_COLORS}
                current={character.colors.cape}
                onSelect={(c) => setColor('cape', c)}
              />
              <ColorSection
                title="액센트색"
                colors={ACCENT_COLORS}
                current={character.colors.accent}
                onSelect={(c) => setColor('accent', c)}
              />
            </motion.div>
          )}
        </main>

        {/* 완료 버튼 */}
        <footer className="px-8 py-5 border-t border-slate-700/60 bg-slate-900/40">
          <button
            onClick={onComplete}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 py-4 text-lg font-black bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-2xl shadow-lg shadow-green-500/30 hover:shadow-green-400/50 transition-all"
          >
            <Check className="w-5 h-5" strokeWidth={3} />
            캐릭터 완성
          </button>
        </footer>
      </div>
    </div>
  );
}
