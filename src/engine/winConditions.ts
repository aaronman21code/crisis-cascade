// src/engine/winConditions.ts

import { GameState } from './logicEngine';
import { FactionId } from './gameTheoryData';

export interface WinCondition {
  id: string;
  faction: string;
  name: string;
  description: string;
  check: (state: GameState) => boolean;
  victoryMessage: string;
  flavorText: string;
}

export const WIN_CONDITIONS: WinCondition[] = [
  {
    id: 'us_petrodollar_preserved',
    faction: 'US',
    name: 'Petrodollar Preserved',
    description: 'Hormuz reopened with minimal concessions and petrodollar dominance maintained',
    check: s => s.pools.energyPool > 65 && s.globalLambda < 2.2 && s.factions['LEGACY'].objectiveProgress > 80,
    victoryMessage: 'US/Israel Victory — Petrodollar Era Survives',
    flavorText: 'You successfully contained the crisis before the loop could fully escalate.',
  },
  {
    id: 'iran_survival_and_influence',
    faction: 'IRAN',
    name: 'Strategic Survival & Influence',
    description: 'Survived strikes while forcing major concessions and raising global λ significantly',
    check: s => s.globalLambda > 3.0 && s.pools.energyPool < 50 && s.factions['IRAN'].objectiveProgress > 75,
    victoryMessage: 'Iran Victory — Blockade Achieved Strategic Goals',
    flavorText: 'Despite military pressure, Iran forced the world into a new energy and currency reality.',
  },
  {
    id: 'china_taiwan_tech_dominance',
    faction: 'CHINA',
    name: 'Taiwan Tech Leverage Achieved',
    description: 'Successfully pressured Taiwan during energy crisis and maintained manufacturing superiority',
    check: s => s.pools.chipPool < 40 && s.globalLambda > 2.8 && s.factions['CHINA'].objectiveProgress > 85,
    victoryMessage: 'China Victory — Taiwan Semiconductor Leverage Secured',
    flavorText: 'Energy crisis became the perfect cover for tech dominance.',
  },
  {
    id: 'brics_dedollarization_success',
    faction: 'BRICS',
    name: 'Dedollarization Complete',
    description: 'BRICS yuan/basket becomes dominant oil settlement mechanism',
    check: s => s.factions['CRYPTO'].objectiveProgress + s.factions['BRICS'].objectiveProgress > 120 && s.globalLambda > 2.5,
    victoryMessage: 'BRICS Victory — Petrodollar Era Ends',
    flavorText: 'The multipolar order has officially replaced the old unipolar system.',
  },
  {
    id: 'legacy_system_survival',
    faction: 'LEGACY',
    name: 'Legacy Finance Survives',
    description: 'Petrodollar rails and SWIFT remain primary settlement layer despite crisis',
    check: s => s.globalLambda < 2.3 && s.pools.inflationIndex < 140 && s.factions['LEGACY'].objectiveProgress > 70,
    victoryMessage: 'Legacy Finance Victory — System Holds',
    flavorText: 'Through careful defensive overreach, the old financial architecture endured.',
  },
  {
    id: 'crypto_settlement_dominance',
    faction: 'CRYPTO',
    name: 'Crypto Becomes New Settlement Layer',
    description: 'Crypto settles >45% of global oil trades and becomes the escape valve',
    check: s => s.factions['CRYPTO'].objectiveProgress > 85 && s.globalLambda > 2.6,
    victoryMessage: 'Crypto Victory — New Financial Order Established',
    flavorText: 'When legacy systems froze under fear, crypto filled the vacuum permanently.',
  },
  {
    id: 'europe_stabilization',
    faction: 'EUROPE',
    name: 'Europe Stabilized',
    description: 'Managed energy crisis without full societal collapse or major migration waves',
    check: s => s.turn >= 5 && s.pools.energyPool > 55 && s.pools.fertilizerPool > 50 && s.globalLambda < 2.8 && s.factions['EUROPE'].objectiveProgress > 65,
    victoryMessage: 'EuropeBloc Victory — Managed Fracture',
    flavorText: 'Europe navigated the crisis with pragmatic deals and avoided total breakdown.',
  },
  {
    id: 'se_asia_resilience',
    faction: 'SE_ASIA',
    name: 'SE_Asia Resilience & Leadership',
    description: 'Early lockdown measures protected domestic populations and gained Global South influence',
    check: s => s.pools.fertilizerPool > 45 && s.globalLambda > 2.4 && s.factions['SE_ASIA'].objectiveProgress > 80,
    victoryMessage: 'SE_Asia Victory — Early Action Paid Off',
    flavorText: 'By acting first, SE_Asia turned vulnerability into regional leadership.',
  },
];

export function calculateDirectorScore(state: GameState): number {
  const poolPenalty =
    (100 - state.pools.energyPool)     * 0.40 +
    (100 - state.pools.fertilizerPool)  * 0.35 +
    (100 - state.pools.chipPool)        * 0.25 +
    (state.pools.inflationIndex - 100)  * 0.30;
  const lambdaPenalty   = Math.max(0, state.globalLambda - 1.8) * 12;
  const cascadePenalty  = state.activeCascades.length * 8;
  return Math.max(0, Math.round(state.stabilityScore - poolPenalty - lambdaPenalty - cascadePenalty));
}

export interface WinCheckResult {
  winner: string | null;
  condition: WinCondition | null;
  directorScore?: number;
}

export function checkWinConditions(state: GameState): WinCheckResult {
  if (state.gameOver) return { winner: state.winner, condition: null };

  for (const condition of WIN_CONDITIONS) {
    if (condition.check(state)) {
      return { winner: condition.faction, condition };
    }
  }

  if (state.globalLambda >= 4.0 || state.pools.energyPool < 20) {
    return { winner: 'GLOBAL_LOSS', condition: null, directorScore: calculateDirectorScore(state) };
  }

  return { winner: null, condition: null };
}

export function updateObjectives(state: GameState): void {
  // Objective progress is now driven by actions in processTurn.
  // This function is kept as a no-op for server.ts backward compatibility.
}

export function getWinProgressSummary(state: GameState): string[] {
  return [
    ...WIN_CONDITIONS.map(c =>
      `${c.faction}: ${Math.round(state.factions[c.faction as FactionId]?.objectiveProgress ?? 0)}% toward ${c.name}`
    ),
    `Director Stability Score: ${calculateDirectorScore(state)}/100`,
  ];
}
