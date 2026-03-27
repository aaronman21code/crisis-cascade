// frontend/src/components/phases/PFearScreen.tsx
import { motion } from 'framer-motion';
import { LambdaHero } from '../shared/LambdaHero';
import { GameHeader } from '../shared/GameHeader';
import { FACTION_COLORS } from '../shared/FactionIntelPanel';
import { PhaseHint } from '../shared/PhaseHint';
import { useGameStore } from '../../store/game';
import { abstractLambda } from '../../utils/stanceEngine';

export function PFearScreen() {
  const { gameState, playerFaction, skipToOverreach } = useGameStore();
  const isDirector = playerFaction === 'DIRECTOR';
  const { globalLambda, pools, panicIndex, oilPrice, activeCascades, factions } = gameState;
  const { energyPool } = pools;

  const energyColor = energyPool > 65 ? '#22c55e' : energyPool > 40 ? '#f97316' : '#ef4444';
  const panicColor  = panicIndex < 40 ? '#22c55e' : panicIndex < 70 ? '#f97316' : '#ef4444';

  const visibleCascades = activeCascades.slice(0, 3);
  const overflowCount   = activeCascades.length - 3;

  if (isDirector) {
    return (
      <motion.div
        className="min-h-screen text-white p-6"
        style={{ backgroundColor: '#0f0300' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.35 }}
      >
        <div className="max-w-3xl mx-auto">
          <GameHeader />
          <div className="mt-4 mb-6">
            <LambdaHero lambda={globalLambda} size="lg" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <MetricBlock label="Energy" value={energyPool > 65 ? 'Stable' : energyPool > 40 ? 'Strained' : 'Critical'} color={energyColor} />
            <MetricBlock label="Panic" value={panicIndex < 40 ? 'Low' : panicIndex < 70 ? 'Elevated' : 'High'} color={panicColor} />
            <MetricBlock label="Oil Price" value={`$${oilPrice}`} color="#f97316" />
          </div>
          {activeCascades.length > 0 && (
            <div className="mb-8 p-4 rounded-xl border border-[#1a1a1a] bg-[#0d0d12]">
              <div className="text-xs text-gray-600 uppercase tracking-widest mb-3">Active Cascades</div>
              <div className="flex flex-wrap gap-2">
                {activeCascades.map(c => (
                  <span key={c} className="text-xs font-mono px-2 py-1 rounded border border-[#374151] text-gray-400">
                    {c.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button onClick={skipToOverreach} className="px-6 py-3 bg-white text-black rounded font-bold text-sm hover:bg-gray-200 transition">
            Proceed to Action Phase →
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-screen text-white p-6"
      style={{ backgroundColor: '#0f0300' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35 }}
    >
      <div className="max-w-lg mx-auto">
        <GameHeader />

        <PhaseHint
          phaseKey="p_fear"
          text="Panic Phase — no actions needed. Watch which cascades are triggering. The Action Phase follows immediately after."
        />

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">P — FEAR · PANIC PHASE</span>
          </div>
          <p className="text-[11px] text-gray-600">Public panic is rising. Cascades shown here are already in motion — no actions this phase.</p>
        </div>

        {/* λ hero */}
        <div className="flex flex-col items-center justify-center py-10">
          <LambdaHero lambda={globalLambda} size="lg" />
          <p className="text-gray-700 text-xs mt-4 tracking-widest uppercase">Fear multiplier</p>
        </div>

        {/* 3 key metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <MetricBlock label="Energy Pool" value={`${energyPool}%`} color={energyColor} />
          <MetricBlock label="Panic Index" value={`${panicIndex}`}  color={panicColor} />
          <MetricBlock label="Oil Price"   value={`$${oilPrice}`}   color="#facc15" />
        </div>

        {/* Active cascades */}
        {activeCascades.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {visibleCascades.map(c => (
              <motion.span
                key={c}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs font-mono px-2 py-1 rounded border border-red-800 bg-red-950/30 text-red-400"
              >
                {c}
              </motion.span>
            ))}
            {overflowCount > 0 && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-red-800/40 text-red-700">
                +{overflowCount} more
              </span>
            )}
          </div>
        )}

        {/* Faction λ escalation bars — abstracted labels */}
        <div className="mt-2">
          <div className="text-xs text-gray-700 uppercase tracking-widest mb-3">Faction Escalation</div>
          <div className="space-y-2">
            {Object.entries(factions).map(([id, f], i) => {
              const { label, color } = abstractLambda(f.lambda);
              return (
                <div key={id} className="flex items-center gap-3">
                  <span
                    className="text-xs w-14"
                    style={{ color: FACTION_COLORS[id] ?? '#888', fontWeight: id === playerFaction ? 700 : 400 }}
                  >
                    {id}
                  </span>
                  <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (f.lambda / 4) * 100)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                    />
                  </div>
                  <span className="text-[10px] font-mono w-14 text-right" style={{ color }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MetricBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d12] p-4 text-center">
      <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  );
}
