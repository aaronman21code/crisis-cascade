// frontend/src/components/phases/GOverreachScreen.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameHeader } from '../shared/GameHeader';
import { ActionCard } from '../shared/ActionCard';
import { FactionIntelPanel, FACTION_COLORS } from '../shared/FactionIntelPanel';
import { PhaseHint } from '../shared/PhaseHint';
import { useGameStore } from '../../store/game';
import { getAvailableActions } from '@engine/factionActions';
import { isCooperationLocked } from '@engine/payoffEngine';
import { GAME_THEORY_DATA, FactionId } from '@engine/gameTheoryData';
import { scoreActions, abstractResource } from '../../utils/stanceEngine';

function DirectorPanel() {
  const { gameState, submitDirectorActions } = useGameStore();
  const factionIds = Object.keys(gameState.factions) as FactionId[];
  const defaultSelections = React.useMemo(() => {
    const init: Partial<Record<FactionId, string>> = {};
    factionIds.forEach(fId => { init[fId] = 'wait_and_watch'; });
    return init;
  }, []);
  const [selections, setSelections] = React.useState<Partial<Record<FactionId, string>>>(defaultSelections);

  function pick(fId: FactionId, actionId: string) {
    setSelections(s => ({ ...s, [fId]: actionId }));
  }

  function submitAll() {
    const actions: Partial<Record<FactionId, { actionId: string }>> = {};
    factionIds.forEach(fId => {
      if (selections[fId]) actions[fId] = { actionId: selections[fId]! };
    });
    submitDirectorActions(actions);
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Director — Assign Faction Actions</div>
      {factionIds.map(fId => {
        const actions = getAvailableActions(fId, gameState.overreachHistory, gameState.turn)
          .filter(a => a.cost <= gameState.factions[fId].politicalCapital && a.id !== 'wait_and_watch');
        return (
          <div key={fId}>
            <div className="text-xs text-gray-400 mb-1">{fId}</div>
            <select
              className="w-full bg-[#111] border border-[#2a2a2a] text-white text-xs rounded px-2 py-1.5"
              value={selections[fId] ?? ''}
              onChange={e => pick(fId as FactionId, e.target.value)}
            >
              <option value="wait_and_watch">Wait and Watch (0 PC)</option>
              {actions.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.cost} PC)</option>
              ))}
            </select>
          </div>
        );
      })}
      <button
        onClick={submitAll}
        className="w-full py-3 bg-red-600 hover:bg-red-500 rounded font-bold text-sm transition"
      >
        Process Turn
      </button>
    </div>
  );
}

export function GOverreachScreen() {
  const {
    gameState, playerFaction, pendingActionId, submitAction, actionsProgress, subGames,
  } = useGameStore();

  const [showAll, setShowAll] = useState(false);

  const isDirector = playerFaction === 'DIRECTOR';
  const faction = playerFaction && !isDirector ? gameState.factions[playerFaction as FactionId] : null;
  const pc = faction?.politicalCapital ?? 0;
  const factionColor = FACTION_COLORS[playerFaction ?? ''] ?? '#60a5fa';
  const nashLocked = isCooperationLocked(gameState);

  const allActions = playerFaction && !isDirector
    ? getAvailableActions(playerFaction, gameState.overreachHistory, gameState.turn)
    : [];

  // Last action this faction took — deranked so it won't repeat at top
  const lastActionId = gameState.overreachHistory
    .filter(h => h.factionId === playerFaction)
    .slice(-1)[0]?.actionId;

  // Dynamic count (3/4/5 based on λ); showAll overrides to full list
  const topActions = scoreActions(allActions, gameState, subGames, 'g_overreach', lastActionId);

  const displayActions = isDirector
    ? allActions
    : showAll
      ? allActions
      : topActions;

  const submittedAction = pendingActionId ? allActions.find(a => a.id === pendingActionId) : null;

  // Helper: get live sub-game state for an action's subGame
  function getSubGameState(subGameKey: string): string | undefined {
    return subGames.find(sg => sg.key === subGameKey)?.equilibriumState;
  }

  // ── Director: full-width command center ───────────────────────────
  if (isDirector) {
    return (
      <motion.div
        className="min-h-screen text-white p-4 md:p-6"
        style={{ backgroundColor: '#08000f' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.35 }}
      >
        <div className="max-w-3xl mx-auto">
          <GameHeader showLambda />
          {nashLocked && (
            <div className="mt-3 px-4 py-3 rounded-lg border border-red-800 bg-red-950/40 text-red-400 text-xs font-mono tracking-wider">
              ⚠ NASH LOCK — λ &gt; {GAME_THEORY_DATA.lambdaThresholds.lockNash} · Cooperation payoff collapsed
            </div>
          )}
          <div className="mt-6">
            <DirectorPanel />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-screen text-white p-4 md:p-6"
      style={{ backgroundColor: '#08000f' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35 }}
    >
      <div className="max-w-5xl mx-auto">
        <GameHeader showLambda />

        {/* Nash lock banner */}
        <AnimatePresence>
          {nashLocked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 px-4 py-3 rounded-lg border border-red-800 bg-red-950/40 text-red-400 text-xs font-mono tracking-wider"
            >
              ⚠ NASH LOCK — λ &gt; {GAME_THEORY_DATA.lambdaThresholds.lockNash} · Cooperation payoff collapsed
            </motion.div>
          )}
        </AnimatePresence>

        <PhaseHint
          phaseKey="g_overreach"
          text="Action Phase — commit your faction's move for this turn. All factions act simultaneously. Every action shifts tension (λ) for everyone."
        />

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: factionColor }}></span>
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">G — OVERREACH · ACTION PHASE</span>
          </div>
          <p className="text-[11px] text-gray-600">Commit your faction's action for this turn. Every move is simultaneous — choose knowing others are choosing too.</p>
        </div>

        <div className="mt-4 grid md:grid-cols-[1fr_280px] gap-6 items-start">

          {/* LEFT — Actions */}
          <div>
            {/* Resource indicator */}
            {!isDirector && (
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Select an action — your choice locks immediately</span>
                <span
                  className="text-xs font-mono px-3 py-1 rounded-full border"
                  style={{ borderColor: `${factionColor}40`, color: factionColor }}
                >
                  Resources: {abstractResource(pc)}
                </span>
              </div>
            )}

            {/* Submitted state */}
            <AnimatePresence>
              {submittedAction && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className="mb-4 rounded-xl border p-5"
                  style={{ borderColor: `${factionColor}50`, backgroundColor: `${factionColor}08`, boxShadow: `0 0 0 1px ${factionColor}20, 0 0 20px 0 ${factionColor}10` }}
                >
                  <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: factionColor }}>✓ Action locked</div>
                  <div className="font-bold text-base text-white mb-1">{submittedAction.name}</div>
                  <div className="text-sm text-gray-400 leading-relaxed">{submittedAction.flavorText}</div>
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
              )}
            </AnimatePresence>

            {/* Action list */}
            {!isDirector && !pendingActionId && (
              <div>
                <div className="space-y-3">
                  {displayActions.map((action, i) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      canAfford={pc >= action.cost}
                      isSelected={false}
                      factionColor={factionColor}
                      onClick={() => submitAction(action.id)}
                      index={i}
                      subGameState={getSubGameState(action.subGameTrigger)}
                      showRaw={false}
                    />
                  ))}
                </div>

                {/* See all / collapse toggle */}
                {allActions.length > topActions.length && (
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="text-[10px] text-gray-700 hover:text-gray-400 mt-3 transition"
                  >
                    {showAll ? '− Show fewer' : `+ See all ${allActions.length} options`}
                  </button>
                )}
              </div>
            )}

            {/* Director mode */}
            {isDirector && (
              <div className="mt-2 border border-[#2a2a2a] rounded-xl p-5">
                {/* Director sees all faction actions with full raw data */}
                <div className="space-y-6 mb-6">
                  {(Object.keys(gameState.factions) as FactionId[]).map(fId => {
                    const fActions = getAvailableActions(fId, gameState.overreachHistory, gameState.turn);
                    const fColor = FACTION_COLORS[fId] ?? '#888';
                    return (
                      <div key={fId}>
                        <div className="text-xs font-mono mb-2" style={{ color: fColor }}>{fId}</div>
                        <div className="space-y-2">
                          {fActions.map((action, i) => (
                            <ActionCard
                              key={action.id}
                              action={action}
                              canAfford={gameState.factions[fId].politicalCapital >= action.cost}
                              isSelected={false}
                              factionColor={fColor}
                              onClick={() => {}}
                              index={i}
                              showRaw={true}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <DirectorPanel />
              </div>
            )}
          </div>

          {/* RIGHT — Faction Intel */}
          <div className="md:sticky md:top-6 border-l border-[#12121e] bg-[#06060e] rounded-r-lg pl-2">
            <FactionIntelPanel variant="full" isDirector={isDirector} />
          </div>

        </div>
      </div>
    </motion.div>
  );
}
