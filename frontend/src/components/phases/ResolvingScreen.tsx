// frontend/src/components/phases/ResolvingScreen.tsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameHeader } from '../shared/GameHeader';
import { FACTION_COLORS } from '../shared/FactionIntelPanel';
import { useGameStore } from '../../store/game';
import { abstractLambda } from '../../utils/stanceEngine';
import { FACTION_ACTIONS } from '@engine/factionActions';
import { FactionId } from '@engine/gameTheoryData';

const FACTION_ORDER: FactionId[] = ['US', 'IRAN', 'CHINA', 'BRICS', 'LEGACY', 'CRYPTO', 'EUROPE', 'SE_ASIA'];

// Reveal one faction per 1.1s, then show metrics after all revealed
const REVEAL_INTERVAL = 1100;
const METRICS_DELAY = 400;

export function ResolvingScreen() {
  const { gameState, prevState, resolvedActions, playerFaction, advanceToAnalysis } = useGameStore();

  const [revealedCount, setRevealedCount] = useState(0);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const factionCount = FACTION_ORDER.filter(fId => resolvedActions[fId]).length;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRevealedCount(prev => {
        const next = prev + 1;
        if (next >= factionCount) {
          clearInterval(timerRef.current!);
          setTimeout(() => {
            setMetricsVisible(true);
            setTimeout(() => advanceToAnalysis(), 2500);
          }, METRICS_DELAY);
        }
        return next;
      });
    }, REVEAL_INTERVAL);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [factionCount]);

  const prevLambda  = prevState?.globalLambda  ?? gameState.globalLambda;
  const prevEnergy  = prevState?.pools.energyPool ?? gameState.pools.energyPool;
  const prevPanic   = prevState?.panicIndex    ?? gameState.panicIndex;

  const lambdaLabel = abstractLambda(gameState.globalLambda);
  const lambdaDelta = gameState.globalLambda - prevLambda;

  const newCascades = gameState.activeCascades.filter(
    c => !(prevState?.activeCascades ?? []).includes(c)
  );

  return (
    <motion.div
      className="min-h-screen text-white p-6"
      style={{ backgroundColor: '#080810' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35 }}
    >
      <div className="max-w-2xl mx-auto">
        <GameHeader />

        <div className="text-xs text-gray-600 uppercase tracking-widest mt-4 mb-6">
          Turn {gameState.turn} — Resolving
        </div>

        {/* Faction execution feed */}
        <div className="space-y-3 mb-8">
          {FACTION_ORDER.map((fId, i) => {
            const resolved = resolvedActions[fId];
            if (!resolved) return null;

            const isRevealed = i < revealedCount;
            const color = FACTION_COLORS[fId] ?? '#888';
            const isMe = fId === playerFaction;

            // Look up lambdaDelta for this action
            const actions = FACTION_ACTIONS[fId];
            const actionData = actions?.find(a => a.id === resolved.actionId);
            const delta = actionData?.lambdaDelta ?? 0;
            const deltaColor = delta <= -0.15 ? '#22c55e' : delta < 0.15 ? '#6b7280' : delta < 0.30 ? '#f97316' : '#ef4444';
            const deltaLabel = delta >= 0 ? `+${delta.toFixed(2)}λ` : `${delta.toFixed(2)}λ`;

            return (
              <AnimatePresence key={fId}>
                {isRevealed && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="flex items-start gap-4 rounded-xl border p-4"
                    style={{
                      borderColor: isMe ? `${color}50` : '#1a1a1a',
                      backgroundColor: isMe ? `${color}08` : '#0d0d12',
                    }}
                  >
                    {/* Faction dot + name */}
                    <div className="flex-shrink-0 pt-0.5">
                      <span
                        className="w-2 h-2 rounded-full block"
                        style={{ backgroundColor: color }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-mono font-bold"
                          style={{ color: isMe ? color : '#9ca3af' }}
                        >
                          {fId}{isMe ? ' (you)' : ''}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: deltaColor }}>
                          {deltaLabel}
                        </span>
                      </div>
                      <div className="text-sm text-white leading-snug">{resolved.actionName}</div>
                    </div>

                    {/* Executing pulse */}
                    <motion.span
                      className="text-[9px] font-mono text-gray-700 flex-shrink-0 pt-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      executed
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>

        {/* Final metrics + cascades — appear after all factions revealed */}
        <AnimatePresence>
          {metricsVisible && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Global metrics */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <MetricDelta
                  label="Global λ"
                  value={lambdaLabel.label}
                  valueColor={lambdaLabel.color}
                  delta={lambdaDelta >= 0 ? `+${lambdaDelta.toFixed(2)}` : lambdaDelta.toFixed(2)}
                  deltaColor={lambdaDelta > 0 ? '#ef4444' : '#22c55e'}
                />
                <MetricDelta
                  label="Energy"
                  value={`${gameState.pools.energyPool}%`}
                  valueColor={gameState.pools.energyPool > 65 ? '#22c55e' : gameState.pools.energyPool > 40 ? '#f97316' : '#ef4444'}
                  delta={gameState.pools.energyPool - prevEnergy >= 0
                    ? `+${gameState.pools.energyPool - prevEnergy}`
                    : `${gameState.pools.energyPool - prevEnergy}`}
                  deltaColor={gameState.pools.energyPool >= prevEnergy ? '#22c55e' : '#ef4444'}
                />
                <MetricDelta
                  label="Panic"
                  value={`${gameState.panicIndex}`}
                  valueColor={gameState.panicIndex < 40 ? '#22c55e' : gameState.panicIndex < 70 ? '#f97316' : '#ef4444'}
                  delta={gameState.panicIndex - prevPanic >= 0
                    ? `+${gameState.panicIndex - prevPanic}`
                    : `${gameState.panicIndex - prevPanic}`}
                  deltaColor={gameState.panicIndex <= prevPanic ? '#22c55e' : '#ef4444'}
                />
              </div>

              {/* New cascades */}
              {newCascades.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-wrap gap-2 mb-5"
                >
                  {newCascades.map(c => (
                    <span
                      key={c}
                      className="text-xs font-mono px-2 py-1 rounded border border-red-800 bg-red-950/30 text-red-400"
                    >
                      ⚡ {c.replace(/_/g, ' ')}
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Objective progress deltas */}
              <div className="space-y-2 mb-6">
                {FACTION_ORDER.map(fId => {
                  const curr = gameState.factions[fId as FactionId];
                  const prev = prevState?.factions[fId as FactionId];
                  if (!curr) return null;
                  const delta = curr.objectiveProgress - (prev?.objectiveProgress ?? curr.objectiveProgress);
                  const color = FACTION_COLORS[fId] ?? '#888';
                  const isMe = fId === playerFaction;
                  return (
                    <div key={fId} className="flex items-center gap-3">
                      <span
                        className="text-[10px] font-mono w-16"
                        style={{ color: isMe ? color : '#6b7280', fontWeight: isMe ? 700 : 400 }}
                      >
                        {fId}
                      </span>
                      <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: color, opacity: isMe ? 1 : 0.5 }}
                          initial={{ width: `${prev?.objectiveProgress ?? 0}%` }}
                          animate={{ width: `${curr.objectiveProgress}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      {delta !== 0 && (
                        <span
                          className="text-[10px] font-mono w-10 text-right"
                          style={{ color: delta > 0 ? '#22c55e' : '#ef4444' }}
                        >
                          {delta > 0 ? '+' : ''}{delta}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function MetricDelta({
  label, value, valueColor, delta, deltaColor,
}: {
  label: string; value: string; valueColor: string; delta: string; deltaColor: string;
}) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d12] p-4 text-center">
      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold font-mono mb-1" style={{ color: valueColor }}>{value}</div>
      <div className="text-[10px] font-mono" style={{ color: deltaColor }}>{delta}</div>
    </div>
  );
}
