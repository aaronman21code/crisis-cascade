# Crisis Cascade: Hormuz 2026 — Build Reference (v2.0)

## Stack
- **Frontend:** React 18 + TypeScript + Tailwind CSS 3 + Vite 5
- **Backend:** Node.js + Express + Socket.io 4
- **State (client):** Zustand + in-memory (no DB for MVP)
- **State (server):** In-memory room Map
- **Animation:** Framer Motion (active — phase transitions, card reveals, metric counters)
- **Hosting target:** Vercel (frontend) + Railway/Render (backend)

---

## Project Structure

```
crisis-cascade/
├── src/
│   └── engine/                       ← Engine zone — modify carefully
│       ├── logicEngine.ts             ← GameState, ResourcePools, Faction, INITIAL_STATE, processTurn()
│       ├── gameTheoryData.ts          ← 8 sub-games, U′ formula, λ thresholds, payoff weights
│       ├── payoffEngine.ts            ← U′ calculator, sub-game evaluators, isCooperationLocked()
│       ├── cascades.ts                ← CascadeEvent definitions + applyCascades()
│       ├── perceptionEngine.ts        ← Media shock amplifier (panic/stability only, NOT globalLambda)
│       ├── factionActions.ts          ← 8 factions × actions + helpers
│       ├── winConditions.ts           ← per-faction victory checks (all require objectiveProgress)
│       └── newsGenerator.ts           ← λ-tiered procedural headlines + 2020 parallel quotes
│       └── ENGINE_API.md              ← full API reference — read this instead of source files
├── backend/
│   ├── src/server.ts                  ← Socket.io server + room mgmt + AI bots + turn processing
│   ├── package.json
│   └── tsconfig.json                  ← no rootDir (engine files imported from outside src/)
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                    ← landing → lobby → game router; wantsLanding redirect
│   │   ├── vite-env.d.ts
│   │   ├── store/game.ts              ← Zustand store + all socket event handlers
│   │   ├── utils/stanceEngine.ts      ← pure scoring/abstraction functions (no React, no store)
│   │   ├── COMPONENT_MAP.md           ← component reference — read this before exploring files
│   │   └── components/
│   │       ├── Dashboard.tsx          ← phase router (AnimatePresence)
│   │       ├── LoopAnalysis.tsx       ← post-turn full analysis; Continue Observing / New Game
│   │       ├── shared/
│   │       │   ├── GameHeader.tsx
│   │       │   ├── LambdaHero.tsx
│   │       │   ├── PhaseBar.tsx
│   │       │   ├── ActionCard.tsx
│   │       │   └── FactionIntelPanel.tsx ← combined standings + intel; FACTION_COLORS export
│   │       └── phases/
│   │           ├── GDelayScreen.tsx   ← intel phase; Pass Turn fallback when PC=0
│   │           ├── MShockScreen.tsx
│   │           ├── PFearScreen.tsx
│   │           ├── GOverreachScreen.tsx
│   │           └── ResolvingScreen.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── package.json                       ← root workspace (npm workspaces)
├── tsconfig.base.json
└── BUILD_REFERENCE.md                 ← this file
```

---

## Engine Layer

### `logicEngine.ts`
- Exports `ResourcePools`, `GameState`, `Faction`, `INITIAL_STATE`, `processTurn()`
- `processTurn(state, playerActions)` — pure function, no callbacks
- G-M-P-G loop phases:
  1. **G_Delay** — hidden intel moves (delayAction → hiddenIntel[])
  2. **M_Shock** — accumulate `totalLambdaShock` per faction action (weighted by `lambdaWeight`); apply `* 0.12` once to globalLambda; call `applyPerception()` for panic/stability
  3. **P_Fear** — panicIndex = `floor(globalLambda * 25 + (100-energyPool) * 0.6)`; oilPrice = `118 + panicIndex * 0.4`
  4. **G_Overreach** — apply pool deltas, deduct PC, advance objectiveProgress by `shockValue * 0.45`, track overreachHistory
  5. **PC regen** — `+12/turn` per faction, capped at starting max
  6. **applyCascades** — check all CascadeEvent thresholds, fire new ones
  7. **cryptoShare** — `8 + CRYPTO.objectiveProgress * 0.92`
  8. **Hard λ cap** — `newState.globalLambda ≤ state.globalLambda + 0.55`
  9. **Stability** — `-= (globalLambda*6) + (100-energy)*0.5 + (100-fertilizer)*0.3`
  10. **checkWinConditions** — mutates gameOver/winner

- `INITIAL_STATE`: all pools=100 (inflationIndex=100), globalLambda=1.0, panicIndex=0, oilPrice=118, cryptoShare=8, stabilityScore=100
- Initial PC: US=50, IRAN=45, CHINA=55, BRICS=40, LEGACY=60, CRYPTO=35, EUROPE=48, SE_ASIA=38

### `gameTheoryData.ts`
- 8 factions: `US | IRAN | CHINA | BRICS | LEGACY | CRYPTO | EUROPE | SE_ASIA`
- 8 sub-games: `iranWar, bricsCurrency, aiVsRobotics, legacyVsCrypto, multipolarOrder, europeFracture, seAsiaLockdown, fertilizerFoodMigration`
- λ thresholds: `cascadeTrigger: 2.0`, `lockNash: 2.5`, `fullEnergyLockdownRisk: 3.0`
- Per-faction `lambdaWeight` (multiplies action's raw lambdaDelta before global accumulation)

### `perceptionEngine.ts`
- `applyPerception(state, { mediaType, shockValue })` — mutates `panicIndex` and `stabilityScore` only
- **Does NOT touch globalLambda** — globalLambda is owned entirely by logicEngine Phase 2
- `legacy`: panicBonus=8, stabilityPenalty=3 | `social`: panicBonus=18, stabilityPenalty=8

### `payoffEngine.ts`
- `calculateUtility(faction, state, overreachCount)` → U′
- `evaluateAllSubGames(state)` → `SubGameResult[]` (8 results)
- `isCooperationLocked(state)` → `globalLambda > 2.5`
- `getBiggestLambdaContributor(actions, prevλ, newλ)` → powers LoopAnalysis quote

### `cascades.ts`
- `CascadeEvent[]` — threshold-triggered events (fires once, tracked in `activeCascades`)
- Threshold types: `energy ≤`, `fertilizer ≤`, `chip ≤`, `lambda ≥`, `inflation ≥`
- All `lambdaDelta` values halved vs v1 to prevent cascade avalanche
- `applyCascades(state)` — mutates state in-place; applies pool deltas + panicDelta + lambdaDelta
- `applyOverreachEffect()` — no-op kept for import compat

### `factionActions.ts`
- 8 factions with actions each
- Action fields: `id, name, description, flavorText, cost, shockValue, mediaType, lambdaDelta, energyDelta?, fertilizerDelta?, chipDelta?, inflationDelta?, subGameTrigger?`
- `subGameTrigger` (replaces old `subGame`); no `cascadeTrigger` field (removed)

### `winConditions.ts`
All conditions require meaningful `objectiveProgress` — minimum turn gates prevent turn-1 wins:

| Faction | Condition |
|---------|-----------|
| US | turn≥10, objectiveProgress>70, energyPool<45 |
| IRAN | turn≥8, objectiveProgress>60, chip_armageddon active |
| CHINA | turn≥12, objectiveProgress>75, chipPool<40 |
| BRICS | turn≥10, objectiveProgress>65, globalLambda>2.0 |
| LEGACY | turn≥8, objectiveProgress>60, cryptoShare<25 |
| CRYPTO | turn≥8, cryptoShare>55, legacyVsCrypto equilibrium='dominated' |
| EUROPE | turn≥5, objectiveProgress>65, energyPool>55, fertilizerPool>50, λ<2.8 |
| SE_ASIA | turn≥6, objectiveProgress>60, fertilizerPool>45 |
| GLOBAL_LOSS | stabilityScore≤0 OR consecutiveLowEnergy≥5 |

### `newsGenerator.ts`
- 4 λ tiers: calm (<1.5), tension (1.5–2.0), crisis (2.0–2.5), chaos (≥2.5)
- `generateHeadlines(state, prevState)` → headline array
- `getLoopAnalysisQuote(prevλ, newλ, action, cascades)` → always references 2020 parallel

---

## Backend

### `backend/src/server.ts`
- Express + Socket.io on `:3001`; room store is `Map<roomId, Room>` (in-memory)
- `Room` interface: `state, prevState, players, pendingActions, actionsSubmitted, phase, turnTimer, loopAnalysis, acknowledgedWinners`
- Socket events:
  - `room:join` → assign faction; **PC restored to starting value** when human joins mid-game; emit `room:joined` + broadcast `room:update`
  - `game:start` → emit `game:started` + `phase:change { phase: 'g_delay', turn: 1 }`
  - `action:submit` → store pending; when all human players submitted → `fillBotsAndProcess()`
  - `director:submit` → all 8 faction actions at once → `fillBotsAndProcess()`
  - `turn:force` → skip wait, process immediately
  - `game:reset` → wipe to `INITIAL_STATE`, keep players, clear `acknowledgedWinners`
  - `game:continue` → add winner to `acknowledgedWinners`; clear `gameOver`; resume after 2s
  - `phase:skip` → Director only: skip to g_overreach
  - `analysis:next` → skip analysis window, advance to next turn
- **`fillBotsAndProcess()`**:
  1. Fill uncontrolled factions with bot picks (sort by `shockValue * 0.5 + energyDelta * 0.3`)
  2. Save `prevState` (shallow-copy with pools + factions deep-copied)
  3. Call `processTurn(room.state, room.pendingActions)` — wrapped in try/catch
  4. Append generated headlines to `newsFeed` (capped at 30)
  5. Build `loopAnalysis` quote via `getBiggestLambdaContributor()`
  6. Capture `resolvedActions: Record<FactionId, {actionId, actionName}>`
  7. **Skip re-declared winners** — if `acknowledgedWinners` contains current winner, clear `gameOver`
  8. Reset `pendingActions` and `actionsSubmitted`
  9. Emit `turn:result` with `{ state, prevState, loopAnalysis, subGames, resolvedActions }`
  10. Schedule `phase:change → g_delay` after **22s** (analysis window)

---

## Frontend

### `store/game.ts` (Zustand)
**State fields:**
- `socket, roomId, connected`
- `gameState: GameState`, `prevState: GameState | null`
- `playerFaction, playerName, players[]`
- `phase`
- `pendingActionId, actionsProgress: { submitted, total }`
- `loopAnalysis, subGames: SubGameResult[]`
- `resolvedActions: Record<string, { actionId, actionName }>`
- `observedWinner: FactionId | null` — set when game:over fires; persists during observe mode
- `wantsLanding: boolean` — triggers landing screen return + faction clear on next render

**Key socket handlers:**
- `turn:result` → sets phase to `'resolving'` + stores `resolvedActions`
- `game:over` → sets `observedWinner`; phase stays on current screen
- `game:reset` → clears all, phase → `'lobby'`

**Actions:** `connect, joinRoom, startGame, submitAction, submitDirectorActions, forceTurn, resetGame, advanceToAnalysis, continueObserving, clearWantsLanding, skipToOverreach`

---

## Game Flow

```
Landing → pick name + room code + faction (8 options + DIRECTOR)
  ↓
Lobby → player list + start button
  ↓
Turn loop:
  GDelayScreen     → intel phase: pick action (Pass Turn if PC=0)
  MShockScreen     → breaking news: λ rises, headlines appear
  PFearScreen      → fear phase: panic index + oil price update
  GOverreachScreen → overreach: submit faction action (3–5 options)
    (bots fill uncontrolled; Director controls all)
    processTurn() fires → resolvedActions captured
    ↓
  ResolvingScreen  → faction-by-faction execution reveal + score deltas
    ↓
  LoopAnalysis     → full post-turn: λ quote, cascades, sub-games, objectives (22s window)
    ↓ (auto-advance after 22s)
Next turn
  ↓
Game over → win/loss banner in LoopAnalysis
  → "Continue Observing" button resumes loop (acknowledgedWinners suppresses repeat)
  → "New Game" → resets + returns to landing with faction re-select
```

---

## Run Commands

```bash
# From crisis-cascade/ root
npm run dev          # starts both backend (3001) and frontend (5173) via concurrently

# Or individually:
cd backend  && npm run dev   # tsx watch src/server.ts
cd frontend && npm run dev   # vite — MUST run from frontend/

# If port 3001 stuck:
lsof -ti:3001 | xargs kill -9

# Build check
cd frontend && npx tsc --noEmit && npx vite build
```

Open: **http://localhost:5173**

---

## Key Design Constraints

- **8 factions**: US, IRAN, CHINA, BRICS, LEGACY, CRYPTO, EUROPE, SE_ASIA
- **Resource pools**: all values live in `state.pools.*` — never top-level
- **No raw numbers for players**: PC, λ, energy abstracted via `stanceEngine.ts`. Director always sees raw.
- **Lambda balance**: action contributions scaled `* 0.12`; cascade lambdaDeltas halved; hard cap `+0.55/turn`
- **PC sustainability**: `+12 regen/turn`; PC restored to starting value when human joins; Pass Turn fallback
- **Director mode**: `playerFaction === 'DIRECTOR'` sees raw numbers, all factions, process turn directly
- **`@engine/` alias**: Vite + tsconfig path resolves to `src/engine/` — use everywhere

---

## Known Gaps / V2 Candidates

- No persistent DB — rooms lost on server restart
- AI bots are simple greedy — no sub-game awareness
- No mobile-specific layout pass (targets tablet+)
- No share/replay link generation
- Tutorial overlay not yet built
- `FACTION_INTEL` strings in GDelayScreen are static
- No Vercel/Railway deployment config yet
