// frontend/src/components/shared/FactionIntelPanel.tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game';
import { GAME_THEORY_DATA, FactionId } from '@engine/gameTheoryData';
import { getFactionStance, getSubGameStateLabel, abstractLambda } from '../../utils/stanceEngine';

export const FACTION_COLORS: Record<string, string> = {
  US: '#60a5fa', IRAN: '#4ade80', CHINA: '#f87171',
  BRICS: '#facc15', LEGACY: '#c084fc', CRYPTO: '#fb923c',
  EUROPE: '#34d399', SE_ASIA: '#f59e0b',
  DIRECTOR: '#ffffff',
};

function getLambdaColor(lambda: number): string {
  const { lockNash, cascadeTrigger, fullEnergyLockdownRisk } = GAME_THEORY_DATA.lambdaThresholds;
  if (lambda >= fullEnergyLockdownRisk) return '#f43f5e';
  if (lambda >= lockNash)              return '#ef4444';
  if (lambda >= cascadeTrigger)        return '#f97316';
  return '#22c55e';
}

interface Props {
  variant: 'full' | 'compact';
  isDirector?: boolean;
}

export function FactionIntelPanel({ variant, isDirector = false }: Props) {
  const { gameState, playerFaction, players, subGames, actionsProgress } = useGameStore();

  const activePlayers = players.filter(p => p.factionId !== 'DIRECTOR');
  const subGameKeys = Object.keys(GAME_THEORY_DATA.subGames) as Array<keyof typeof GAME_THEORY_DATA.subGames>;

  // ── Compact variant ────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 pt-4 border-t border-[#1a1a1a]"
      >
        <div className="text-[10px] text-gray-700 uppercase tracking-widest mb-2">Factions</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {activePlayers.map(p => {
            const f = gameState.factions[p.factionId as FactionId];
            if (!f) return null;
            const color = FACTION_COLORS[p.factionId] ?? '#888';
            const isMe = p.factionId === playerFaction;

            if (isDirector) {
              return (
                <span key={p.factionId} className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
                  <span style={{ color: isMe ? color : '#6b7280', fontWeight: isMe ? 700 : 400 }}>{p.factionId}</span>
                  <span className="text-gray-700">{f.politicalCapital}PC</span>
                  <span style={{ color: getLambdaColor(f.lambda) }}>λ{f.lambda.toFixed(2)}</span>
                </span>
              );
            }

            const stance = getFactionStance(p.factionId as FactionId, gameState);
            return (
              <span key={p.factionId} className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: stance.threatColor }} />
                <span style={{ color: isMe ? color : '#6b7280', fontWeight: isMe ? 700 : 400 }}>{p.factionId}</span>
                <span style={{ color: stance.threatColor }}>{stance.stance}</span>
              </span>
            );
          })}
        </div>
      </motion.div>
    );
  }

  // ── Full variant ───────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="space-y-5"
    >

      {/* Sub-game Status */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d12] p-4">
        <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">Strategic Theaters</div>
        <div className="space-y-2">
          {subGameKeys.map(key => {
            const live = subGames.find(sg => sg.key === key);
            const name = GAME_THEORY_DATA.subGames[key].name;
            const eq = live?.equilibriumState ?? '';
            const stateLabel = getSubGameStateLabel(eq);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: live ? stateLabel.color : '#374151' }} />
                <span className="text-[11px] text-gray-500 flex-1 truncate">{name}</span>
                <span className="text-[10px] font-mono" style={{ color: live ? stateLabel.color : '#374151' }}>
                  {live ? stateLabel.label : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Combined Standings + Intel */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d12] p-4">
        <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
          {isDirector ? 'Faction Status' : 'Intel — Standings'}
        </div>
        <div className="space-y-3">
          {(() => {
            const ALL_FACTIONS: FactionId[] = ['US', 'IRAN', 'CHINA', 'BRICS', 'LEGACY', 'CRYPTO', 'EUROPE', 'SE_ASIA'];
            const ranked = isDirector
              ? ALL_FACTIONS
              : [...ALL_FACTIONS].sort((a, b) =>
                  (gameState.factions[b]?.objectiveProgress ?? 0) - (gameState.factions[a]?.objectiveProgress ?? 0)
                );
            return ranked.map((factionId, i) => {
              const f = gameState.factions[factionId];
              if (!f) return null;
              const color = FACTION_COLORS[factionId] ?? '#888';
              const isMe = factionId === playerFaction;
              const lastEntry = [...gameState.overreachHistory]
                .filter(h => h.factionId === factionId)
                .sort((a, b) => b.turn - a.turn)[0];

              if (isDirector) {
                return (
                  <motion.div key={factionId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }} className="pl-2 border-l-2"
                    style={{ borderColor: isMe ? color : '#1f2937' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs flex-1" style={{ color: isMe ? color : '#9ca3af', fontWeight: isMe ? 700 : 400 }}>
                        {factionId}{isMe ? ' (you)' : ''}
                      </span>
                      <span className="text-[10px] font-mono text-gray-600">{f.politicalCapital} PC</span>
                      <span className="text-[10px] font-mono" style={{ color: getLambdaColor(f.lambda) }}>
                        λ{f.lambda.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-0.5 rounded-full bg-[#1a1a1a] overflow-hidden mb-1">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${f.objectiveProgress}%`, backgroundColor: color, opacity: 0.5 }} />
                    </div>
                    <div className="text-[9px] text-gray-700 font-mono truncate">
                      {lastEntry ? lastEntry.actionId.replace(/_/g, ' ') : '—'}
                    </div>
                  </motion.div>
                );
              }

              const stance = getFactionStance(factionId, gameState);
              return (
                <motion.div key={factionId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }} className="pl-2 border-l-2"
                  style={{ borderColor: isMe ? color : '#1f2937' }}
                >
                  {/* Rank + name + stance */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-gray-700 w-3 flex-shrink-0">{i + 1}</span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stance.threatColor }} />
                    <span className="text-xs flex-1" style={{ color: isMe ? color : '#9ca3af', fontWeight: isMe ? 700 : 400 }}>
                      {factionId}{isMe ? ' (you)' : ''}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: stance.threatColor }}>{stance.stance}</span>
                  </div>
                  {/* Progress bar + % */}
                  <div className="flex items-center gap-1.5 mb-0.5 pl-5">
                    <div className="flex-1 h-0.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${f.objectiveProgress}%`, backgroundColor: color, opacity: isMe ? 1 : 0.5 }} />
                    </div>
                    <span className="text-[10px] font-mono w-7 text-right flex-shrink-0"
                      style={{ color: isMe ? color : '#4b5563' }}>
                      {f.objectiveProgress}%
                    </span>
                  </div>
                  {/* Predicted move */}
                  <div className="text-[9px] text-gray-600 font-mono pl-5">{stance.predictedType}</div>
                </motion.div>
              );
            });
          })()}
        </div>
      </div>

      {/* Submission Status */}
      <motion.div
        className="text-[11px] font-mono text-center py-2 rounded-lg border border-[#1a1a1a]"
        animate={
          actionsProgress.total > 0 && actionsProgress.submitted === actionsProgress.total
            ? { color: ['#22c55e', '#4ade80', '#22c55e'], transition: { duration: 1.2, repeat: Infinity } }
            : {}
        }
        style={{ color: '#374151' }}
      >
        {actionsProgress.total > 0
          ? `${actionsProgress.submitted} / ${actionsProgress.total} locked in`
          : 'Waiting for submissions...'}
      </motion.div>

    </motion.div>
  );
}
