// src/engine/logicEngine.ts
// G-M-P-G Loop engine: Government Delay → Media Shock → Public Fear → Government Overreach

import { GAME_THEORY_DATA, FactionId } from './gameTheoryData';
import { applyPerception } from './perceptionEngine';
import { applyCascades } from './cascades';
import { checkWinConditions } from './winConditions';
import { FACTION_ACTIONS } from './factionActions';

export interface Faction {
  id: FactionId;
  name: string;
  politicalCapital: number;
  lambda: number;
  objectiveProgress: number;
  hiddenIntel: string[];
}

export interface ResourcePools {
  energyPool: number;       // 0–100 (global oil/energy supply %)
  fertilizerPool: number;   // 0–100 (global fertilizer supply %)
  chipPool: number;         // 0–100 (global semiconductor supply %)
  inflationIndex: number;   // 100 = baseline; 150+ = crisis
}

export interface GameState {
  turn: number;
  pools: ResourcePools;
  globalLambda: number;
  factions: Record<FactionId, Faction>;
  panicIndex: number;
  oilPrice: number;         // computed: 118 + panicIndex * 0.4
  cryptoShare: number;      // 0–100 %; tracks CRYPTO faction influence
  newsFeed: Array<{ title: string; impact: number; turn: number }>;
  activeCascades: string[];
  stabilityScore: number;
  overreachHistory: Array<{ factionId: FactionId; actionId: string; turn: number }>;
  consecutiveLowEnergy: number;
  gameOver: boolean;
  winner: FactionId | 'DIRECTOR' | 'GLOBAL_LOSS' | null;
}

export const INITIAL_STATE: GameState = {
  turn: 1,
  pools: {
    energyPool: 100,
    fertilizerPool: 100,
    chipPool: 100,
    inflationIndex: 100,
  },
  globalLambda: 1.0,
  factions: {
    US:      { id: 'US',      name: 'US/Israel Bloc',    politicalCapital: 50, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
    IRAN:    { id: 'IRAN',    name: 'Iran',              politicalCapital: 45, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
    CHINA:   { id: 'CHINA',   name: 'China',             politicalCapital: 55, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
    BRICS:   { id: 'BRICS',   name: 'BRICS Coalition',   politicalCapital: 40, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
    LEGACY:  { id: 'LEGACY',  name: 'Legacy Finance',    politicalCapital: 60, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
    CRYPTO:  { id: 'CRYPTO',  name: 'Crypto Ecosystem',  politicalCapital: 35, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
    EUROPE:  { id: 'EUROPE',  name: 'Europe Bloc',       politicalCapital: 48, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
    SE_ASIA: { id: 'SE_ASIA', name: 'SE Asia Coalition', politicalCapital: 38, lambda: 1.0, objectiveProgress: 0, hiddenIntel: [] },
  },
  panicIndex: 0,
  oilPrice: 118,
  cryptoShare: 8,
  newsFeed: [],
  activeCascades: [],
  stabilityScore: 100,
  overreachHistory: [],
  consecutiveLowEnergy: 0,
  gameOver: false,
  winner: null,
};

// === THE G-M-P-G LOOP ===
export function processTurn(
  state: GameState,
  playerActions: Partial<Record<FactionId, { actionId: string; delayAction?: string }>>
): GameState {
  const newState: GameState = {
    ...state,
    turn: state.turn + 1,
    pools: { ...state.pools },
    factions: { ...state.factions },
    newsFeed: [...state.newsFeed],
    activeCascades: [...state.activeCascades],
    overreachHistory: [...state.overreachHistory],
  };
  // Deep-copy factions
  (Object.keys(newState.factions) as FactionId[]).forEach(fId => {
    newState.factions[fId] = { ...newState.factions[fId], hiddenIntel: [...newState.factions[fId].hiddenIntel] };
  });

  // PHASE 1: G_Delay — hidden intel moves
  (Object.keys(playerActions) as FactionId[]).forEach(fId => {
    const action = playerActions[fId];
    if (action?.delayAction) {
      newState.factions[fId].hiddenIntel.push(action.delayAction);
    }
  });

  // PHASE 2: M_Shock — Media amplification via perceptionEngine (panic/stability only)
  // Also accumulate weighted lambda deltas for a single global apply below
  let totalLambdaShock = 0;
  (Object.keys(playerActions) as FactionId[]).forEach(fId => {
    const action = playerActions[fId];
    if (!action?.actionId) return;
    const factionActions = FACTION_ACTIONS[fId] ?? [];
    const actionData = factionActions.find(a => a.id === action.actionId);
    if (actionData) {
      // Media shock: affects panic + stability, NOT globalLambda (avoid double-counting)
      applyPerception(newState, { mediaType: actionData.mediaType, shockValue: actionData.shockValue });
      // Accumulate weighted lambda for single global apply
      const adj = GAME_THEORY_DATA.factionSpecificPayoffAdjustments[fId];
      const weightedDelta = actionData.lambdaDelta * (adj?.lambdaWeight ?? 1);
      totalLambdaShock += weightedDelta;
      // Faction-level lambda bump
      newState.factions[fId].lambda = Math.min(4.0, newState.factions[fId].lambda + Math.abs(weightedDelta));
    }
  });
  // Apply global lambda once from all actions combined (scaling keeps single-turn jumps manageable)
  newState.globalLambda = Math.min(5.0, Math.max(1.0, newState.globalLambda + totalLambdaShock * 0.12));

  // PHASE 3: P_Fear — panic drives oil price
  newState.panicIndex = Math.min(100, Math.floor(newState.globalLambda * 25 + (100 - newState.pools.energyPool) * 0.6));
  newState.oilPrice = Math.round(118 + newState.panicIndex * 0.4);

  // Nash lock notification
  if (newState.globalLambda > GAME_THEORY_DATA.lambdaThresholds.lockNash) {
    const alreadyNotified = newState.newsFeed.some(n => n.title.includes('Nash equilibrium locked'));
    if (!alreadyNotified) {
      newState.newsFeed.unshift({ title: 'Nash equilibrium locked — cooperation mathematically impossible', impact: 25, turn: newState.turn });
    }
  }

  // PHASE 4: G_Overreach — apply chosen actions
  (Object.keys(playerActions) as FactionId[]).forEach(fId => {
    const action = playerActions[fId];
    if (!action?.actionId) return;
    const factionActions = FACTION_ACTIONS[fId] ?? [];
    const actionData = factionActions.find(a => a.id === action.actionId);
    if (!actionData) return;

    // Deduct political capital
    newState.factions[fId].politicalCapital = Math.max(0,
      newState.factions[fId].politicalCapital - actionData.cost
    );

    // Apply pool deltas
    if (actionData.energyDelta) {
      newState.pools.energyPool = Math.max(5, Math.min(100,
        newState.pools.energyPool + actionData.energyDelta
      ));
    }
    if (actionData.fertilizerDelta) {
      newState.pools.fertilizerPool = Math.max(5, Math.min(100,
        newState.pools.fertilizerPool + actionData.fertilizerDelta
      ));
    }
    if (actionData.chipDelta) {
      newState.pools.chipPool = Math.max(5, Math.min(100,
        newState.pools.chipPool + actionData.chipDelta
      ));
    }
    if (actionData.inflationDelta) {
      newState.pools.inflationIndex = Math.max(100, Math.min(200,
        newState.pools.inflationIndex + actionData.inflationDelta
      ));
    }

    // Advance faction's objective progress based on shock value
    const progressGain = Math.round(actionData.shockValue * 0.45);
    newState.factions[fId].objectiveProgress = Math.min(100,
      newState.factions[fId].objectiveProgress + progressGain
    );

    // Track overreach history
    newState.overreachHistory.push({ factionId: fId, actionId: action.actionId, turn: newState.turn });
  });

  // PC regeneration — each faction recovers 12 PC/turn, capped at starting max
  const PC_MAX: Record<FactionId, number> = {
    US: 50, IRAN: 45, CHINA: 55, BRICS: 40, LEGACY: 60, CRYPTO: 35, EUROPE: 48, SE_ASIA: 38,
  };
  (Object.keys(newState.factions) as FactionId[]).forEach(fId => {
    newState.factions[fId].politicalCapital = Math.min(
      PC_MAX[fId],
      Math.max(0, newState.factions[fId].politicalCapital + 12)
    );
  });

  // Apply cascade events (pool thresholds + lambda thresholds)
  applyCascades(newState);

  // Derive cryptoShare from CRYPTO faction's objective progress (8% baseline + scaled progress)
  newState.cryptoShare = Math.min(100, 8 + Math.round(newState.factions['CRYPTO'].objectiveProgress * 0.92));

  // Hard cap: lambda can't increase more than 0.55 per turn (prevents cascade avalanche)
  newState.globalLambda = Math.min(newState.globalLambda, state.globalLambda + 0.55);

  // Track consecutive low energy
  newState.consecutiveLowEnergy = newState.pools.energyPool < 30
    ? (state.consecutiveLowEnergy + 1)
    : 0;

  // Stability formula
  newState.stabilityScore = Math.max(0, Math.round(
    state.stabilityScore
    - (newState.globalLambda * 6)
    - (100 - newState.pools.energyPool) * 0.5
    - (100 - newState.pools.fertilizerPool) * 0.3
  ));

  // Check win conditions — mutates gameOver / winner
  const winResult = checkWinConditions(newState);
  if (winResult.winner) {
    newState.gameOver = true;
    newState.winner = winResult.winner as GameState['winner'];
  }

  return newState;
}
