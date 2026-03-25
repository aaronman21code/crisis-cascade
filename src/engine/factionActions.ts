// src/engine/factionActions.ts

import { FactionId } from './gameTheoryData';

export interface Action {
  id: string;
  name: string;
  description: string;
  cost: number;
  shockValue: number;
  lambdaDelta: number;
  energyDelta?: number;
  fertilizerDelta?: number;
  chipDelta?: number;
  inflationDelta?: number;
  mediaType: 'legacy' | 'social';
  subGameTrigger: string;
  flavorText: string;
}

export const FACTION_ACTIONS: Record<string, Action[]> = {
  US: [
    {
      id: 'naval_escort',
      name: 'Launch Naval Escort Coalition',
      description: 'Deploy US/Israeli forces to protect tankers through Hormuz',
      cost: 18, shockValue: 25, lambdaDelta: 0.45, energyDelta: 8,
      mediaType: 'legacy', subGameTrigger: 'iranWar',
      flavorText: 'Classic Overreach that raises λ and triggers Media Shock — same mechanism as 2020 national lockdowns.',
    },
    {
      id: 'naval_escort_p2',
      name: 'Full Carrier Strike Group Deployment',
      description: 'Commit all available naval assets to permanent Hormuz presence and full blockade enforcement',
      cost: 24, shockValue: 32, lambdaDelta: 0.57, energyDelta: 10,
      mediaType: 'social', subGameTrigger: 'iranWar',
      flavorText: 'No longer a show of force — the carriers are staying. Every faction must respond or submit.',
    },
    {
      id: 'ai_rationing',
      name: 'Deploy AI Fuel Rationing Algorithms',
      description: 'Use American AI advantage for domestic allocation and targeting',
      cost: 15, shockValue: 18, lambdaDelta: 0.28, energyDelta: -6,
      mediaType: 'legacy', subGameTrigger: 'aiVsRobotics',
      flavorText: 'AI gives asymmetric edge while energy starvation hits others harder.',
    },
    {
      id: 'ai_rationing_p2',
      name: 'AI-Directed Total Resource Lockdown',
      description: 'AI systems take over national resource allocation — automated rationing at scale',
      cost: 20, shockValue: 23, lambdaDelta: 0.35, energyDelta: -8,
      mediaType: 'social', subGameTrigger: 'aiVsRobotics',
      flavorText: 'The algorithm decides who gets fuel. Compliance is framed as patriotism. Dissent is a resource drain.',
    },
    {
      id: 'secondary_sanctions',
      name: 'Impose Secondary Sanctions on Yuan Trades',
      description: 'Punish nations settling oil in BRICS/yuan basket',
      cost: 16, shockValue: 22, lambdaDelta: 0.35,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'Raises defection penalty in Stag Hunt — accelerates dedollarization.',
    },
    {
      id: 'secondary_sanctions_p2',
      name: 'Global Dollar Weaponization Protocol',
      description: 'Full extraterritorial enforcement — any entity touching yuan oil settlement faces total exclusion',
      cost: 21, shockValue: 28, lambdaDelta: 0.44,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'The dollar becomes a weapon of mass financial exclusion. BRICS acceleration locks in.',
    },
    {
      id: 'spr_release',
      name: 'Massive SPR Release',
      description: 'Dump Strategic Petroleum Reserve to stabilize markets',
      cost: 12, shockValue: 10, lambdaDelta: 0.15, energyDelta: 15,
      mediaType: 'legacy', subGameTrigger: 'iranWar',
      flavorText: 'Temporary relief that often delays real solutions and stores up bigger future shock.',
    },
    {
      id: 'spr_release_p2',
      name: 'Strategic Reserve Emergency Depletion',
      description: 'Drain the SPR to near-zero — massive short-term energy injection, nothing left in reserve',
      cost: 16, shockValue: 13, lambdaDelta: 0.19, energyDelta: 20,
      mediaType: 'legacy', subGameTrigger: 'iranWar',
      flavorText: 'The cupboard is bare after this. Markets stabilize briefly. Then reality sets in.',
    },
    {
      id: 'diplomatic_pressure',
      name: 'Multilateral Diplomatic Pressure',
      description: 'Coordinate allies to pressure Iran through diplomatic channels',
      cost: 10, shockValue: 8, lambdaDelta: -0.10,
      mediaType: 'legacy', subGameTrigger: 'iranWar',
      flavorText: 'Low-cost de-escalation attempt — rarely decisive alone.',
    },
    {
      id: 'diplomatic_pressure_p2',
      name: 'UN Security Council Emergency Session',
      description: 'Force a binding UN resolution — maximum diplomatic escalation with real consequences',
      cost: 13, shockValue: 10, lambdaDelta: -0.13,
      mediaType: 'legacy', subGameTrigger: 'iranWar',
      flavorText: 'Everyone is watching the Security Council chamber. Words carry more weight. So do vetoes.',
    },
    {
      id: 'wait_and_watch',
      name: 'Strategic Patience',
      description: 'Hold position and monitor developments before committing political capital',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'iranWar',
      flavorText: 'Sometimes the most powerful move is not to move. Let others exhaust themselves.',
    },
  ],

  IRAN: [
    {
      id: 'full_mine_laying',
      name: 'Full Mine Laying in Hormuz',
      description: 'Mine the strait completely to enforce blockade',
      cost: 17, shockValue: 32, lambdaDelta: 0.55, energyDelta: -18,
      mediaType: 'social', subGameTrigger: 'iranWar',
      flavorText: 'High-shock escalation that forces Western Overreach and raises global λ dramatically.',
    },
    {
      id: 'full_mine_laying_p2',
      name: 'Total Hormuz Closure — No Exceptions',
      description: 'Dense mine field + naval patrol boats — absolute closure with shoot-on-sight enforcement',
      cost: 22, shockValue: 40, lambdaDelta: 0.70, energyDelta: -23,
      mediaType: 'social', subGameTrigger: 'iranWar',
      flavorText: 'The strait is closed. Not threatened. Closed. Every tanker captain knows it. Every government fears it.',
    },
    {
      id: 'yuan_condition',
      name: 'Condition Tanker Release on Yuan Payment',
      description: 'Only allow tankers paying in yuan or BRICS basket',
      cost: 11, shockValue: 24, lambdaDelta: 0.42,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'Direct boost to BRICS coordination — petrodollar path becomes dominated.',
    },
    {
      id: 'yuan_condition_p2',
      name: 'Permanent Yuan-Only Strait Policy',
      description: 'Codify yuan-only transit as permanent law — no exceptions, no negotiation',
      cost: 14, shockValue: 30, lambdaDelta: 0.53,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'Not a threat. Not a condition. A policy. The dollar has been officially expelled from Hormuz.',
    },
    {
      id: 'power_plant_strike',
      name: 'Threaten Power Plant Strikes',
      description: 'Signal strikes on regional energy infrastructure',
      cost: 20, shockValue: 35, lambdaDelta: 0.55, energyDelta: -10,
      mediaType: 'social', subGameTrigger: 'iranWar',
      flavorText: 'Maximum escalation signal — raises λ for all players instantly.',
    },
    {
      id: 'power_plant_strike_p2',
      name: 'Execute Regional Infrastructure Strikes',
      description: 'Stop threatening — launch actual targeted strikes on energy infrastructure',
      cost: 26, shockValue: 44, lambdaDelta: 0.70, energyDelta: -13,
      mediaType: 'social', subGameTrigger: 'iranWar',
      flavorText: 'The missiles have launched. The world holds its breath. There is no walking this back.',
    },
    {
      id: 'shadow_fleet',
      name: 'Activate Shadow Fleet',
      description: 'Route oil via untracked tankers to bypass sanctions',
      cost: 9, shockValue: 12, lambdaDelta: 0.20, energyDelta: 5,
      mediaType: 'legacy', subGameTrigger: 'bricsCurrency',
      flavorText: 'Keeps revenue flowing while building BRICS settlement volume.',
    },
    {
      id: 'shadow_fleet_p2',
      name: 'Full Shadow Fleet Activation Network',
      description: 'Expand to a coordinated 200+ vessel shadow network with BRICS port access',
      cost: 12, shockValue: 15, lambdaDelta: 0.25, energyDelta: 7,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'The shadow fleet is no longer shadowy — it is the fleet. Sanctions have been outgrown.',
    },
    {
      id: 'wait_and_watch',
      name: 'Consolidate Position',
      description: 'Hold current gains, reinforce internal consensus, let global pressure build',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'iranWar',
      flavorText: 'The world is watching. So is Iran. Every passing turn without capitulation is a victory.',
    },
  ],

  CHINA: [
    {
      id: 'taiwan_blockade',
      name: 'Taiwan Semiconductor Pressure / Blockade',
      description: 'Exploit energy crisis to pressure or blockade Taiwan',
      cost: 24, shockValue: 40, lambdaDelta: 0.68, energyDelta: -9, chipDelta: -30,
      mediaType: 'social', subGameTrigger: 'aiVsRobotics',
      flavorText: 'Turns energy crisis into tech crisis — massive λ spike and chip pool collapse.',
    },
    {
      id: 'taiwan_blockade_p2',
      name: 'Taiwan Full Naval Blockade',
      description: 'Deploy full PLAN blockade — no semiconductor shipments leave Taiwan',
      cost: 31, shockValue: 50, lambdaDelta: 0.85, energyDelta: -11, chipDelta: -38,
      mediaType: 'social', subGameTrigger: 'aiVsRobotics',
      flavorText: 'TSMC cannot ship. Every tech-dependent nation is now a China supplicant. This is the end of the unipolar tech order.',
    },
    {
      id: 'rare_earth_ban',
      name: 'Rare-Earth Export Ban',
      description: 'Halt rare-earth shipments to the West',
      cost: 14, shockValue: 20, lambdaDelta: 0.38, chipDelta: -15,
      mediaType: 'social', subGameTrigger: 'aiVsRobotics',
      flavorText: 'Weaponizes supply chain dependence during energy shortage.',
    },
    {
      id: 'rare_earth_ban_p2',
      name: 'Permanent Rare-Earth Embargo',
      description: 'Codify ban with new export law — includes secondary enforcement on re-exporters',
      cost: 18, shockValue: 25, lambdaDelta: 0.48, chipDelta: -19,
      mediaType: 'social', subGameTrigger: 'aiVsRobotics',
      flavorText: 'Not a negotiating chip anymore. A structural weapon. Western tech supply chains begin permanent restructuring.',
    },
    {
      id: 'robotics_triage',
      name: 'Redirect Robotics to Domestic Energy Triage',
      description: 'Reallocate manufacturing robots to energy and food infrastructure',
      cost: 13, shockValue: 12, lambdaDelta: 0.22, energyDelta: 10,
      mediaType: 'legacy', subGameTrigger: 'aiVsRobotics',
      flavorText: 'China mitigates domestic impact while others suffer.',
    },
    {
      id: 'robotics_triage_p2',
      name: 'National Robotics Mobilization',
      description: 'Full state mobilization — entire industrial robot fleet redirected under central command',
      cost: 17, shockValue: 15, lambdaDelta: 0.28, energyDelta: 13,
      mediaType: 'social', subGameTrigger: 'aiVsRobotics',
      flavorText: 'China turns every factory into a triage center. Domestic resilience locks in while others scramble.',
    },
    {
      id: 'digital_yuan_pilot',
      name: 'Emergency Digital Yuan Oil Pilot',
      description: 'Fast-track digital yuan for oil settlement with willing partners',
      cost: 9, shockValue: 16, lambdaDelta: 0.20,
      mediaType: 'legacy', subGameTrigger: 'bricsCurrency',
      flavorText: 'Accelerates yuan path — BRICS coordination payoff rises.',
    },
    {
      id: 'digital_yuan_pilot_p2',
      name: 'Digital Yuan Global Oil Standard',
      description: 'Launch e-CNY as the reference currency for all BRICS oil settlement — global standard push',
      cost: 12, shockValue: 20, lambdaDelta: 0.25,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'The pilot is over. The standard is declared. Petrodollar recalibration becomes inevitable.',
    },
    {
      id: 'wait_and_watch',
      name: 'Internal Coordination',
      description: 'Focus on internal party consensus and military readiness without external escalation',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'aiVsRobotics',
      flavorText: 'China does not need to act every turn. Patience is a form of power.',
    },
  ],

  BRICS: [
    {
      id: 'brics_summit',
      name: 'Emergency BRICS Summit for Yuan Oil Clearing',
      description: 'Activate parallel clearing system for oil in yuan/basket',
      cost: 10, shockValue: 18, lambdaDelta: 0.35,
      mediaType: 'legacy', subGameTrigger: 'bricsCurrency',
      flavorText: 'Coordination move that accelerates dedollarization when λ is high.',
    },
    {
      id: 'brics_summit_p2',
      name: 'BRICS Petrodollar Replacement Summit',
      description: 'Formal declaration of new BRICS reserve currency and oil settlement basket',
      cost: 13, shockValue: 23, lambdaDelta: 0.44,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'The communiqué uses the word "replacement." Not "alternative." The old order is put on notice.',
    },
    {
      id: 'fertilizer_export_control',
      name: 'Fertilizer Export Controls',
      description: 'Restrict fertilizer exports to pressure West',
      cost: 12, shockValue: 25, lambdaDelta: 0.40, fertilizerDelta: -15,
      mediaType: 'social', subGameTrigger: 'fertilizerFoodMigration',
      flavorText: 'Weaponizes food security — triggers migration and Europe fracture.',
    },
    {
      id: 'fertilizer_export_control_p2',
      name: 'Total Fertilizer Embargo',
      description: 'Full export ban on all nitrogen, phosphate, and potash — no waivers, no humanitarian exceptions',
      cost: 16, shockValue: 32, lambdaDelta: 0.50, fertilizerDelta: -19,
      mediaType: 'social', subGameTrigger: 'fertilizerFoodMigration',
      flavorText: 'Crops don\'t grow without fertilizer. Governments don\'t survive without crops. The West is learning this.',
    },
    {
      id: 'brics_energy_sharing',
      name: 'BRICS Emergency Energy Sharing',
      description: 'Coordinate intra-BRICS energy distribution',
      cost: 8, shockValue: 10, lambdaDelta: -0.10, energyDelta: 5,
      mediaType: 'legacy', subGameTrigger: 'multipolarOrder',
      flavorText: 'Builds coalition cohesion — reduces internal defection risk.',
    },
    {
      id: 'brics_energy_sharing_p2',
      name: 'BRICS Strategic Energy Union',
      description: 'Formalize a permanent BRICS energy union with shared strategic reserves',
      cost: 10, shockValue: 13, lambdaDelta: -0.13, energyDelta: 7,
      mediaType: 'legacy', subGameTrigger: 'multipolarOrder',
      flavorText: 'The coalition is no longer transactional — it is structural. BRICS becomes a genuine energy bloc.',
    },
    {
      id: 'wait_and_watch',
      name: 'Coalition Consultation',
      description: 'Hold internal consultations to build consensus before next major BRICS move',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'bricsCurrency',
      flavorText: 'The coalition speaks with one voice when it has actually agreed on something. This is how that happens.',
    },
  ],

  LEGACY: [
    {
      id: 'capital_controls',
      name: 'Emergency Capital Controls',
      description: 'Freeze cross-border flows to protect petrodollar infrastructure',
      cost: 15, shockValue: 20, lambdaDelta: 0.32,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Legacy rails fight back — often accelerates crypto surge as escape valve.',
    },
    {
      id: 'capital_controls_p2',
      name: 'Full Petrodollar Defense Protocol',
      description: 'Total capital flow surveillance and enforcement — no dollar outflow to alternative rails',
      cost: 20, shockValue: 25, lambdaDelta: 0.40,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'The walls go up. Every dollar is tracked. Every outflow is treated as a threat. Crypto adoption surges in response.',
    },
    {
      id: 'swift_upgrades',
      name: 'Fast-Track SWIFT + CBDC Upgrades',
      description: 'Emergency modernization to compete with crypto',
      cost: 14, shockValue: 14, lambdaDelta: 0.20,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Defensive move that temporarily slows crypto dominance.',
    },
    {
      id: 'swift_upgrades_p2',
      name: 'SWIFT 3.0 — Real-Time CBDC Layer',
      description: 'Deploy next-gen SWIFT with central bank digital currency integration and instant settlement',
      cost: 18, shockValue: 18, lambdaDelta: 0.25,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Legacy rails go real-time. The gap to crypto narrows. But can institutions move fast enough?',
    },
    {
      id: 'imf_emergency_loan',
      name: 'IMF Emergency Stabilization Package',
      description: 'Deploy IMF resources to stabilize fragile economies',
      cost: 12, shockValue: 8, lambdaDelta: -0.10,
      mediaType: 'legacy', subGameTrigger: 'multipolarOrder',
      flavorText: 'Buys loyalty and reduces defection — slows multipolar realignment.',
    },
    {
      id: 'imf_emergency_loan_p2',
      name: 'IMF Global Stability Mandate',
      description: 'Deploy unlimited IMF emergency facilities with full conditionality — petrodollar loyalty required',
      cost: 16, shockValue: 10, lambdaDelta: -0.13,
      mediaType: 'legacy', subGameTrigger: 'multipolarOrder',
      flavorText: 'The loans come with strings. Governments that accept them stay in the dollar system. For now.',
    },
    {
      id: 'swift_exclusion',
      name: 'SWIFT Exclusion of Non-Compliant Banks',
      description: 'Cut banks facilitating yuan oil settlement from SWIFT',
      cost: 14, shockValue: 18, lambdaDelta: 0.40,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Escalates financial warfare — often accelerates alternative rail adoption.',
    },
    {
      id: 'swift_exclusion_p2',
      name: 'Global SWIFT Kill Switch',
      description: 'Activate total SWIFT exclusion for entire nations — not just banks',
      cost: 18, shockValue: 23, lambdaDelta: 0.50,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'The nuclear option of financial warfare. Countries cut off. Crypto becomes their only lifeline.',
    },
    {
      id: 'wait_and_watch',
      name: 'Monitor Markets',
      description: 'Hold position and assess market dynamics before deploying political capital',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'The system has survived crises before. Sometimes the right move is to let the panic exhaust itself.',
    },
  ],

  CRYPTO: [
    {
      id: 'hyperliquid_oil',
      name: 'Launch 24/7 Crypto Oil Futures',
      description: 'Offer borderless, instant oil settlement on crypto rails',
      cost: 9, shockValue: 22, lambdaDelta: 0.38,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Crypto acts as escape valve when legacy systems freeze under fear.',
    },
    {
      id: 'hyperliquid_oil_p2',
      name: 'Crypto Becomes Dominant Oil Settlement',
      description: 'Crypto derivatives eclipse legacy oil futures in volume — new benchmark emerges',
      cost: 12, shockValue: 28, lambdaDelta: 0.48,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'The charts are undeniable. More oil is priced in crypto than in dollars. The story writes itself.',
    },
    {
      id: 'stablecoin_corridors',
      name: 'Expand Stablecoin Oil Corridors',
      description: 'Build direct crypto settlement channels for BRICS nations',
      cost: 11, shockValue: 19, lambdaDelta: 0.35,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'Bridges crypto and BRICS — accelerates dedollarization.',
    },
    {
      id: 'stablecoin_corridors_p2',
      name: 'Global Stablecoin Reserve Network',
      description: 'Launch multi-nation stablecoin reserve system with BRICS as anchor participants',
      cost: 14, shockValue: 24, lambdaDelta: 0.44,
      mediaType: 'social', subGameTrigger: 'bricsCurrency',
      flavorText: 'Stablecoins are no longer products. They are infrastructure. The network is now the reserve.',
    },
    {
      id: 'whale_coordination',
      name: 'Whale Coordination Protocol',
      description: 'Coordinate large holders to demonstrate crypto liquidity',
      cost: 10, shockValue: 16, lambdaDelta: 0.30,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Proves crypto depth — builds confidence in non-legacy settlement.',
    },
    {
      id: 'whale_coordination_p2',
      name: 'Proof-of-Liquidity Global Event',
      description: 'Public coordinated demonstration — trillions in crypto depth visible in real time',
      cost: 13, shockValue: 20, lambdaDelta: 0.38,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'The whales surface simultaneously. The markets see infinite depth. Doubts about crypto liquidity vanish.',
    },
    {
      id: 'narrative_capture',
      name: 'Social Media Narrative Capture',
      description: 'Dominate the media cycle with anti-legacy messaging',
      cost: 7, shockValue: 14, lambdaDelta: 0.22,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Every freeze in legacy rails is your advertisement.',
    },
    {
      id: 'narrative_capture_p2',
      name: 'Viral Anti-Legacy Media Takeover',
      description: 'Coordinate influencers, memes, and real-time crisis coverage to destroy confidence in banks',
      cost: 10, shockValue: 18, lambdaDelta: 0.28,
      mediaType: 'social', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Legacy finance is trending — for all the wrong reasons. Every bank run clip is a recruitment ad.',
    },
    {
      id: 'wait_and_watch',
      name: 'Network Consolidation',
      description: 'Focus on internal protocol upgrades and community cohesion without public escalation',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Build in silence. Every quiet turn is a turn the legacy system spends burning itself down.',
    },
  ],

  EUROPE: [
    {
      id: 'russian_gas_restart',
      name: 'Restart Russian Gas Imports',
      description: 'Negotiate emergency gas deals with Russia despite sanctions',
      cost: 20, shockValue: 15, lambdaDelta: -0.15, energyDelta: 18,
      mediaType: 'legacy', subGameTrigger: 'europeFracture',
      flavorText: 'High domestic political cost but immediate energy relief.',
    },
    {
      id: 'russian_gas_restart_p2',
      name: 'Full Russian Energy Re-Integration',
      description: 'Normalize full energy trade with Russia — pipelines, LNG, and nuclear fuel',
      cost: 26, shockValue: 19, lambdaDelta: -0.19, energyDelta: 23,
      mediaType: 'social', subGameTrigger: 'europeFracture',
      flavorText: 'The sanctions framework cracks publicly. Energy security wins over geopolitical solidarity. Europe is going its own way.',
    },
    {
      id: 'full_rationing',
      name: 'Europe-Wide Energy Rationing & Coal Revival',
      description: 'Impose strict rationing and restart coal plants',
      cost: 16, shockValue: 28, lambdaDelta: 0.45, energyDelta: -10,
      mediaType: 'social', subGameTrigger: 'europeFracture',
      flavorText: 'High λ move that aligns Europe with SE_Asia lockdown pattern.',
    },
    {
      id: 'full_rationing_p2',
      name: 'Wartime Energy Command Economy',
      description: 'Full state seizure of energy distribution — mandatory quotas enforced by law',
      cost: 21, shockValue: 35, lambdaDelta: 0.57, energyDelta: -13,
      mediaType: 'social', subGameTrigger: 'europeFracture',
      flavorText: 'Europe hasn\'t seen energy emergency laws like this since 1973. Governments that survive this will be changed by it.',
    },
    {
      id: 'green_transition_push',
      name: 'Emergency Green Energy Acceleration',
      description: 'Fast-track renewable projects to reduce fossil dependency',
      cost: 14, shockValue: 12, lambdaDelta: 0.15, energyDelta: 6,
      mediaType: 'legacy', subGameTrigger: 'europeFracture',
      flavorText: 'Long-term play with short-term pain — modest immediate energy relief.',
    },
    {
      id: 'green_transition_push_p2',
      name: 'Emergency Green New Deal',
      description: 'Multi-trillion emergency investment — solar, wind, hydrogen on crisis timeline',
      cost: 18, shockValue: 15, lambdaDelta: 0.19, energyDelta: 8,
      mediaType: 'legacy', subGameTrigger: 'europeFracture',
      flavorText: 'Crisis becomes catalyst. Permitting is waived. Contracts are signed in days. The transition accelerates beyond all projections.',
    },
    {
      id: 'ecb_emergency_rate',
      name: 'ECB Emergency Rate Action',
      description: 'ECB intervenes to stabilize inflation and financial markets',
      cost: 11, shockValue: 10, lambdaDelta: 0.20, inflationDelta: -8,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Defends legacy financial architecture — moderates inflation spiral.',
    },
    {
      id: 'ecb_emergency_rate_p2',
      name: 'ECB Quantitative Easing Blitz',
      description: 'Unlimited bond-buying, emergency liquidity facilities, and coordinated fiscal backstop',
      cost: 14, shockValue: 13, lambdaDelta: 0.25, inflationDelta: -10,
      mediaType: 'legacy', subGameTrigger: 'legacyVsCrypto',
      flavorText: 'Whatever it takes — again. The ECB balance sheet expands into the unknown. Confidence is purchased at price.',
    },
    {
      id: 'eu_sanctions_package',
      name: 'New EU Sanctions Package',
      description: 'Expand sanctions on Russia/Iran to coordinate with US',
      cost: 15, shockValue: 20, lambdaDelta: 0.35,
      mediaType: 'social', subGameTrigger: 'multipolarOrder',
      flavorText: 'Aligns EU with US bloc — risks worsening energy crisis domestically.',
    },
    {
      id: 'eu_sanctions_package_p2',
      name: 'EU Total Economic Warfare Package',
      description: 'Full sanctions on Russia, Iran, and any state facilitating sanctions evasion',
      cost: 20, shockValue: 25, lambdaDelta: 0.44,
      mediaType: 'social', subGameTrigger: 'multipolarOrder',
      flavorText: 'Maximum economic warfare — and maximum domestic pain. Energy prices spike. Eastern members fracture.',
    },
    {
      id: 'wait_and_watch',
      name: 'Diplomatic Pause',
      description: 'Suspend new commitments while member states align on collective position',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'europeFracture',
      flavorText: 'Europe moves slowly by design. Sometimes that is wisdom. Sometimes it is paralysis.',
    },
  ],

  SE_ASIA: [
    {
      id: 'early_lockdown',
      name: 'Implement Early Energy Lockdown Measures',
      description: '4-day work weeks, fuel rationing, fertilizer export bans',
      cost: 8, shockValue: 20, lambdaDelta: 0.32, energyDelta: -10, fertilizerDelta: -12,
      mediaType: 'social', subGameTrigger: 'seAsiaLockdown',
      flavorText: 'SE_Asia acts as early amplifier — pushes global λ and fertilizer crisis.',
    },
    {
      id: 'early_lockdown_p2',
      name: 'Full Regional Lockdown Declaration',
      description: 'Declare regional emergency — 3-day weeks, full fuel rationing, martial law for distribution',
      cost: 10, shockValue: 25, lambdaDelta: 0.40, energyDelta: -13, fertilizerDelta: -15,
      mediaType: 'social', subGameTrigger: 'seAsiaLockdown',
      flavorText: 'The 2020 playbook — maximized. SE_Asia has done this before and the region knows exactly how it ends.',
    },
    {
      id: 'export_bans',
      name: 'Fuel & Fertilizer Export Bans',
      description: 'Protect domestic supply by banning exports',
      cost: 10, shockValue: 18, lambdaDelta: 0.30, fertilizerDelta: -15,
      mediaType: 'social', subGameTrigger: 'fertilizerFoodMigration',
      flavorText: 'Protects local populations but worsens global cascades.',
    },
    {
      id: 'export_bans_p2',
      name: 'Total Export Moratorium',
      description: 'All strategic resource exports halted indefinitely — enforced at ports',
      cost: 13, shockValue: 23, lambdaDelta: 0.38, fertilizerDelta: -19,
      mediaType: 'social', subGameTrigger: 'fertilizerFoodMigration',
      flavorText: 'Not a ban. A moratorium. The word matters — it signals permanence. Global food supply chains begin rerouting.',
    },
    {
      id: 'chip_fab_redirect',
      name: 'Redirect Chip Fab to Domestic Use',
      description: 'Redirect semiconductor production away from exports',
      cost: 14, shockValue: 16, lambdaDelta: 0.22, chipDelta: -8,
      mediaType: 'legacy', subGameTrigger: 'aiVsRobotics',
      flavorText: 'Protects domestic tech but worsens global chip shortage.',
    },
    {
      id: 'chip_fab_redirect_p2',
      name: 'Regional Chip Fab Nationalization',
      description: 'State seizure of all semiconductor facilities — full domestic priority',
      cost: 18, shockValue: 20, lambdaDelta: 0.28, chipDelta: -10,
      mediaType: 'social', subGameTrigger: 'aiVsRobotics',
      flavorText: 'The fabs are now the state. Export contracts are voided. Silicon sovereignty is declared.',
    },
    {
      id: 'asean_food_reserve',
      name: 'Activate ASEAN Food Reserve',
      description: 'Release strategic food reserves to manage domestic panic',
      cost: 9, shockValue: 8, lambdaDelta: -0.10, fertilizerDelta: 8,
      mediaType: 'legacy', subGameTrigger: 'fertilizerFoodMigration',
      flavorText: 'Buys time against the food cascade — reduces regional panic.',
    },
    {
      id: 'asean_food_reserve_p2',
      name: 'ASEAN Emergency Food Sovereignty Act',
      description: 'Permanent regional food sovereignty framework — guaranteed production floors and shared reserves',
      cost: 12, shockValue: 10, lambdaDelta: -0.13, fertilizerDelta: 10,
      mediaType: 'legacy', subGameTrigger: 'fertilizerFoodMigration',
      flavorText: 'The crisis becomes policy. SE_Asia will never depend on external fertilizer supply again. This is the declaration.',
    },
    {
      id: 'asean_neutral_hub',
      name: 'Declare ASEAN Neutral Settlement Hub',
      description: 'Position SE_Asia as neutral ground for BRICS-West trade',
      cost: 12, shockValue: 14, lambdaDelta: 0.15,
      mediaType: 'legacy', subGameTrigger: 'multipolarOrder',
      flavorText: 'Strategic neutrality — builds influence in multipolar realignment.',
    },
    {
      id: 'asean_neutral_hub_p2',
      name: 'ASEAN Free Trade Zone Declaration',
      description: 'Formalize ASEAN as a permanent neutral free trade zone — sanctions-proof, currency-agnostic',
      cost: 16, shockValue: 18, lambdaDelta: 0.19,
      mediaType: 'legacy', subGameTrigger: 'multipolarOrder',
      flavorText: 'Everyone needs a place where they can still trade. ASEAN just became that place. Leverage compounds.',
    },
    {
      id: 'wait_and_watch',
      name: 'Observe and Adapt',
      description: 'Monitor regional developments and preserve resources for critical inflection points',
      cost: 0, shockValue: 0, lambdaDelta: -0.05,
      mediaType: 'legacy', subGameTrigger: 'seAsiaLockdown',
      flavorText: 'The region that moved first in 2020 also learned when not to move. Timing is everything.',
    },
  ],
};

export function getActionsForFaction(factionId: string): Action[] {
  return FACTION_ACTIONS[factionId] ?? [];
}

export function getAffordableActions(factionId: string, politicalCapital: number): Action[] {
  return getActionsForFaction(factionId).filter(a => a.cost <= politicalCapital);
}

const COOLDOWN_TURNS = 3;
const COOLDOWN_EXEMPT = new Set(['wait_and_watch']);

/**
 * Returns the set of actions currently available to a faction, respecting the 3-turn cooldown.
 * - Actions used within the last 3 turns are hidden
 * - After cooldown, Phase 2 (_p2) variant replaces the original (if it exists and isn't also cooling down)
 * - wait_and_watch is always available
 */
export function getAvailableActions(
  factionId: FactionId | string,
  overreachHistory: Array<{ factionId: string; actionId: string; turn: number }>,
  currentTurn: number
): Action[] {
  const base = FACTION_ACTIONS[factionId] ?? [];
  // Separate base actions from _p2 variants and exempt actions
  const originals = base.filter(a => !a.id.endsWith('_p2') && !COOLDOWN_EXEMPT.has(a.id));
  const exempt = base.filter(a => COOLDOWN_EXEMPT.has(a.id));

  function lastUsedTurn(id: string): number {
    const entries = overreachHistory.filter(
      h => h.factionId === factionId && h.actionId === id
    );
    if (entries.length === 0) return 0;
    return Math.max(...entries.map(h => h.turn));
  }

  function isOnCooldown(id: string): boolean {
    const last = lastUsedTurn(id);
    return last > 0 && (currentTurn - last) < COOLDOWN_TURNS;
  }

  const available: Action[] = [...exempt];

  for (const action of originals) {
    const p2 = base.find(a => a.id === action.id + '_p2');
    const originalOnCooldown = isOnCooldown(action.id);
    const p2OnCooldown = p2 ? isOnCooldown(p2.id) : false;
    const originalEverUsed = overreachHistory.some(
      h => h.factionId === factionId && h.actionId === action.id
    );

    if (!originalOnCooldown) {
      if (originalEverUsed && p2 && !p2OnCooldown) {
        // Original was used before and has cooled down → graduate to Phase 2
        available.push(p2);
      } else if (!originalEverUsed) {
        // Never used — show original
        available.push(action);
      } else if (originalEverUsed && (!p2 || p2OnCooldown)) {
        // No Phase 2 exists or Phase 2 is also cooling down → cycle back to original
        if (!p2OnCooldown || !p2) available.push(action);
      }
    } else if (p2 && !p2OnCooldown && originalEverUsed) {
      // Original on cooldown but Phase 2 is ready (and original was played before)
      available.push(p2);
    }
    // else: both on cooldown — skip
  }

  return available;
}
