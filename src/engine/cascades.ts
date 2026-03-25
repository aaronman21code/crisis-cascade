// src/engine/cascades.ts
// Multi-layer cascade engine: Energy → Fertilizer → Food/Migration → Chip/Tech → Political instability

export interface CascadeEvent {
  id: string;
  name: string;
  description: string;
  energyDelta: number;
  fertilizerDelta: number;
  chipDelta: number;
  inflationDelta: number;
  panicDelta: number;
  lambdaDelta: number;
  subGameTrigger?: string;
  flavorText: string;
  thresholdType: 'energy' | 'fertilizer' | 'chip' | 'lambda' | 'inflation';
  thresholdValue: number;
}

export const CASCADE_EVENTS: CascadeEvent[] = [
  // ── Energy Layer ───────────────────────────────────────────────────────
  {
    id: 'factory_blackout',
    name: 'Factory Blackouts Begin',
    description: 'Asia and Europe mandate reduced industrial weeks',
    energyDelta: -12, fertilizerDelta: 0, chipDelta: 0, inflationDelta: 5,
    panicDelta: 12, lambdaDelta: 0.12,
    subGameTrigger: 'aiVsRobotics',
    flavorText: 'Energy shortage triggers first wave of industrial overreach.',
    thresholdType: 'energy', thresholdValue: 68,
  },
  {
    id: 'se_asia_lockdown_auto',
    name: 'SE_Asia Early Energy Lockdown',
    description: 'Developing nations impose 4-day weeks, fuel rationing, and export bans',
    energyDelta: -8, fertilizerDelta: -5, chipDelta: 0, inflationDelta: 8,
    panicDelta: 15, lambdaDelta: 0.15,
    subGameTrigger: 'seAsiaLockdown',
    flavorText: 'SE_Asia acts as early amplifier — same pattern as early 2020 regional lockdowns.',
    thresholdType: 'energy', thresholdValue: 75,
  },

  // ── Fertilizer → Food Layer ────────────────────────────────────────────
  {
    id: 'fertilizer_shortage',
    name: 'Fertilizer Crisis',
    description: 'Global urea and phosphate production collapses due to energy/gas shortages',
    energyDelta: -6, fertilizerDelta: -22, chipDelta: 0, inflationDelta: 12,
    panicDelta: 18, lambdaDelta: 0.18,
    subGameTrigger: 'fertilizerFoodMigration',
    flavorText: 'Fertilizer shock creates second-order food fear — accelerating Public Fear phase.',
    thresholdType: 'fertilizer', thresholdValue: 60,
  },
  {
    id: 'global_food_inflation',
    name: 'Global Food Inflation & Rationing',
    description: 'Food prices surge, leading to export bans and domestic rationing',
    energyDelta: -4, fertilizerDelta: -10, chipDelta: 0, inflationDelta: 18,
    panicDelta: 22, lambdaDelta: 0.20,
    subGameTrigger: 'fertilizerFoodMigration',
    flavorText: 'Food crisis triggers migration waves and political pressure on Europe/SE_Asia.',
    thresholdType: 'fertilizer', thresholdValue: 45,
  },
  {
    id: 'migration_waves',
    name: 'Mass Migration Waves',
    description: 'Food shortages drive large-scale migration into Europe and stable regions',
    energyDelta: -5, fertilizerDelta: -8, chipDelta: 0, inflationDelta: 10,
    panicDelta: 25, lambdaDelta: 0.22,
    subGameTrigger: 'multipolarOrder',
    flavorText: 'Migration shock fractures EuropeBloc and boosts multipolar realignment.',
    thresholdType: 'fertilizer', thresholdValue: 35,
  },

  // ── Chip / Tech Layer (Taiwan) ─────────────────────────────────────────
  {
    id: 'chip_armageddon',
    name: 'Taiwan Chip Crisis',
    description: 'China pressures or blockades Taiwan → advanced semiconductor supply collapses',
    energyDelta: -7, fertilizerDelta: 0, chipDelta: -35, inflationDelta: 15,
    panicDelta: 20, lambdaDelta: 0.30,
    subGameTrigger: 'aiVsRobotics',
    flavorText: 'Taiwan flashpoint turns energy crisis into tech apocalypse — massive λ spike.',
    thresholdType: 'lambda', thresholdValue: 2.6,
  },

  // ── High-λ systemic cascades ────────────────────────────────────────────
  {
    id: 'dedollarization_accelerated',
    name: 'Accelerated Dedollarization',
    description: 'BRICS + Crypto coalition bypasses legacy rails',
    energyDelta: -3, fertilizerDelta: 0, chipDelta: 0, inflationDelta: 12,
    panicDelta: 14, lambdaDelta: 0.20,
    subGameTrigger: 'bricsCurrency',
    flavorText: 'Legacy Finance loses dominance — Crypto and BRICS path becomes locked.',
    thresholdType: 'lambda', thresholdValue: 2.3,
  },
  {
    id: 'full_energy_lockdown',
    name: 'FULL ENERGY LOCKDOWN',
    description: 'Sectoral restrictions enforced across 3–4 billion people',
    energyDelta: -15, fertilizerDelta: -12, chipDelta: -10, inflationDelta: 25,
    panicDelta: 30, lambdaDelta: 0.28,
    subGameTrigger: 'multipolarOrder',
    flavorText: 'The 2020 lockdown machine has fully activated on energy + food + tech.',
    thresholdType: 'lambda', thresholdValue: 3.0,
  },
];

// Minimal interface needed by applyCascades
interface CascadeState {
  pools: { energyPool: number; fertilizerPool: number; chipPool: number; inflationIndex: number };
  panicIndex: number;
  globalLambda: number;
  activeCascades: string[];
  newsFeed: Array<{ title: string; impact: number; turn: number }>;
  turn: number;
}

/**
 * Checks all cascade thresholds and fires any new ones. Mutates state in-place.
 */
export function applyCascades(state: CascadeState): void {
  CASCADE_EVENTS.forEach(cascade => {
    let shouldTrigger = false;
    switch (cascade.thresholdType) {
      case 'energy':     shouldTrigger = state.pools.energyPool    <= cascade.thresholdValue; break;
      case 'fertilizer': shouldTrigger = state.pools.fertilizerPool <= cascade.thresholdValue; break;
      case 'chip':       shouldTrigger = state.pools.chipPool       <= cascade.thresholdValue; break;
      case 'inflation':  shouldTrigger = state.pools.inflationIndex >= cascade.thresholdValue; break;
      case 'lambda':     shouldTrigger = state.globalLambda         >= cascade.thresholdValue; break;
    }

    if (shouldTrigger && !state.activeCascades.includes(cascade.id)) {
      state.activeCascades.push(cascade.id);
      state.pools.energyPool     = Math.max(5,   state.pools.energyPool     + cascade.energyDelta);
      state.pools.fertilizerPool = Math.max(5,   state.pools.fertilizerPool + cascade.fertilizerDelta);
      state.pools.chipPool       = Math.max(5,   state.pools.chipPool       + cascade.chipDelta);
      state.pools.inflationIndex = Math.min(200, state.pools.inflationIndex + cascade.inflationDelta);
      state.panicIndex           = Math.min(100, state.panicIndex           + cascade.panicDelta);
      state.globalLambda         = Math.min(5.0, state.globalLambda         + cascade.lambdaDelta);
      state.newsFeed.push({ title: cascade.name, impact: cascade.panicDelta, turn: state.turn });
    }
  });
}

/** No-op kept for server.ts import compatibility — effects now live in processTurn */
export function applyOverreachEffect(_state: CascadeState, _factionId: string, _actionId: string): void {}
