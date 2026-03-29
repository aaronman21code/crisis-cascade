// frontend/src/components/phases/MShockScreen.tsx
import { motion } from 'framer-motion';
import { LambdaHero } from '../shared/LambdaHero';
import { GameHeader } from '../shared/GameHeader';
import { FACTION_COLORS } from '../shared/FactionIntelPanel';
import { PhaseHint } from '../shared/PhaseHint';
import { useGameStore } from '../../store/game';
import { abstractLambda } from '../../utils/stanceEngine';

export function MShockScreen() {
  const { gameState, playerFaction, skipToOverreach } = useGameStore();
  const isDirector = playerFaction === 'DIRECTOR';
  const { globalLambda, newsFeed, turn, factions } = gameState;

  const turnHeadlines = newsFeed.filter(n => n.turn === turn).slice(0, 3);

  if (isDirector) {
    return (
      <motion.div
        className="min-h-screen text-white p-6"
        style={{ backgroundColor: '#0f0800' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.35 }}
      >
        <div className="max-w-3xl mx-auto">
          <GameHeader />
          <div className="flex items-center gap-3 mt-4 mb-6">
            <motion.span
              className="text-xs font-mono tracking-[0.3em] text-red-500 uppercase"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              ● Breaking
            </motion.span>
            <LambdaHero lambda={globalLambda} size="sm" />
          </div>
          <div className="space-y-4 mb-8">
            {turnHeadlines.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.4 }}
                className="border-l-2 pl-4 py-1"
                style={{ borderColor: item.impact >= 20 ? '#ef4444' : item.impact >= 10 ? '#f97316' : '#4b5563' }}
              >
                <p className="text-sm text-white leading-snug">{item.title}</p>
              </motion.div>
            ))}
            {turnHeadlines.length === 0 && <p className="text-xs text-gray-600">No new intelligence this week.</p>}
          </div>
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
      style={{ backgroundColor: '#0f0800' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35 }}
    >
      <div className="max-w-lg mx-auto">
        <GameHeader />

        <PhaseHint
          phaseKey="m_shock"
          text="Media Shock Phase — no actions needed. Headlines drive public fear. The next phase shows how fear cascades through the system."
        />

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">M — SHOCK · MEDIA PHASE</span>
          </div>
          <p className="text-[11px] text-gray-600">Headlines are forming. Watch how the narrative shifts before the fear phase begins.</p>
        </div>

        {/* BREAKING label + λ */}
        <div className="flex items-center justify-between mt-4 mb-8">
          <motion.span
            className="text-xs font-mono tracking-[0.3em] text-red-500 uppercase"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            ● Breaking
          </motion.span>
          <LambdaHero lambda={globalLambda} size="sm" />
        </div>

        {/* Staggered headlines */}
        <div className="space-y-4 mb-6">
          {turnHeadlines.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.4, duration: 0.5 }}
              className="border-l-2 pl-4 py-1"
              style={{ borderColor: item.impact >= 20 ? '#ef4444' : item.impact >= 10 ? '#f97316' : '#4b5563' }}
            >
              <p className="text-sm text-white leading-snug">{item.title}</p>
              {item.impact >= 20 && (
                <span className="text-xs text-red-500 font-mono mt-1 block">High Impact</span>
              )}
            </motion.div>
          ))}

          {turnHeadlines.length > 0 && (
            <motion.p
              className="text-xs text-gray-700 pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7 }}
            >
              Markets absorbing. P_Fear phase begins soon.
            </motion.p>
          )}

          {turnHeadlines.length === 0 && (
            <p className="text-xs text-gray-600">No new intelligence this week.</p>
          )}
        </div>

        {/* Faction status footer — abstracted λ labels */}
        <motion.div
          className="pt-4 border-t border-[#1a1a1a]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.0 }}
        >
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(factions).map(([id, f]) => {
              const { label, color } = abstractLambda(f.lambda);
              return (
                <span key={id} className="text-[10px] font-mono flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                    style={{ backgroundColor: FACTION_COLORS[id] ?? '#888' }}
                  />
                  <span className="text-gray-600">{id}</span>
                  <span style={{ color }}>{label}</span>
                </span>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
