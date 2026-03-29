// frontend/src/components/phases/GDelayScreen.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { GameHeader } from '../shared/GameHeader';
import { ActionCard } from '../shared/ActionCard';
import { FactionIntelPanel, FACTION_COLORS } from '../shared/FactionIntelPanel';
import { PhaseHint } from '../shared/PhaseHint';
import { useGameStore } from '../../store/game';
import { getAvailableActions } from '@engine/factionActions';
import { FactionId } from '@engine/gameTheoryData';
import { scoreActions } from '../../utils/stanceEngine';

const FACTION_INTEL: Record<string, string> = {
  US:       'Hormuz shipping at 23% of normal. Petrodollar window: 3–4 weeks.',
  IRAN:     'Strait is ours. Every barrel blocked is leverage. Watch for naval escalation.',
  CHINA:    'Factory energy reserves at 60%. Blackout threshold is 40% — 2 weeks away.',
  BRICS:    'Saudi and India are wavering. Yuan clearing window opens this phase.',
  LEGACY:   'SWIFT defection risk elevated. Capital flight models show 3% crypto bleed per week.',
  CRYPTO:   'Legacy freeze events are your signal. Every block = 2–4% settlement share.',
  DIRECTOR: 'Global stability: degrading. λ acceleration driven by uncoordinated defection.',
};

export function GDelayScreen() {
  const {
    gameState, playerFaction, pendingActionId, submitAction, actionsProgress, subGames, skipToOverreach,
  } = useGameStore();

  const isDirector = playerFaction === 'DIRECTOR';
  const faction = playerFaction && !isDirector
    ? gameState.factions[playerFaction as FactionId]
    : null;
  const pc = faction?.politicalCapital ?? 0;
  const factionColor = FACTION_COLORS[playerFaction ?? ''] ?? '#60a5fa';
  const intel = FACTION_INTEL[playerFaction ?? ''] ?? '';
  const objectiveProgress = faction?.objectiveProgress ?? 0;

  // Last action this faction took — exclude from next turn's top options
  const lastActionId = gameState.overreachHistory
    .filter(h => h.factionId === playerFaction)
    .slice(-1)[0]?.actionId;

  const allActions = playerFaction && !isDirector
    ? getAvailableActions(playerFaction, gameState.overreachHistory, gameState.turn)
    : [];

  // Director sees all; players see adaptive set (delay-phase scoring)
  const displayActions = isDirector
    ? allActions
    : scoreActions(allActions, gameState, subGames, 'g_delay', lastActionId);

  const submittedAction = pendingActionId
    ? allActions.find(a => a.id === pendingActionId) ?? null
    : null;

  function getSubGameState(key: string): string | undefined {
    return subGames.find(sg => sg.key === key)?.equilibriumState;
  }

  // ── Director: full-width command overview ──────────────────────────
  if (isDirector) {
    return (
      <motion.div
        className="min-h-screen text-white p-6"
        style={{ backgroundColor: '#070b14' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.35 }}
      >
        <div className="max-w-3xl mx-auto">
          <GameHeader />
          <div className="mb-5 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: factionColor }}></span>
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">G — DELAY · INTEL PHASE</span>
            </div>
            <p className="text-[11px] text-gray-600">Review your faction's position and choose one action to lock in before the shock lands.</p>
          </div>

          <div className="mb-6 p-4 rounded-xl border border-[#1a1a1a] bg-[#0d0d12]">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">Energy</div>
                <div className="text-xl font-bold font-mono" style={{ color: gameState.pools.energyPool > 65 ? '#22c55e' : gameState.pools.energyPool > 40 ? '#f97316' : '#ef4444' }}>
                  {gameState.pools.energyPool > 65 ? 'Stable' : gameState.pools.energyPool > 40 ? 'Strained' : 'Critical'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">λ</div>
                <div className="text-xl font-bold font-mono" style={{ color: gameState.globalLambda >= 2.5 ? '#ef4444' : gameState.globalLambda >= 2.0 ? '#f97316' : '#22c55e' }}>
                  {gameState.globalLambda.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">Stability</div>
                <div className="text-xl font-bold font-mono" style={{ color: gameState.stabilityScore > 60 ? '#22c55e' : gameState.stabilityScore > 30 ? '#f97316' : '#ef4444' }}>
                  {gameState.stabilityScore}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 p-4 rounded-xl border border-[#1a1a1a] bg-[#0d0d12]">
            <div className="text-xs text-gray-600 uppercase tracking-widest mb-3">Strategic Theaters</div>
            <div className="space-y-2">
              {subGames.map(sg => (
                <div key={sg.key} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 truncate flex-1 mr-3">{sg.name}</span>
                  <span className="font-mono" style={{ color: sg.equilibriumState === 'locked' ? '#ef4444' : sg.equilibriumState === 'dominated' ? '#f97316' : sg.equilibriumState === 'shifting' ? '#eab308' : '#22c55e' }}>
                    {sg.equilibriumState}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={skipToOverreach}
            className="px-6 py-3 bg-white text-black rounded font-bold text-sm hover:bg-gray-200 transition"
          >
            Proceed to Action Phase →
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-screen text-white p-4 md:p-6"
      style={{ backgroundColor: '#070b14' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35 }}
    >
      <div className="max-w-5xl mx-auto">
        <GameHeader />

        <PhaseHint
          phaseKey="g_delay"
          text="This is the Intel Phase. Pick one action — your choice locks in immediately and can't be changed. Other players are choosing at the same time."
        />

        <div className="mb-5 mt-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: factionColor }}></span>
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">G — DELAY · INTEL PHASE</span>
          </div>
          <p className="text-[11px] text-gray-600">Review your faction's position and choose one action to lock in before the shock lands.</p>
        </div>

        <div className="md:grid md:grid-cols-[1fr_280px] gap-6 items-start">

          {/* LEFT — identity card + actions */}
          <div>
            {/* Faction identity card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-xl border border-l-[3px] p-5 mb-6"
              style={{ borderColor: `${factionColor}30`, borderLeftColor: factionColor, backgroundColor: '#0a0a0f' }}
            >
              <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-1">Your Faction · Intel</div>
              <div className="font-bold text-lg mb-1" style={{ color: factionColor }}>
                {playerFaction}
              </div>
              <p className="text-sm text-gray-400 italic leading-relaxed mb-4">{intel}</p>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 uppercase tracking-wider">Objective Progress</span>
                </div>
                <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: factionColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${objectiveProgress}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Actions or submitted state */}
            <AnimatePresence mode="wait">
              {pendingActionId ? (
                <motion.div
                  key="submitted"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className="rounded-xl border p-5 mb-6"
                  style={{ borderColor: `${factionColor}50`, backgroundColor: `${factionColor}08`, boxShadow: `0 0 0 1px ${factionColor}20, 0 0 20px 0 ${factionColor}10` }}
                >
                  <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: factionColor }}>✓ Intel locked</div>
                  {submittedAction && (
                    <>
                      <div className="font-bold text-white mb-1">{submittedAction.name}</div>
                      <div className="text-sm text-gray-400 leading-relaxed">{submittedAction.flavorText}</div>
                    </>
                  )}
                  {actionsProgress.total > 0 && (
                    <div className="flex items-center gap-1.5 mt-3">
                      {Array.from({ length: actionsProgress.total }).map((_, i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: i < actionsProgress.submitted ? factionColor : '#2a2a2a' }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.08 }}
                        />
                      ))}
                      <span className="text-[10px] text-gray-600 ml-1">{actionsProgress.submitted}/{actionsProgress.total} committed</span>
                    </div>
                  )}
                </motion.div>
              ) : (
                !isDirector && displayActions.length > 0 && (
                  <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">Select an action — your choice locks immediately</div>
                    <div className="space-y-3">
                      {displayActions.map((action, i) => (
                        <div key={action.id} className="relative">
                          {/* Intel Pick badge on top-scored action */}
                          {i === 0 && (
                            <span className="absolute -top-2 right-3 z-10 flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#0d1a0d] text-green-500 border border-green-900">
                              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse inline-block"></span>
                              Intel Pick
                            </span>
                          )}
                          <ActionCard
                            action={action}
                            canAfford={pc >= action.cost}
                            isSelected={false}
                            factionColor={factionColor}
                            onClick={() => submitAction(action.id)}
                            index={i}
                            subGameState={getSubGameState(action.subGameTrigger)}
                            showRaw={false}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )
              )}
            </AnimatePresence>

          </div>

          {/* RIGHT — full faction intel panel */}
          <div className="md:sticky md:top-6 border-l border-[#12121e] bg-[#06060e] rounded-r-lg pl-2">
            <FactionIntelPanel variant="full" isDirector={isDirector} />
          </div>

        </div>
      </div>
    </motion.div>
  );
}
