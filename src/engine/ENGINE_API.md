# Engine API Reference (v2.0)
> All exports from engine files. Read this instead of source files.

---

## gameTheoryData.ts

```typescript
export type FactionId = 'US' | 'IRAN' | 'CHINA' | 'BRICS' | 'LEGACY' | 'CRYPTO' | 'EUROPE' | 'SE_ASIA';
export type SubGameKey = 'iranWar' | 'bricsCurrency' | 'aiVsRobotics' | 'legacyVsCrypto'
                       | 'multipolarOrder' | 'europeFracture' | 'seAsiaLockdown' | 'fertilizerFoodMigration';

export const GAME_THEORY_DATA = {
  lambdaThresholds: {
    cascadeTrigger: 2.0,
    lockNash: 2.5,
    fullEnergyLockdownRisk: 3.0,
  },
  subGames: {
    iranWar:                 { name: 'Iran War',                type: 'Chicken + Repeated Ladder' },
    bricsCurrency:           { name: 'BRICS Currency',          type: 'Stag Hunt / Coordination' },
    aiVsRobotics:            { name: 'AI vs Robotics',          type: 'Zero-Sum Tech Race' },
    legacyVsCrypto:          { name: 'Legacy vs Crypto',        type: 'Market-Share Chicken' },
    multipolarOrder:         { name: 'Multipolar Order',        type: 'n-Player Network Game' },
    europeFracture:          { name: 'Europe Fracture',         type: 'Coordination / Defection' },
    seAsiaLockdown:          { name: 'SE Asia Lockdown',        type: 'Public Goods Game' },
    fertilizerFoodMigration: { name: 'Fertilizer → Migration',  type: 'Cascade Chain' },
  },
  factionSpecificPayoffAdjustments: {
    US:      { lambdaWeight: 1.2 }, IRAN:    { lambdaWeight: 0.9 },
    CHINA:   { lambdaWeight: 1.1 }, BRICS:   { lambdaWeight: 1.0 },
    LEGACY:  { lambdaWeight: 0.8 }, CRYPTO:  { lambdaWeight: 1.3 },
    EUROPE:  { lambdaWeight: 1.0 }, SE_ASIA: { lambdaWeight: 0.95 },
  },
}
```

---

## logicEngine.ts

```typescript
export interface ResourcePools {
  energyPool: number;       // 0–100 (global oil/energy supply %)
  fertilizerPool: number;   // 0–100
  chipPool: number;         // 0–100 (semiconductors)
  inflationIndex: number;   // 100 = baseline; 150+ = crisis; max 200
}

export interface Faction {
  id: FactionId; name: string;
  politicalCapital: number;  // US=50, IRAN=45, CHINA=55, BRICS=40, LEGACY=60, CRYPTO=35, EUROPE=48, SE_ASIA=38
  lambda: number;            // 1.0–4.0, faction-level tension
  objectiveProgress: number; // 0–100
  hiddenIntel: string[];     // G_Delay phase picks
}

export interface GameState {
  turn: number;
  pools: ResourcePools;       // all pool values nested here
  globalLambda: number;       // 1.0–5.0, hard cap +0.55/turn
  factions: Record<FactionId, Faction>;
  panicIndex: number;         // 0–100; floor(globalLambda * 25 + (100-energyPool) * 0.6)
  oilPrice: number;           // 118 + panicIndex * 0.4
  cryptoShare: number;        // 0–100 %; 8 + CRYPTO.objectiveProgress * 0.92
  newsFeed: Array<{ title: string; impact: number; turn: number }>;
  activeCascades: string[];
  stabilityScore: number;     // starts 100; -= (globalLambda*6) + (100-energy)*0.5 + (100-fertilizer)*0.3
  overreachHistory: Array<{ factionId: FactionId; actionId: string; turn: number }>;
  consecutiveLowEnergy: number;
  gameOver: boolean;
  winner: FactionId | 'DIRECTOR' | 'GLOBAL_LOSS' | null;
}

export const INITIAL_STATE: GameState
// pools: all 100 (inflationIndex=100), globalLambda=1.0, panicIndex=0, oilPrice=118, cryptoShare=8, stabilityScore=100

export function processTurn(
  state: GameState,
  playerActions: Partial<Record<FactionId, { actionId: string; delayAction?: string }>>
): GameState
// Phases: G_Delay (intel) → M_Shock (lambda accumulation via perceptionEngine) → P_Fear (panic/oil) → G_Overreach (pool deltas, PC deduct, progress) → applyCascades → cryptoShare → hard λ cap → stability → checkWinConditions
// PC regen: +12/turn capped at starting max per faction
```

---

## factionActions.ts

```typescript
export interface Action {
  id: string; name: string; description: string; flavorText: string;
  cost: number;            // PC cost
  shockValue: number;      // media shock magnitude; objectiveProgress += shockValue * 0.45
  mediaType: 'legacy' | 'social';
  lambdaDelta: number;     // faction's raw lambda contribution (scaled ×0.12 globally in processTurn)
  energyDelta?: number;
  fertilizerDelta?: number;
  chipDelta?: number;
  inflationDelta?: number;
  subGameTrigger?: string; // sub-game key this action relates to
}

export function getActionsForFaction(factionId: FactionId): Action[]
export const FACTION_ACTIONS: Record<FactionId, Action[]>
```

---

## cascades.ts

```typescript
export interface CascadeEvent {
  id: string; name: string; description: string; flavorText: string;
  energyDelta: number; fertilizerDelta: number; chipDelta: number;
  inflationDelta: number; panicDelta: number; lambdaDelta: number;
  subGameTrigger?: string;
  thresholdType: 'energy' | 'fertilizer' | 'chip' | 'lambda' | 'inflation';
  thresholdValue: number;
}

export const CASCADE_EVENTS: CascadeEvent[]
// Fires when threshold crossed (≤ for pools, ≥ for lambda/inflation)
// Active cascades tracked in state.activeCascades — never fires twice

export function applyCascades(state: CascadeState): void  // mutates in-place
export function applyOverreachEffect(...): void            // no-op (kept for import compat)
```

---

## winConditions.ts

Win conditions — all require meaningful objectiveProgress:
- **US**: turn≥10, objectiveProgress>70, energyPool<45 → `US_HEGEMONY`
- **IRAN**: turn≥8, objectiveProgress>60, activeCascades includes `chip_armageddon` → `IRAN_DOMINANCE`
- **CHINA**: turn≥12, objectiveProgress>75, chipPool<40 → `CHINA_TECHNOCRACY`
- **BRICS**: turn≥10, objectiveProgress>65, globalLambda>2.0 → `BRICS_REALIGNMENT`
- **LEGACY**: turn≥8, objectiveProgress>60, cryptoShare<25 → `LEGACY_CONTROL`
- **CRYPTO**: turn≥8, cryptoShare>55, equilibriumState==='dominated' → `CRYPTO_ASCENDANCY`
- **EUROPE**: turn≥5, objectiveProgress>65, energyPool>55, fertilizerPool>50, λ<2.8 → `EUROPE_STABILITY`
- **SE_ASIA**: turn≥6, objectiveProgress>60, fertilizerPool>45 → `SE_ASIA_PIVOT`
- **GLOBAL_LOSS**: stabilityScore≤0 OR consecutiveLowEnergy≥5

---

## perceptionEngine.ts

```typescript
export function applyPerception(state, { mediaType, shockValue }): void
// Mutates: panicIndex += panicBonus; stabilityScore -= stabilityPenalty
// Does NOT touch globalLambda (owned by logicEngine Phase 2)
// legacy: panicBonus=8, stabilityPenalty=3
// social: panicBonus=18, stabilityPenalty=8
```

---

## payoffEngine.ts

```typescript
export function evaluateAllSubGames(state: GameState): SubGameResult[]
export function getBiggestLambdaContributor(pendingActions, prevLambda, newLambda): { factionId, actionId } | null
// SubGameResult: { key, name, equilibriumState: 'stable'|'shifting'|'dominated'|'locked', ... }
```

---

## newsGenerator.ts

```typescript
export function generateHeadlines(state: GameState, prevState: GameState): Array<{ title, impact, turn }>
export function getLoopAnalysisQuote(prevLambda, newLambda, actionName, activeCascades): string
```
