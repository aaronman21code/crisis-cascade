import { PhaseBar } from './PhaseBar';
import { LambdaHero } from './LambdaHero';
import { MuteButton } from './MuteButton';
import { useGameStore } from '../../store/game';

const FACTION_COLORS: Record<string, string> = {
  US: '#60a5fa', IRAN: '#4ade80', CHINA: '#f87171',
  BRICS: '#facc15', LEGACY: '#c084fc', CRYPTO: '#fb923c',
  DIRECTOR: '#ffffff',
};

interface Props {
  showLambda?: boolean;
}

export function GameHeader({ showLambda = false }: Props) {
  const { gameState, playerFaction, phase, resetGame } = useGameStore();
  const factionColor = FACTION_COLORS[playerFaction ?? ''] ?? '#60a5fa';

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex flex-col gap-1">
        <PhaseBar current={phase} factionColor={factionColor} />
        <span className="text-xs text-gray-600">
          Turn {gameState.turn} · {playerFaction}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {showLambda && <LambdaHero lambda={gameState.globalLambda} size="sm" />}
        <MuteButton />
        <button
          onClick={() => { if (confirm('Reset? All progress will be lost.')) resetGame(); }}
          className="text-xs text-gray-600 hover:text-red-400 transition"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
