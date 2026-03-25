// src/engine/newsGenerator.ts
// λ-tiered procedural headlines. All thresholds from GAME_THEORY_DATA.

import { GAME_THEORY_DATA } from './gameTheoryData';
import { GameState } from './logicEngine';

interface HeadlineTemplate {
  template: string;
  impact: number;
  tier: 'calm' | 'tension' | 'crisis' | 'chaos';
  cascade?: string;        // only emit if this cascade is active
  cryptoThreshold?: number; // only emit if cryptoShare >= this
}

const TEMPLATES: HeadlineTemplate[] = [
  // === CALM TIER (λ < 1.5) ===
  { tier: 'calm', template: 'Oil stabilizes near ${oilPrice}/bbl as diplomatic talks resume', impact: 3 },
  { tier: 'calm', template: 'Hormuz traffic slows but shipping lanes remain open', impact: 4 },
  { tier: 'calm', template: 'Markets cautious — crude futures show modest backwardation', impact: 2 },
  { tier: 'calm', template: 'US officials: "The situation is manageable." (λ={lambda})', impact: 3 },
  { tier: 'calm', template: 'BRICS finance ministers meet in Shanghai for emergency talks', impact: 4 },
  { tier: 'calm', template: 'IMF warns of energy price volatility; says fundamentals are solid', impact: 3 },
  { tier: 'calm', template: 'Crypto oil futures trading volume up 12% — "precautionary positions"', impact: 4 },

  // === TENSION TIER (λ 1.5–2.0) ===
  { tier: 'tension', template: 'Hormuz traffic slows 40% — tankers rerouting via Cape of Good Hope', impact: 8 },
  { tier: 'tension', template: 'Oil prices rise to ${oilPrice}/bbl as Hormuz tensions mount', impact: 9 },
  { tier: 'tension', template: 'Yuan clearing pilots expand — {cryptoShare}% of BRICS trades settled off-dollar', impact: 10 },
  { tier: 'tension', template: 'China activates rare earth monitoring; US semiconductor firms on alert', impact: 8 },
  { tier: 'tension', template: 'Bitcoin futures hit new highs as geopolitical hedge demand surges', impact: 9 },
  { tier: 'tension', template: 'G7 emergency session called — energy ministers demand coordinated response', impact: 8 },
  { tier: 'tension', template: 'SWIFT volumes down 18% this week — "routing anomalies" reported', impact: 7 },
  { tier: 'tension', template: 'Fear index (λ={lambda}) rising: markets pricing in 30% escalation probability', impact: 10 },
  { tier: 'tension', template: 'Saudi Arabia in talks with China on digital yuan crude payment', impact: 11, cryptoThreshold: 15 },
  { tier: 'tension', template: 'Naval standoff: {count} warships in Hormuz — "freedom of navigation" disputed', impact: 9 },

  // === CRISIS TIER (λ 2.0–2.5) ===
  { tier: 'crisis', template: 'EMERGENCY: Fuel rationing in 12 nations — queues forming at petrol stations', impact: 18 },
  { tier: 'crisis', template: 'λ={lambda}: yuan settlement path is NOW the dominant strategy for BRICS bloc', impact: 16 },
  { tier: 'crisis', template: 'Oil at ${oilPrice}/bbl — highest since 2022 Ukraine shock. No ceasefire in sight.', impact: 17 },
  { tier: 'crisis', template: 'Factory output falls 28% across Southeast Asia — energy supply crunch deepens', impact: 18 },
  { tier: 'crisis', template: 'US Treasury: emergency powers invoked to defend petrodollar infrastructure', impact: 15 },
  { tier: 'crisis', template: 'Crypto settlement volume: {cryptoShare}% of global oil trades — "escape valve working"', impact: 16 },
  { tier: 'crisis', template: 'BRICS bloc formally launches parallel clearing system — 47 nations join first wave', impact: 20 },
  { tier: 'crisis', template: 'G_Delay revealed: "Both sides knew this was coming since February" — leaked cables', impact: 14 },
  { tier: 'crisis', template: 'Flight cancellations sweep Europe as jet fuel shortages cascade', impact: 17, cascade: 'factory_blackout' },
  { tier: 'crisis', template: 'Fertilizer plants shut down — agricultural crisis forming 6 months out', impact: 18, cascade: 'food_shortage' },

  // === CHAOS TIER (λ ≥ 2.5) ===
  { tier: 'chaos', template: 'NASH LOCK: λ={lambda} — cooperative moves are mathematically impossible', impact: 28 },
  { tier: 'chaos', template: 'FULL ENERGY LOCKDOWN IMMINENT — factories idle across 3 continents', impact: 30 },
  { tier: 'chaos', template: 'Oil at ${oilPrice}/bbl — "We are in uncharted territory" — IEA emergency statement', impact: 25 },
  { tier: 'chaos', template: 'BRICS + Crypto coalition: {cryptoShare}% of oil trades bypass legacy rails permanently', impact: 26, cryptoThreshold: 35 },
  { tier: 'chaos', template: 'War escalation confirmed — Hormuz militarized zone declared by all parties', impact: 30, cascade: 'war_escalation' },
  { tier: 'chaos', template: 'Migration wave: 2.3 million displaced in 72 hours as food system collapses', impact: 28, cascade: 'migration_wave' },
  { tier: 'chaos', template: 'THIS IS THE 2020 LOOP: Same fear mechanism, same G_Delay, same overreach. λ={lambda}.', impact: 25 },
  { tier: 'chaos', template: 'CRYPTO DOMINANCE: {cryptoShare}% of oil now settling on-chain. Petrodollar era ended.', impact: 30, cryptoThreshold: 40 },
  { tier: 'chaos', template: 'Central banks losing control — USD/yuan spread at historic extremes', impact: 24 },
  { tier: 'chaos', template: 'G7 summits cancelled — world leaders unable to coordinate (Nash equilibrium locked)', impact: 22 },
];

function getLambdaTier(lambda: number): HeadlineTemplate['tier'] {
  const { lockNash, cascadeTrigger } = GAME_THEORY_DATA.lambdaThresholds;
  if (lambda >= lockNash) return 'chaos';
  if (lambda >= cascadeTrigger) return 'crisis';
  if (lambda >= 1.5) return 'tension';
  return 'calm';
}

function interpolate(template: string, state: GameState): string {
  return template
    .replace('{lambda}', state.globalLambda.toFixed(2))
    .replace('${oilPrice}', String(state.oilPrice))
    .replace('{cryptoShare}', String(state.cryptoShare))
    .replace('{count}', String(3 + Math.floor(state.globalLambda * 2)));
}

// Generate 2–4 headlines for this turn
export function generateHeadlines(
  state: GameState,
  prevState: GameState
): Array<{ title: string; impact: number; turn: number }> {
  const tier = getLambdaTier(state.globalLambda);

  // Filter eligible templates
  const eligible = TEMPLATES.filter(t => {
    if (t.tier !== tier) return false;
    if (t.cascade && !state.activeCascades.includes(t.cascade)) return false;
    if (t.cryptoThreshold && state.cryptoShare < t.cryptoThreshold) return false;
    return true;
  });

  // Shuffle and pick 2–3
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  const count = Math.min(3, Math.max(2, shuffled.length));
  const picked = shuffled.slice(0, count);

  // Always add a cascade-specific headline if a new cascade fired this turn
  const newCascades = state.activeCascades.filter(c => !prevState.activeCascades.includes(c));
  const cascadeHeadlines = getCascadeHeadlines(newCascades, state);

  return [
    ...cascadeHeadlines,
    ...picked.map(t => ({
      title: interpolate(t.template, state),
      impact: t.impact,
      turn: state.turn,
    })),
  ];
}

function getCascadeHeadlines(
  newCascades: string[],
  state: GameState
): Array<{ title: string; impact: number; turn: number }> {
  const map: Record<string, { title: string; impact: number }> = {
    factory_blackout:    { title: 'BLACKOUT: Factory output down 35% across southern China and Southeast Asia', impact: 20 },
    food_shortage:       { title: 'FOOD CRISIS: Fertilizer shutdown → grain shortages in 6 months', impact: 22 },
    migration_wave:      { title: 'MIGRATION: 1.8M displaced — governments declare emergencies', impact: 24 },
    crypto_corridors:    { title: 'CRYPTO CORRIDORS: Bitcoin/stablecoin now the settlement layer for shadow trade', impact: 18 },
    war_escalation:      { title: 'WAR: Military exchange confirmed in Strait of Hormuz', impact: 30 },
    dedollarization:     { title: 'HISTORIC: Saudi Arabia accepts yuan for first LNG cargo — petrodollar challenged', impact: 26 },
    crypto_surge:        { title: `CRYPTO SURGE: ${state.cryptoShare}% of oil settling on-chain — legacy rails bypassed`, impact: 20 },
    supply_chain_crisis: { title: 'SUPPLY CHAIN: Rare earth embargo triggers global tech manufacturing crisis', impact: 22 },
    tech_triage:         { title: 'TRIAGE: US AI systems pivot to energy rationing — zero-sum tech advantage active', impact: 14 },
    nash_locked:         { title: 'NASH LOCK CONFIRMED: No cooperative strategy exists at λ=' + state.globalLambda.toFixed(2), impact: 28 },
    yuan_dominant:       { title: 'STAG HUNT TIPPED: Yuan settlement is now dominant strategy — Stag Hunt resolved', impact: 20 },
  };

  return newCascades
    .filter(c => map[c])
    .map(c => ({ ...map[c], turn: state.turn }));
}

// Special post-turn LoopAnalysis quote referencing 2020 parallel
export function getLoopAnalysisQuote(
  prevLambda: number,
  newLambda: number,
  triggeringActionLabel: string,
  activeCascades: string[]
): string {
  const delta = (newLambda - prevLambda).toFixed(2);
  const base = `λ moved ${prevLambda.toFixed(2)} → ${newLambda.toFixed(2)} on "${triggeringActionLabel}"`;

  if (newLambda >= GAME_THEORY_DATA.lambdaThresholds.lockNash) {
    return `${base}. Nash equilibrium is now locked — cooperation payoffs have collapsed and every faction is defecting rationally. This is the attractor state, not a mistake.`;
  }
  if (activeCascades.includes('factory_blackout')) {
    return `${base}. Factory blackouts are cascading — the same industrial shock that hit Italy in February 2020 before the world understood what was spreading.`;
  }
  if (activeCascades.includes('food_shortage')) {
    return `${base}. Food supply chains are fracturing. Once logistics confidence breaks, restoring it takes 6–8 turns of coordinated action no faction currently has incentive to take.`;
  }
  if (activeCascades.includes('war_escalation')) {
    return `${base}. Military escalation triggered — the G_Overreach loop is running exactly as modeled: fear forces action, action multiplies fear.`;
  }
  return `${base}. Each uncoordinated Overreach adds λ for every player. (Δλ = +${delta})`;
}
