// frontend/src/utils/stanceEngine.ts
// Pure functions — no React, no store. Imported by components.

import { Action } from '@engine/factionActions';
import { GameState, Faction } from '@engine/logicEngine';
import { FactionId } from '@engine/gameTheoryData';

interface SubGameResult {
  key: string;
  equilibriumState: string;
}

// ─── Action Scoring ────────────────────────────────────────────────────────

export function scoreActions(
  actions: Action[],
  gameState: GameState,
  subGames: SubGameResult[],
  phase: 'g_delay' | 'g_overreach',
  lastActionId?: string,
): Action[] {
  const { globalLambda, pools, activeCascades } = gameState;
  const { energyPool } = pools;

  // Dynamic count: more options surface as crisis escalates
  const count = globalLambda >= 2.5 ? 5 : globalLambda >= 2.0 ? 4 : 3;

  const activeSubGameKeys = new Set(
    subGames
      .filter(sg => sg.equilibriumState === 'shifting' || sg.equilibriumState === 'locked')
      .map(sg => sg.key),
  );

  const scored = actions.map(action => {
    let score = 0;

    // +3 if action targets a currently hot sub-game
    if (activeSubGameKeys.has(action.subGameTrigger)) score += 3;

    // +2 cooperative window still open
    if (globalLambda < 2.5 && action.lambdaDelta < 0) score += 2;

    // +2 defection dominant — escalation actions pay off
    if (globalLambda >= 2.5 && action.lambdaDelta > 0.3) score += 2;

    // +2 energy crisis — prioritize actions that restore energy
    if (energyPool < 65 && (action.energyDelta ?? 0) > 0) score += 2;

    // +1 cascade urgency — action has high lambda impact (signals cascade-level move)
    if (action.lambdaDelta > 0.3 && activeCascades.length > 0) {
      score += 1;
    }

    // -2 penalise heavy energy drain in energy crisis
    if (energyPool < 40 && (action.energyDelta ?? 0) < -5) score -= 2;

    // -1 delay phase: avoid high-shock actions
    if (phase === 'g_delay' && action.lambdaDelta > 0.35) score -= 1;

    // Derank last-used action — it won't appear in the top N next turn
    if (lastActionId && action.id === lastActionId) score -= 10;

    return { action, score };
  });

  // Sort: descending score, then ascending shockValue (prefer subtlety on ties)
  scored.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.action.shockValue - b.action.shockValue,
  );

  return scored.slice(0, Math.min(count, scored.length)).map(s => s.action);
}

// ─── Decision Matrix Labels ────────────────────────────────────────────────

const SUBGAME_NAMES: Record<string, string> = {
  iranWar:        'Iran War',
  bricsCurrency:  'BRICS Currency',
  aiVsRobotics:   'AI vs Robotics',
  legacyVsCrypto: 'Legacy vs Crypto',
  multipolarOrder:'Multipolar Order',
};

export function getSubGameName(key: string): string {
  return SUBGAME_NAMES[key] ?? key;
}

const EQ_LABELS: Record<string, { label: string; color: string }> = {
  stable:    { label: 'Stable',   color: '#22c55e' },
  shifting:  { label: 'In Play',  color: '#f97316' },
  locked:    { label: 'Locked',   color: '#ef4444' },
  dominated: { label: 'Dominant', color: '#ef4444' },
};

export function getSubGameStateLabel(equilibriumState: string): { label: string; color: string } {
  return EQ_LABELS[equilibriumState] ?? { label: '—', color: '#4b5563' };
}

export interface ConsequenceLabel {
  impact: string;
  impactColor: string;
  consequence: string;
}

export function getConsequenceLabel(action: Action): ConsequenceLabel {
  const { lambdaDelta, energyDelta = 0 } = action;

  let impact: string;
  let impactColor: string;
  if (lambdaDelta <= -0.15)     { impact = 'Stabilizes'; impactColor = '#22c55e'; }
  else if (lambdaDelta < 0.15)  { impact = 'Minimal';    impactColor = '#6b7280'; }
  else if (lambdaDelta < 0.30)  { impact = 'Escalates';  impactColor = '#f97316'; }
  else                          { impact = 'Inflames';   impactColor = '#ef4444'; }

  let consequence: string;
  if (lambdaDelta > 0.3 && energyDelta < 0) consequence = 'Cascade + energy drain';
  else if (lambdaDelta > 0.3)                consequence = 'Triggers cascade';
  else if (energyDelta < -5)                 consequence = 'Energy drain';
  else if (energyDelta > 5)                  consequence = 'Restores energy';
  else if (lambdaDelta < 0)                  consequence = 'Reduces tension';
  else                                       consequence = '';

  return { impact, impactColor, consequence };
}

// ─── Faction Stance ────────────────────────────────────────────────────────

export interface FactionStance {
  stance: string;
  threat: 'low' | 'medium' | 'high';
  threatColor: string;
  predictedType: string;
}

export function getFactionStance(factionId: FactionId, gameState: GameState): FactionStance {
  const faction: Faction = gameState.factions[factionId];
  if (!faction) {
    return { stance: 'Watching', threat: 'low', threatColor: '#22c55e', predictedType: 'Opportunistic' };
  }

  const { lambda, objectiveProgress, politicalCapital } = faction;

  // Recent actions for this faction (last 2 turns)
  const recent = gameState.overreachHistory
    .filter(h => h.factionId === factionId)
    .slice(-2);

  // Threat level
  let threat: 'low' | 'medium' | 'high';
  let threatColor: string;
  if (lambda >= 2.5) {
    threat = 'high'; threatColor = '#ef4444';
  } else if (lambda >= 2.0) {
    threat = 'medium'; threatColor = '#f97316';
  } else {
    threat = 'low'; threatColor = '#22c55e';
  }

  // Stance from recent action lambdaDeltas (we don't have the Action objects here,
  // so we derive from faction state signals instead)
  let stance: string;
  if (objectiveProgress > 60) {
    stance = 'Dominant';
  } else if (lambda >= 2.0 && recent.length > 0) {
    stance = 'Aggressive';
  } else if (objectiveProgress < 25 && politicalCapital < 35) {
    stance = 'Defensive';
  } else if (lambda < 1.5 && recent.length > 0) {
    stance = 'Cooperative';
  } else {
    stance = 'Watching';
  }

  const predictedMap: Record<string, string> = {
    Aggressive:  'Likely to escalate',
    Cooperative: 'Seeking de-escalation',
    Defensive:   'Consolidating resources',
    Dominant:    'Pressing advantage',
    Watching:    'Opportunistic',
  };

  return { stance, threat, threatColor, predictedType: predictedMap[stance] };
}

// ─── Abstraction helpers ───────────────────────────────────────────────────

export function abstractResource(politicalCapital: number): string {
  if (politicalCapital >= 45) return 'Full';
  if (politicalCapital >= 30) return 'Limited';
  return 'Depleted';
}

export function abstractLambda(lambda: number): { label: string; color: string } {
  if (lambda < 2.0)  return { label: 'Stable',   color: '#22c55e' };
  if (lambda < 2.5)  return { label: 'Rising',   color: '#f97316' };
  if (lambda < 3.0)  return { label: 'Critical', color: '#ef4444' };
  return               { label: 'Extreme',  color: '#f43f5e' };
}
