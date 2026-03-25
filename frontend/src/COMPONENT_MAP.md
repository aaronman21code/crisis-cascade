# Component Map (v2.0)
> One-liner purpose + key props for every component. Read this before exploring individual files.

---

## Phase Screens (`components/phases/`)

### `GDelayScreen`
Intel phase — player picks an action; other factions visible from game start.
- 2-column layout: left = faction card + action list; right = sticky FactionIntelPanel (full variant)
- Pulls `lastActionId` from `overreachHistory` → passes to `scoreActions()` to derank repeat
- "Intel Pick" badge on index-0 action
- **Pass Turn fallback**: shown when ALL actions are unaffordable (PC=0) — submits `'pass'` action
- Director sees metrics summary + Strategic Theaters status + "Proceed to Action Phase" button

### `MShockScreen`
Breaking news — shows this turn's headlines + blinking "● Breaking" label.
- Staggered headline cards; border color = impact level (≥20 red, ≥10 orange, else gray)
- Footer: all factions with `abstractLambda` label via dot + label row
- LambdaHero sm top-right

### `PFearScreen`
Fear multiplier — λ hero center + 3 metric blocks + faction escalation bars.
- Metric blocks: Energy Pool, Panic Index, Oil Price (raw numbers OK here — world metrics)
- Escalation bars: width = `(f.lambda / 4) * 100%`; label from `abstractLambda(f.lambda)`
- Active cascade chips (red bordered)

### `GOverreachScreen`
Main action screen — player submits overreach action.
- Nash lock banner when `isCooperationLocked(gameState)`
- 2-column: left = actions; right = sticky FactionIntelPanel (full)
- `lastActionId` deranks repeat; dynamic count 3/4/5; "See all N options" toggle
- Director: per-faction ActionCard grids (`showRaw=true`) + DirectorPanel dropdowns + "Process Turn" button
- Uses `action.subGameTrigger` (not `action.subGame`)

### `ResolvingScreen`
Post-turn execution reveal — faction actions appear one by one then score deltas animate.
- Factions reveal at 1.1s intervals; each shows: dot, name, action taken, λ contribution
- After all revealed: MetricDelta blocks (λ, energy, panic with deltas), objective progress bars animating prevState→current, new cascade chips
- References `pools.energyPool` (not top-level `energyPool`)
- "View full analysis →" button calls `advanceToAnalysis()` → phase = 'analysis'

---

## Shared Components (`components/shared/`)

### `ActionCard`
```typescript
props: {
  action: Action;
  canAfford: boolean;
  isSelected: boolean;
  factionColor: string;
  onClick: () => void;
  index?: number;          // stagger delay
  subGameState?: string;   // equilibriumState — for decision matrix color
  showRaw?: boolean;       // false=player decision matrix | true=director raw numbers
}
```
- Player (`showRaw=false`): footer = `SubgameName · State | Impact | Consequence` (qualitative)
- Director (`showRaw=true`): footer = `{cost} PC | λ ±delta | Energy ±delta | SubgameName`

### `FactionIntelPanel`
```typescript
props: { variant: 'full' | 'compact'; isDirector?: boolean; }
```
- `variant="full"`: sub-game status panel (8 rows) + **combined "Intel — Standings" block** + submission counter
  - Combined standings: factions sorted by objectiveProgress desc; each row: rank + threat dot + name + stance + progress bar + **% number** + predictedType
  - Director variant: shows raw PC + λ per faction, last action taken, progress bar
- `variant="compact"`: inline flex row — dot + faction name + stance label
- Exports `FACTION_COLORS: Record<string, string>` — includes EUROPE + SE_ASIA (8 factions total)

### `GameHeader`
```typescript
props: { showLambda?: boolean }
```
Top bar: room ID + turn number. If `showLambda=true`, also shows global λ with color.

### `LambdaHero`
```typescript
props: { lambda: number; size: 'sm' | 'lg' }
```
Displays global λ value styled by threshold. `sm` for headers, `lg` for center-stage (PFearScreen).

### `PhaseBar`
Four-dot G→M→P→G step indicator. Reads current phase from store — no props needed.

---

## Top-Level Components

### `Dashboard`
Phase router only — `AnimatePresence mode="wait"` wrapping all phase screens + ResolvingScreen.
Reads `phase` from store. No other logic.

### `LoopAnalysis`
Post-turn full analysis screen. Shown when `phase === 'analysis'`.
- Hero quote (loopAnalysis string from server)
- λ delta stat boxes (prev/current/delta)
- New cascade badges
- 8 sub-game equilibrium panels
- Faction objective progress with per-faction deltas
- This-turn headlines
- Win/loss banner if `gameState.gameOver`: two buttons — **"Continue Observing"** (calls `continueObserving()`) + **"New Game"** (resets + returns to landing with faction re-select)
- Observing banner: shows when `observedWinner` is set but game is still running

### `App`
Three-screen router: landing → lobby → game.
- FACTIONS array includes all 8 (EUROPE + SE_ASIA added)
- `wantsLanding` effect: when true, navigates back to landing screen with faction cleared (allows re-select after reset)
- Pre-fills room code + player name from store on landing screen return

---

## Utils (`utils/stanceEngine.ts`)
Pure functions, no React, no store.

| Function | Returns | Key behavior |
|----------|---------|-------------|
| `scoreActions(actions, gameState, subGames, phase, lastActionId?)` | `Action[]` | Dynamic count 3/4/5 by λ; -10 penalty on lastActionId |
| `getConsequenceLabel(action)` | `{impact, impactColor, consequence}` | Qualitative from lambdaDelta buckets |
| `getSubGameName(key)` | `string` | iranWar → 'Iran War' etc. |
| `getSubGameStateLabel(equilibriumState)` | `{label, color}` | shifting→'In Play' orange, locked→red |
| `getFactionStance(factionId, gameState)` | `{stance, threat, threatColor, predictedType}` | Aggressive/Cooperative/Defensive/Dominant/Watching |
| `abstractResource(pc)` | `'Full'`/`'Limited'`/`'Depleted'` | ≥45/≥30/<30 |
| `abstractLambda(lambda)` | `{label, color}` | Stable/Rising/Critical/Extreme |

References `gameState.pools.energyPool` (not top-level).
Uses `action.subGameTrigger` and `action.lambdaDelta > 0.3` (not `action.cascadeTrigger`).

---

## Store (`store/game.ts`)
Key fields:
```typescript
gameState: GameState        // current state from engine
prevState: GameState | null // state before last turn (for deltas in ResolvingScreen)
playerFaction               // 'US' | 'IRAN' | ... | 'DIRECTOR' | null
phase                       // see Phase type in CLAUDE.md
pendingActionId             // set immediately on submitAction()
actionsProgress             // { submitted: number; total: number }
resolvedActions             // Record<FactionId, {actionId, actionName}> — what each faction did
subGames                    // SubGameResult[] from last turn:result
loopAnalysis                // string quote for LoopAnalysis screen
observedWinner              // FactionId | null — set when winner declared but game continues
wantsLanding                // boolean — triggers return to landing screen on next render
```
Key actions:
- `submitAction(id)` — submits player action (or 'pass')
- `submitDirectorActions(actions)` — director submits all factions at once
- `advanceToAnalysis()` — moves to analysis phase
- `forceTurn()` — force-processes turn
- `resetGame()` — resets state, sets `wantsLanding = true`
- `continueObserving()` — emits `game:continue` socket event; clears gameOver flag
- `clearWantsLanding()` — clears wantsLanding after navigation
- `skipToOverreach()` — director skips intel phases
