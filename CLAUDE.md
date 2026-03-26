# Crisis Cascade — Claude Instructions

## Engine Files — Handle With Care
Engine files have been modified during v2.0 migration (balance tuning, new types). They are NOT fully sacred anymore, but treat all changes carefully — logic structure should not change, only values/signatures when absolutely required.
```
src/engine/logicEngine.ts       ← GameState, processTurn (core loop)
src/engine/gameTheoryData.ts    ← sub-games, λ thresholds, payoff weights
src/engine/factionActions.ts    ← all 8 factions' actions
src/engine/cascades.ts          ← cascade event definitions + applyCascades()
src/engine/payoffEngine.ts      ← U′ calculator, sub-game evaluators
src/engine/winConditions.ts     ← per-faction win checks
src/engine/newsGenerator.ts     ← procedural headlines
src/engine/perceptionEngine.ts  ← media shock amplifier (panic/stability only)
```

## Import Alias
`@engine/` resolves to `crisis-cascade/src/engine/` via Vite + tsconfig path alias.
Use `@engine/logicEngine`, `@engine/factionActions`, etc. — never relative paths to the engine.

## Start Commands
```bash
cd backend  && npm run dev   # port 3001 (tsx watch)
cd frontend && npm run dev   # port 5173 (vite) — MUST run from frontend/, not root
```
Always start Vite from `frontend/` or it serves 404 (no index.html at root).

## Key Types (v2.0 — current)

```typescript
// gameTheoryData.ts
type FactionId = 'US' | 'IRAN' | 'CHINA' | 'BRICS' | 'LEGACY' | 'CRYPTO' | 'EUROPE' | 'SE_ASIA';

// logicEngine.ts
interface ResourcePools {
  energyPool: number;       // 0–100, global oil/energy supply %
  fertilizerPool: number;   // 0–100
  chipPool: number;         // 0–100 (semiconductors)
  inflationIndex: number;   // 100 = baseline; 150+ = crisis; max 200
}

interface Faction {
  id: FactionId; name: string;
  politicalCapital: number;   // initial: US=50, IRAN=45, CHINA=55, BRICS=40, LEGACY=60, CRYPTO=35, EUROPE=48, SE_ASIA=38
  lambda: number;             // 1.0–4.0 faction tension
  objectiveProgress: number;  // 0–100
  hiddenIntel: string[];
}

interface GameState {
  turn: number;
  pools: ResourcePools;       // ← all pool values live here now (not top-level)
  globalLambda: number;       // 1.0–5.0
  factions: Record<FactionId, Faction>;
  panicIndex: number;         // 0–100
  oilPrice: number;           // ~118 + panicIndex * 0.4
  cryptoShare: number;        // 0–100 %
  newsFeed: Array<{ title: string; impact: number; turn: number }>;
  activeCascades: string[];
  stabilityScore: number;     // starts 100, goes down over time
  overreachHistory: Array<{ factionId: FactionId; actionId: string; turn: number }>;
  consecutiveLowEnergy: number;
  gameOver: boolean;
  winner: FactionId | 'DIRECTOR' | 'GLOBAL_LOSS' | null;
}

// factionActions.ts
interface Action {
  id: string; name: string; description: string; flavorText: string;
  cost: number; shockValue: number;
  mediaType: 'legacy' | 'social';   // ← new (was implicit)
  lambdaDelta: number;
  energyDelta?: number; fertilizerDelta?: number; chipDelta?: number; inflationDelta?: number;
  subGameTrigger?: string;           // ← renamed from subGame
}

// processTurn — no callbacks, pure function
export function processTurn(
  state: GameState,
  playerActions: Partial<Record<FactionId, { actionId: string; delayAction?: string }>>
): GameState
```

## λ Thresholds
- `2.0` → cascadeTrigger (yuan dominant, cascades amplify)
- `2.5` → lockNash (cooperation payoff collapses)
- `3.0` → fullEnergyLockdownRisk

## Lambda Balance (v2.0)
- Action contributions: `totalLambdaShock * 0.12` (scaled down, applied once)
- Cascade lambdaDeltas: all halved vs v1
- Hard per-turn cap: `+0.55 max λ per turn`

## Store Phase Type
```typescript
type Phase = 'lobby' | 'g_delay' | 'm_shock' | 'p_fear' | 'g_overreach' | 'resolving' | 'analysis';
```

## Phase Flow
```
GDelayScreen → MShockScreen → PFearScreen → GOverreachScreen
  → (all submit) → ResolvingScreen → LoopAnalysis → next GDelayScreen
```
Server auto-advances to next g_delay after 22s.

## Faction Colors (FACTION_COLORS from FactionIntelPanel.tsx)
```
US=#60a5fa  IRAN=#4ade80  CHINA=#f87171  BRICS=#facc15
LEGACY=#c084fc  CRYPTO=#fb923c  EUROPE=#34d399  SE_ASIA=#f59e0b  DIRECTOR=#ffffff
```

## Display Rules
- **Players** never see raw PC/λ numbers — use `abstractResource()`, `abstractLambda()` from stanceEngine.ts
- **Director** (`playerFaction === 'DIRECTOR'`) always sees raw numbers; `showRaw={true}` on ActionCard, `isDirector={true}` on FactionIntelPanel
- Action count is dynamic: 3 (λ<2.0) / 4 (λ 2.0–2.5) / 5 (λ≥2.5) — controlled by `scoreActions()` in stanceEngine.ts

## Landing Page
`landing.html` — standalone single-file landing page (not part of the React app).
- Pure HTML + CSS + vanilla JS, no frameworks
- Deployed separately from the sim (can be hosted on any static host or Vercel root)
- Sections: Hero (λ bg animation + Hormuz map SVG + live stat chips) → Game Theory → Sub-Games (payoff matrix SVG) → G-M-P-G Loop (animated SVG) → Problem → Factions (relationship web SVG, pulse-glow cards) → Cascade chain SVG → Testimonials → CTA
- Animations: scroll-triggered reveals (IntersectionObserver), tension bar (scroll-driven), loop node highlight sequence, hero stat tickers, faction card glow pulse
- Links to: `https://crisis-cascade.vercel.app`

## Full Reference
See `BUILD_REFERENCE.md` for complete architecture docs.
See `src/engine/ENGINE_API.md` for all engine exports.
See `frontend/src/COMPONENT_MAP.md` for component props/purpose.
