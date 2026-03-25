// frontend/src/components/LambdaGraph.tsx
import { useGameStore } from '../store/game';
import { LambdaHero } from './shared/LambdaHero';

const FACTION_COLORS: Record<string, string> = {
  US:     '#60a5fa',
  IRAN:   '#4ade80',
  CHINA:  '#f87171',
  BRICS:  '#facc15',
  LEGACY: '#c084fc',
  CRYPTO: '#fb923c',
};

export function LambdaGraph() {
  const { gameState } = useGameStore();

  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500 uppercase tracking-widest">Fear Multiplier</span>
        <LambdaHero lambda={gameState.globalLambda} size="sm" />
      </div>

      {/* Faction λ bars */}
      <div className="space-y-1.5">
        {Object.entries(gameState.factions).map(([id, faction]) => (
          <div key={id} className="flex items-center gap-2">
            <span className="text-xs w-14 text-gray-500">{id}</span>
            <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (faction.lambda / 4) * 100)}%`,
                  backgroundColor: FACTION_COLORS[id] ?? '#888',
                }}
              />
            </div>
            <span className="text-xs font-mono w-8 text-right" style={{ color: FACTION_COLORS[id] }}>
              {faction.lambda.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
