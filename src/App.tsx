import { useState } from 'react';
import { GameHub } from './hub/GameHub';
import { BackroomsRoot } from './backrooms/BackroomsRoot';
import { HeroFactoryRoot } from './herofactory/HeroFactoryRoot';

type GameMode = 'HUB' | 'BACKROOMS' | 'HEROFACTORY';

export default function App() {
  const [mode, setMode] = useState<GameMode>('HUB');

  if (mode === 'HUB') {
    return <GameHub onSelect={(game) => setMode(game)} />;
  }
  
  if (mode === 'BACKROOMS') {
    return <BackroomsRoot onExit={() => setMode('HUB')} />;
  }
  
  if (mode === 'HEROFACTORY') {
    return <HeroFactoryRoot onExit={() => setMode('HUB')} />;
  }

  return <GameHub onSelect={(game) => setMode(game)} />;
}
