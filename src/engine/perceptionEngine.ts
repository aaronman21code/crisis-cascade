// src/engine/perceptionEngine.ts
// Phase 2 of the G-M-P-G Loop — Media Shock amplifier

import { GAME_THEORY_DATA } from './gameTheoryData';

// Minimal action shape required by perception engine
export interface PerceptionAction {
  mediaType?: 'legacy' | 'social';
  shockValue?: number;
}

/**
 * Handles Media Shock phase using Legacy vs Social Media settings.
 * Mutates state in-place (called from processTurn).
 */
export function applyPerception(state: {
  panicIndex: number;
  globalLambda: number;
  stabilityScore: number;
  newsFeed: Array<{ title: string; impact: number; turn: number }>;
  turn: number;
}, action: PerceptionAction): void {
  const mediaConfig = action.mediaType === 'legacy'
    ? GAME_THEORY_DATA.perceptionEngine.legacy
    : GAME_THEORY_DATA.perceptionEngine.social;

  // Perception engine handles panic + stability only.
  // globalLambda is accumulated once per turn in logicEngine (Phase 2) to prevent double-counting.
  state.panicIndex = Math.min(100, state.panicIndex + mediaConfig.panicBonus);

  if (action.mediaType === 'legacy') {
    state.stabilityScore = Math.min(100, state.stabilityScore + 4);
  } else {
    state.stabilityScore = Math.max(0, state.stabilityScore - 6);
  }

  const mediaName = action.mediaType === 'legacy' ? 'Legacy Media' : 'Social Media';
  state.newsFeed.push({
    title: `${mediaName} amplifies crisis — shock value ${action.shockValue ?? 0}`,
    impact: mediaConfig.panicBonus,
    turn: state.turn,
  });
}
