// frontend/src/components/TurnPanel.tsx
import { useGameStore } from '../store/game';
import { getActionsForFaction, getAffordableActions } from '@engine/factionActions';
import { FactionId } from '@engine/gameTheoryData';
import { isCooperationLocked } from '@engine/payoffEngine';

const PHASE_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  g_delay:    { label: 'G — Delay', desc: 'Hidden intel. Set your secret objective.', color: 'text-blue-400' },
  m_shock:    { label: 'M — Shock', desc: 'News feed amplifies. λ rising.', color: 'text-yellow-400' },
  p_fear:     { label: 'P — Fear', desc: 'Panic index spikes. Markets react.', color: 'text-orange-400' },
  g_overreach:{ label: 'G — Overreach', desc: 'Spend Political Capital. Choose your action.', color: 'text-red-400' },
  analysis:   { label: 'Analysis', desc: 'Loop acceleration revealed.', color: 'text-green-400' },
};

const SUBGAME_LABELS: Record<string, string> = {
  iranWar: 'Chicken',
  bricsCurrency: 'Stag Hunt',
  aiVsRobotics: 'Zero-Sum',
  legacyVsCrypto: 'Market Chicken',
  multipolarOrder: 'Network Game',
};

export function TurnPanel() {
  const { gameState, playerFaction, phase, pendingActionId, submitAction, submitDirectorActions, actionsProgress, subGames } = useGameStore();

  if (!playerFaction) return null;

  const isDirector = playerFaction === 'DIRECTOR';
  const factionId = isDirector ? null : playerFaction as FactionId;
  const faction = factionId ? gameState.factions[factionId] : null;
  const allActions = factionId ? getActionsForFaction(factionId) : [];
  const affordable = factionId ? getAffordableActions(factionId, faction?.politicalCapital ?? 0) : [];
  const locked = isCooperationLocked(gameState);

  const currentPhase = PHASE_LABELS[phase] ?? PHASE_LABELS.g_delay;

  return (
    <div className="bg-[#0d0d12] border border-[#1a1a2a] rounded-lg p-4 flex flex-col gap-4">
      {/* Phase indicator */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <PhaseSteps current={phase} />
        </div>
        <div className={`text-sm font-bold ${currentPhase.color}`}>{currentPhase.label}</div>
        <div className="text-xs text-gray-500">{currentPhase.desc}</div>
      </div>

      {/* Nash lock warning */}
      {locked && (
        <div className="border border-red-500/50 bg-red-500/10 rounded p-2 text-xs text-red-400">
          NASH LOCK ACTIVE — Cooperative moves are mathematically impossible. λ = {gameState.globalLambda.toFixed(2)}
        </div>
      )}

      {/* Political Capital */}
      {faction && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Political Capital</span>
          <span className="font-mono text-white">{faction.politicalCapital} PC</span>
        </div>
      )}

      {/* Action cards */}
      {factionId && (phase === 'g_delay' || phase === 'g_overreach') && (
        <div>
          <div className="text-xs text-gray-500 uppercase mb-2">Your Actions</div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {allActions.map(action => {
              const canAfford = (faction?.politicalCapital ?? 0) >= action.cost;
              const isPending = pendingActionId === action.id;
              const subGameLabel = SUBGAME_LABELS[action.subGameTrigger] ?? action.subGameTrigger;
              return (
                <button
                  key={action.id}
                  disabled={!canAfford || !!pendingActionId}
                  onClick={() => submitAction(action.id)}
                  className={`w-full text-left p-3 rounded border transition ${
                    isPending
                      ? 'border-green-500 bg-green-500/10'
                      : canAfford
                        ? 'border-[#2a2a3a] hover:border-[#3a3a5a] bg-[#111] hover:bg-[#15151f]'
                        : 'border-[#1a1a1a] opacity-40 cursor-not-allowed bg-[#0a0a0a]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-white">{action.name}</span>
                    <span className="text-xs font-mono text-yellow-400 shrink-0">{action.cost} PC</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{action.description}</div>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-xs px-1.5 py-0.5 bg-[#1a1a2a] rounded text-blue-400">{subGameLabel}</span>
                    <span className="text-xs text-gray-600">λ +{action.lambdaDelta.toFixed(2)}</span>
                    {action.energyDelta !== undefined && action.energyDelta !== 0 && (
                      <span className={`text-xs ${action.energyDelta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        Energy {action.energyDelta > 0 ? '+' : ''}{action.energyDelta}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Director mode — quick action panel */}
      {isDirector && (phase === 'g_delay' || phase === 'g_overreach') && (
        <DirectorPanel />
      )}

      {/* Submitted status */}
      {pendingActionId && (
        <div className="text-xs text-green-400">
          Action submitted. Waiting for others... ({actionsProgress.submitted}/{actionsProgress.total})
        </div>
      )}

      {/* Sub-game status */}
      {subGames.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase mb-2">Sub-Games</div>
          <div className="space-y-1">
            {subGames.map(sg => (
              <div key={sg.key} className="text-xs flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  sg.equilibriumState === 'locked' ? 'bg-red-500' :
                  sg.equilibriumState === 'dominated' ? 'bg-orange-500' :
                  sg.equilibriumState === 'shifting' ? 'bg-yellow-500' : 'bg-green-500'
                }`}></span>
                <span className="text-gray-300">{SUBGAME_LABELS[sg.key] ?? sg.key}</span>
                <span className="text-gray-500">— {sg.dominantStrategy}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseSteps({ current }: { current: string }) {
  const phases = ['g_delay', 'm_shock', 'p_fear', 'g_overreach'];
  return (
    <div className="flex items-center gap-1">
      {phases.map((p, i) => (
        <div key={p} className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${current === p ? 'bg-white' : 'bg-[#2a2a2a]'}`} />
          {i < phases.length - 1 && <div className="w-3 h-px bg-[#2a2a2a]" />}
        </div>
      ))}
    </div>
  );
}

function DirectorPanel() {
  const { gameState, submitDirectorActions } = useGameStore();
  const factionIds = Object.keys(gameState.factions) as FactionId[];

  const [selections, setSelections] = React.useState<Partial<Record<FactionId, string>>>({});

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
      {factionIds.map(fId => {
        const actions = getAffordableActions(fId, gameState.factions[fId].politicalCapital);
        return (
          <div key={fId}>
            <div className="text-xs text-gray-400 mb-1">{fId}</div>
            <select
              className="w-full bg-[#111] border border-[#2a2a2a] text-white text-xs rounded px-2 py-1"
              value={selections[fId] ?? ''}
              onChange={e => pick(fId, e.target.value)}
            >
              <option value="">— Bot fills —</option>
              {actions.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.cost} PC)</option>
              ))}
            </select>
          </div>
        );
      })}
      <button
        onClick={submitAll}
        className="w-full py-2 bg-red-600 hover:bg-red-500 rounded text-xs font-bold transition"
      >
        Process Turn
      </button>
    </div>
  );
}

import React from 'react';
