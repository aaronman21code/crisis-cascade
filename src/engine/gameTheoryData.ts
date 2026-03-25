// src/engine/gameTheoryData.ts

export const GAME_THEORY_DATA = {

  // ── Global resource pools (initial values) ──────────────────────────
  globalPools: {
    energyPool:      100,
    fertilizerPool:  100,
    chipPool:        100,
    inflationIndex:  100,
  },

  // ── λ thresholds ──────────────────────────────────────────────────────
  lambdaThresholds: {
    lockNash:               2.5,   // cooperative moves become impossible
    cascadeTrigger:         2.0,   // yuan path dominant; cascades amplify
    fullEnergyLockdownRisk: 3.0,
    taiwanFlashpoint:       2.8,   // Taiwan chip crisis auto-triggers
  },

  // ── Sub-games ─────────────────────────────────────────────────────────
  subGames: {
    iranWar:                 { name: "Iran–US Escalation (Chicken + Repeated Ladder)" },
    bricsCurrency:           { name: "BRICS Yuan vs Petrodollar (Stag Hunt)" },
    aiVsRobotics:            { name: "US AI vs China Robotics + Taiwan Semiconductor (Zero-Sum)" },
    legacyVsCrypto:          { name: "Legacy Finance vs Crypto (Market-Share Chicken)" },
    multipolarOrder:         { name: "Multipolar Global Order (n-Player Network)" },
    europeFracture:          { name: "EuropeBloc Energy Fracture" },
    seAsiaLockdown:          { name: "SE_Asia Early Lockdown Amplifier" },
    fertilizerFoodMigration: { name: "Fertilizer → Food → Migration Cascade" },
  },

  // ── Perception Engine (Phase 2 — Media Shock amplifiers) ──────────────
  perceptionEngine: {
    legacy: { panicBonus: 8,  lambdaDelta: 0.15 },
    social: { panicBonus: 18, lambdaDelta: 0.35 },
  },

  // ── Faction list ───────────────────────────────────────────────────────
  factions: ["US", "IRAN", "CHINA", "BRICS", "LEGACY", "CRYPTO", "EUROPE", "SE_ASIA"] as const,

  // ── Faction-specific payoff adjustments (used by logicEngine.ts) ──────
  factionSpecificPayoffAdjustments: {
    US:      { lambdaWeight: 1.2, fearPenalty: -8  },
    IRAN:    { lambdaWeight: 0.9, fearPenalty: +12 },
    CHINA:   { lambdaWeight: 1.1, fearPenalty: -15 },
    BRICS:   { lambdaWeight: 1.0, fearPenalty: +5  },
    LEGACY:  { lambdaWeight: 0.8, fearPenalty: -10 },
    CRYPTO:  { lambdaWeight: 1.3, fearPenalty: +18 },
    EUROPE:  { lambdaWeight: 0.9, fearPenalty: -8  },
    SE_ASIA: { lambdaWeight: 1.0, fearPenalty: +5  },
  },

  // ── Global multiplier formula ──────────────────────────────────────────
  globalMultiplierFormula: "U′ = λ ⋅ U + ΔFear(25 * panicIndex) + CommitmentPenalty(10 * overreachCount)",

  // ── Overreach actions dictionary (used by logicEngine.ts + server.ts) ─
  overreachActions: {
    "ration_cards":          { cost: 12, lambdaDelta: 0.35, energyDelta: -12, cascade: "factory_blackout" },
    "naval_escort":          { cost: 18, lambdaDelta: 0.45, energyDelta: +8,  cascade: null },
    "full_mine_laying":      { cost: 15, lambdaDelta: 0.50, energyDelta: -15, cascade: "war_escalation" },
    "yuan_settlement":       { cost: 10, lambdaDelta: 0.30, energyDelta:  0,  cascade: "dedollarization" },
    "ai_allocation":         { cost: 14, lambdaDelta: 0.25, energyDelta: -5,  cascade: "tech_triage" },
    "rare_earth_ban":        { cost: 11, lambdaDelta: 0.40, energyDelta:  0,  cascade: "supply_chain_crisis" },
    "capital_controls":      { cost: 13, lambdaDelta: 0.35, energyDelta:  0,  cascade: "crypto_surge" },
    "spr_release":           { cost: 12, lambdaDelta: 0.15, energyDelta: +15, cascade: null },
    "secondary_sanctions":   { cost: 16, lambdaDelta: 0.35, energyDelta:  0,  cascade: null },
    "brics_summit":          { cost: 10, lambdaDelta: -0.20, energyDelta: 0,  cascade: null },
    "digital_yuan_pilot":    { cost: 9,  lambdaDelta: 0.20, energyDelta:  0,  cascade: "dedollarization" },
    "hyperliquid_futures":   { cost: 8,  lambdaDelta: 0.40, energyDelta:  0,  cascade: "crypto_surge" },
    "stablecoin_corridor":   { cost: 7,  lambdaDelta: 0.25, energyDelta:  0,  cascade: "crypto_surge" },
    "power_plant_strike":    { cost: 20, lambdaDelta: 0.55, energyDelta: -10, cascade: "war_escalation" },
    "missile_strikes":       { cost: 17, lambdaDelta: 0.45, energyDelta: -12, cascade: null },
    "solar_crash_build":     { cost: 13, lambdaDelta: 0.10, energyDelta: +6,  cascade: null },
    "robotics_triage":       { cost: 11, lambdaDelta: 0.15, energyDelta: -3,  cascade: "tech_triage" },
    "swift_exclusion":       { cost: 14, lambdaDelta: 0.40, energyDelta:  0,  cascade: "crypto_surge" },
    "insurance_spike":       { cost: 8,  lambdaDelta: 0.30, energyDelta:  0,  cascade: null },
    "whale_coordination":    { cost: 10, lambdaDelta: 0.35, energyDelta:  0,  cascade: "crypto_surge" },
    "shadow_fleet":          { cost: 9,  lambdaDelta: 0.20, energyDelta: +5,  cascade: null },
    "ceasefire_offer":       { cost: 5,  lambdaDelta: -0.30, energyDelta: 0,  cascade: null },
    "diplomatic_pressure":   { cost: 10, lambdaDelta: 0.20, energyDelta:  0,  cascade: null },
    "imf_loan":              { cost: 12, lambdaDelta: -0.10, energyDelta: 0,  cascade: null },
    "central_bank_swap":     { cost: 11, lambdaDelta: 0.10, energyDelta:  0,  cascade: null },
    "energy_sharing":        { cost: 8,  lambdaDelta: -0.15, energyDelta: +5, cascade: null },
    "narrative_takeover":    { cost: 9,  lambdaDelta: -0.20, energyDelta: 0,  cascade: null },
    "domestic_rally":        { cost: 9,  lambdaDelta: 0.15, energyDelta:  0,  cascade: null },
    // EUROPE actions
    "russian_gas_restart":   { cost: 14, lambdaDelta: -0.20, energyDelta: +18, cascade: null },
    "eu_energy_rationing":   { cost: 10, lambdaDelta: 0.25, energyDelta: -8,  cascade: "factory_blackout" },
    "green_transition_push": { cost: 12, lambdaDelta: 0.10, energyDelta: +5,  cascade: null },
    "ecb_emergency_rate":    { cost: 11, lambdaDelta: 0.20, energyDelta:  0,  cascade: null },
    "eu_sanctions_package":  { cost: 15, lambdaDelta: 0.35, energyDelta:  0,  cascade: "supply_chain_crisis" },
    // SE_ASIA actions
    "early_lockdown":        { cost: 10, lambdaDelta: 0.30, energyDelta: -6,  cascade: "factory_blackout" },
    "port_closure":          { cost: 12, lambdaDelta: 0.40, energyDelta: -10, cascade: "supply_chain_crisis" },
    "chip_fab_redirect":     { cost: 14, lambdaDelta: 0.20, energyDelta: -4,  cascade: "tech_triage" },
    "asean_food_reserve":    { cost: 9,  lambdaDelta: -0.10, energyDelta: 0,  cascade: null },
    "currency_peg_break":    { cost: 11, lambdaDelta: 0.35, energyDelta:  0,  cascade: "dedollarization" },
  },

  // ── Exogenous shock types ──────────────────────────────────────────────
  exogenousShocks: ["climate", "elections", "nuclear", "corporate"] as const,

} as const;

export type FactionId         = typeof GAME_THEORY_DATA.factions[number];
export type SubGameKey        = keyof typeof GAME_THEORY_DATA.subGames;
export type OverreachActionKey = keyof typeof GAME_THEORY_DATA.overreachActions;
export type ExogenousShockType = typeof GAME_THEORY_DATA.exogenousShocks[number];
export type MediaType         = keyof typeof GAME_THEORY_DATA.perceptionEngine;
