# Crisis Cascade: Hormuz 2026

A browser-based game-theoretic simulation of the Strait of Hormuz energy crisis. Eight factions. One board. Every move changes the math for everyone else.

**Play it:** [crisis-cascade-frontend.vercel.app](https://crisis-cascade-frontend.vercel.app/)

---

## What It Is

Crisis Cascade models a geopolitical crisis through the lens of game theory — Nash equilibria, Prisoner's Dilemmas, Stag Hunts, and cascade dynamics running simultaneously across eight interlocking strategic games.

Players choose a faction and make decisions each turn across four phases of the G-M-P-G Loop:

1. **Government Delay** — hidden intel moves, factions position before the shock lands
2. **Media Shock** — fear amplifies, headlines drive the narrative
3. **Public Fear** — panic index rises, oil prices spike
4. **Government Overreach** — factions act, every move raises tension for all players

After each turn, a Loop Analysis screen breaks down what happened, which cascades fired, and where the system is heading.

---

## Factions

| Faction | Objective |
|---|---|
| US / Israel | Keep Hormuz open. Defend the petrodollar. |
| Iran | Force yuan dominance. Survive the blockade. |
| China | Factories running. Chips secured. |
| BRICS | Build the parallel monetary order. |
| Legacy Finance | Defend SWIFT and petrodollar infrastructure. |
| Crypto | Capture the global settlement layer. |
| EuropeBloc | Managed fracture. Avoid war. |
| SE Asia | Hedge everything. Stay liquid. |

**Director Mode** — control all eight factions simultaneously. Run what-if scenarios. Test whether coordinated calm can interrupt the loop.

---

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + Socket.io (real-time multiplayer via room codes)
- **State:** Zustand (client) + in-memory room map (server)
- **Hosting:** Vercel (frontend) + Railway (backend)
- **Engine:** Pure TypeScript — no external game framework

---

## Project Structure

```
crisis-cascade/
├── src/engine/          ← Game logic (pure TS, shared by frontend + backend)
│   ├── logicEngine.ts   ← GameState, processTurn()
│   ├── factionActions.ts
│   ├── cascades.ts
│   ├── payoffEngine.ts
│   ├── winConditions.ts
│   └── newsGenerator.ts
├── backend/             ← Socket.io server
│   └── src/server.ts
├── frontend/            ← React app
│   └── src/
├── landing.html         ← Standalone landing page
└── Dockerfile           ← Monorepo build for Railway
```

---

## Running Locally

```bash
# Backend (port 3001)
cd backend && npm install && npm run dev

# Frontend (port 5173) — must run from frontend/
cd frontend && npm install && npm run dev
```

Set `VITE_SOCKET_URL=http://localhost:3001` in `frontend/.env` if needed.

---

## Multiplayer

Share a room code with up to 8 players — each takes a different faction. The server resolves all actions simultaneously at the end of each turn phase.
