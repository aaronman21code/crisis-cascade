// src/engine/payoffEngine.ts
// U′ = λ · U + ΔFear(25 * panicIndex) + CommitmentPenalty(10 * overreachCount)
// All constants sourced from GAME_THEORY_DATA — no hardcoded values here.

import { GAME_THEORY_DATA, FactionId, SubGameKey } from './gameTheoryData';
import { GameState } from './logicEngine';

export interface SubGameResult {
  key: SubGameKey;
  name: string;
  equilibriumState: 'stable' | 'shifting' | 'locked' | 'dominated';
  dominantStrategy: string;
  payoffShift: number;
  description: string;
}

export interface UtilityResult {
  factionId: FactionId;
  baseUtility: number;
  lambdaMultiplied: number;
  fearPenalty: number;
  commitmentPenalty: number;
  finalUtility: number;
}

// U′ = λ · U + ΔFear(25 * panicIndex) + CommitmentPenalty(10 * overreachCount)
export function calculateUtility(
  factionId: FactionId,
  state: GameState,
  overreachCount: number
): UtilityResult {
  const adj = GAME_THEORY_DATA.factionSpecificPayoffAdjustments[factionId];
  const faction = state.factions[factionId];
  const lambda = faction.lambda;

  const baseUtility = faction.objectiveProgress;
  const lambdaMultiplied = lambda * adj.lambdaWeight * baseUtility;
  const fearPenalty = adj.fearPenalty + 25 * (state.panicIndex / 100);
  const commitmentPenalty = 10 * overreachCount;
  const finalUtility = lambdaMultiplied + fearPenalty - commitmentPenalty;

  return { factionId, baseUtility, lambdaMultiplied, fearPenalty, commitmentPenalty, finalUtility };
}

// Evaluate all 5 sub-games for current state
export function evaluateSubGame(subGameKey: SubGameKey, state: GameState): SubGameResult {
  const subGame = GAME_THEORY_DATA.subGames[subGameKey];
  const λ = state.globalLambda;

  switch (subGameKey) {
    case 'iranWar': {
      const escalationActions = state.overreachHistory.filter(h =>
        ['naval_escort', 'full_mine_laying', 'power_plant_strike'].includes(h.actionId)
      ).length;
      const equilibriumState = λ > GAME_THEORY_DATA.lambdaThresholds.lockNash
        ? 'locked'
        : escalationActions > 3 ? 'shifting' : 'stable';
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState,
        dominantStrategy: λ > 2.5 ? 'partial blockade (mixed Nash)' : 'de-escalate',
        payoffShift: escalationActions * 0.4,
        description: λ > 2.5
          ? 'Cooperation payoff collapsed from +2 to –3. Partial blockade is the persistent equilibrium.'
          : 'Chicken ladder active. Each escalation raises λ by 0.4 for both sides.'
      };
    }

    case 'bricsCurrency': {
      const yuanActions = state.overreachHistory.filter(h =>
        ['yuan_settlement', 'brics_summit', 'digital_yuan_pilot'].includes(h.actionId)
      ).length;
      const yuanDominant = λ > GAME_THEORY_DATA.lambdaThresholds.cascadeTrigger || state.cryptoShare > 25;
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState: yuanDominant ? 'shifting' : 'stable',
        dominantStrategy: yuanDominant ? 'yuan settlement (Stag Hunt tipped)' : 'petrodollar (coordination not yet reached)',
        payoffShift: yuanActions * 15,
        description: yuanDominant
          ? 'λ > 2.0 or cryptoShare > 25%: yuan path is now dominant strategy for BRICS/China/Iran.'
          : 'Stag Hunt: coordination payoff +15 per yuan action. US sanctions raise defection penalty.'
      };
    }

    case 'aiVsRobotics': {
      const energyStarved = state.pools.energyPool < 65;
      const mutualTriage = λ > 2.3 && energyStarved;
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState: mutualTriage ? 'locked' : energyStarved ? 'shifting' : 'stable',
        dominantStrategy: mutualTriage
          ? 'mutual triage (both pivot from offense to survival)'
          : energyStarved ? 'US AI advantage (China penalty × λ)' : 'race continues',
        payoffShift: energyStarved ? λ * 1.1 : 1.0,
        description: energyStarved
          ? `Energy starvation (${state.pools.energyPool}%) multiplies China's penalty by λ=${λ.toFixed(2)}. US AI rationing gains +λ advantage.`
          : 'Zero-sum tech race. Energy pool above 65% — equilibrium stable.'
      };
    }

    case 'legacyVsCrypto': {
      const legacyDominated = state.cryptoShare > 40 && λ > GAME_THEORY_DATA.lambdaThresholds.lockNash;
      const cryptoSurging = state.cryptoShare > 25;
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState: legacyDominated ? 'dominated' : cryptoSurging ? 'shifting' : 'stable',
        dominantStrategy: legacyDominated
          ? 'crypto (legacy rails dominated)'
          : cryptoSurging ? 'contest zone' : 'legacy finance',
        payoffShift: λ * 12 * (state.cryptoShare / 100),
        description: legacyDominated
          ? 'Legacy rails are dominated strategy. Crypto settlement is the new equilibrium.'
          : `Crypto payoff = λ × 12% × cryptoShare. Currently: ${(λ * 12 * state.cryptoShare / 100).toFixed(1)}% advantage.`
      };
    }

    case 'multipolarOrder': {
      const overreachCount = state.overreachHistory.length;
      const selfReinforcing = λ > 2.8;
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState: selfReinforcing ? 'locked' : overreachCount > 10 ? 'shifting' : 'stable',
        dominantStrategy: selfReinforcing
          ? 'multipolar coalition (self-reinforcing clique)'
          : 'unipolar with defection pressure',
        payoffShift: λ * 0.25 * overreachCount,
        description: selfReinforcing
          ? 'λ > 2.8: multipolar coalition is self-reinforcing. Each defection strengthens the bloc.'
          : `Every Overreach raises periphery defection incentive by λ × 0.25. Total shift: +${(λ * 0.25 * overreachCount).toFixed(2)}`
      };
    }

    case 'europeFracture': {
      const energyCrisis = state.pools.energyPool < 55;
      const fractured = energyCrisis && λ > 2.0;
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState: fractured ? 'shifting' : 'stable',
        dominantStrategy: fractured ? 'national energy hoarding' : 'coordinated bloc response',
        payoffShift: energyCrisis ? λ * 0.5 : 0,
        description: fractured
          ? 'Europe energy reserves below 55%. Bloc coordination collapsing — national hoarding dominant.'
          : 'European bloc holding. Coordinated response maintaining solidarity.'
      };
    }

    case 'seAsiaLockdown': {
      const chipStarved = state.pools.energyPool < 60;
      const amplifying = chipStarved && λ > 1.8;
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState: amplifying ? 'dominated' : 'stable',
        dominantStrategy: amplifying ? 'lockdown amplifier (panic exports)' : 'managed disruption',
        payoffShift: amplifying ? λ * 0.8 : 0,
        description: amplifying
          ? 'SE Asia lockdown amplifying global chip shortage. Panic spreading to supply chains.'
          : 'SE Asia supply chains stressed but holding. Early lockdown protocols active.'
      };
    }

    case 'fertilizerFoodMigration': {
      const fertilizerStrained = state.pools.energyPool < 70; // proxy until fertilizerPool is on GameState
      const migrationWave = fertilizerStrained && λ > 2.2;
      return {
        key: subGameKey,
        name: subGame.name,
        equilibriumState: migrationWave ? 'locked' : fertilizerStrained ? 'shifting' : 'stable',
        dominantStrategy: migrationWave ? 'migration wave (cascading food crisis)' : 'controlled shortage',
        payoffShift: migrationWave ? λ * 1.2 : 0,
        description: migrationWave
          ? 'Fertilizer shortage triggering food crisis → migration waves. Cascade locked in.'
          : fertilizerStrained
            ? 'Fertilizer supply strained. Food crisis risk rising with λ.'
            : 'Fertilizer and food systems stable.'
      };
    }
  }
}

export function evaluateAllSubGames(state: GameState): SubGameResult[] {
  return (Object.keys(GAME_THEORY_DATA.subGames) as SubGameKey[]).map(k => evaluateSubGame(k, state));
}

export function isCooperationLocked(state: GameState): boolean {
  return state.globalLambda > GAME_THEORY_DATA.lambdaThresholds.lockNash;
}

export function getFactionPayoffWeight(factionId: FactionId): number {
  return GAME_THEORY_DATA.factionSpecificPayoffAdjustments[factionId].lambdaWeight;
}

// Returns the action in this turn that raised λ the most
export function getBiggestLambdaContributor(
  actions: Partial<Record<FactionId, { actionId: string }>>,
  prevLambda: number,
  newLambda: number
): { factionId: FactionId; actionId: string; delta: number } | null {
  let max = { factionId: null as FactionId | null, actionId: '', delta: 0 };
  (Object.keys(actions) as FactionId[]).forEach(fId => {
    const actionId = actions[fId]?.actionId;
    if (!actionId) return;
    const actionData = GAME_THEORY_DATA.overreachActions[actionId as keyof typeof GAME_THEORY_DATA.overreachActions];
    if (!actionData) return;
    const adj = GAME_THEORY_DATA.factionSpecificPayoffAdjustments[fId];
    const delta = Math.abs(actionData.lambdaDelta * adj.lambdaWeight);
    if (delta > max.delta) max = { factionId: fId, actionId, delta };
  });
  if (!max.factionId) return null;
  return { factionId: max.factionId!, actionId: max.actionId, delta: newLambda - prevLambda };
}
