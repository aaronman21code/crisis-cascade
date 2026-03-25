// src/backend/server.ts
// Node.js + Express + Socket.io
// Calls processTurn() from the sacred engine. AI bots fill uncontrolled factions.

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Engine imports (shared — adjust paths if monorepo symlink differs)
import { processTurn, INITIAL_STATE, GameState, Faction } from '../../src/engine/logicEngine';
import { generateHeadlines, getLoopAnalysisQuote } from '../../src/engine/newsGenerator';
import { getBiggestLambdaContributor } from '../../src/engine/payoffEngine';
import { FACTION_ACTIONS, getAvailableActions } from '../../src/engine/factionActions';
import { FactionId } from '../../src/engine/gameTheoryData';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.json());

// ── In-memory room store ──────────────────────────────────────────────
interface Player {
  socketId: string;
  factionId: FactionId | 'DIRECTOR';
  name: string;
}

interface Room {
  id: string;
  state: GameState;
  prevState: GameState;
  players: Player[];
  pendingActions: Partial<Record<FactionId, { actionId: string; delayAction?: string }>>;
  actionsSubmitted: Set<string>; // socketIds that submitted
  phase: 'lobby' | 'g_delay' | 'm_shock' | 'p_fear' | 'g_overreach' | 'analysis';
  turnTimer: ReturnType<typeof setTimeout> | null;
  loopAnalysis: string | null;
  acknowledgedWinners: Set<string>; // winners already seen — suppress repeat declarations
}

const rooms = new Map<string, Room>();

function createRoom(id: string): Room {
  return {
    id,
    state: { ...INITIAL_STATE },
    prevState: { ...INITIAL_STATE },
    players: [],
    pendingActions: {},
    actionsSubmitted: new Set(),
    phase: 'lobby',
    turnTimer: null,
    loopAnalysis: null,
    acknowledgedWinners: new Set(),
  };
}

const FACTION_IDS: FactionId[] = ['US', 'IRAN', 'CHINA', 'BRICS', 'LEGACY', 'CRYPTO', 'EUROPE', 'SE_ASIA'];

// ── AI Bot logic ──────────────────────────────────────────────────────
function botPickAction(factionId: FactionId, state: GameState): { actionId: string } {
  const available = getAvailableActions(factionId, state.overreachHistory, state.turn)
    .filter(a => a.id !== 'wait_and_watch');

  const affordable = available.filter(a => a.cost <= state.factions[factionId].politicalCapital);
  const pool = affordable.length > 0 ? affordable : available;

  const scored = pool.map(a => ({
    actionId: a.id,
    score: a.shockValue * 0.5 + (a.energyDelta ?? 0) * 0.3,
  })).sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score < 3.0) {
    return { actionId: 'wait_and_watch' };
  }
  return { actionId: scored[0].actionId };
}

function fillBotsAndProcess(room: Room): void {
  const controlledFactions = new Set(
    room.players
      .filter(p => p.factionId !== 'DIRECTOR')
      .map(p => p.factionId as FactionId)
  );

  // Director controls all
  const isDirectorMode = room.players.some(p => p.factionId === 'DIRECTOR');

  FACTION_IDS.forEach(fId => {
    if (!room.pendingActions[fId]) {
      if (!controlledFactions.has(fId) || isDirectorMode) {
        // Bot fill
        room.pendingActions[fId] = botPickAction(fId, room.state);
      }
    }
  });

  const prevLambda = room.state.globalLambda;
  console.log(`[turn] room=${room.id} turn=${room.state.turn} λ=${room.state.globalLambda.toFixed(2)} energy=${room.state.pools.energyPool}`);
  room.prevState = { ...room.state, pools: { ...room.state.pools }, factions: { ...room.state.factions } };

  try {
    room.state = processTurn(room.state, room.pendingActions);
  } catch (e) {
    console.error('[processTurn error]', e);
    return;
  }

  // Post-processing — wrapped so any helper failure still emits turn:result
  let resolvedActions: Record<string, { actionId: string; actionName: string }> = {};
  try {
    // Generate headlines for this turn
    const headlines = generateHeadlines(room.state, room.prevState);
    room.state.newsFeed = [
      ...headlines,
      ...room.state.newsFeed,
    ].slice(0, 30); // cap at 30 items

    // Build LoopAnalysis quote
    const biggestAction = getBiggestLambdaContributor(
      room.pendingActions,
      prevLambda,
      room.state.globalLambda
    );
    if (biggestAction) {
      const actions = FACTION_ACTIONS[biggestAction.factionId];
      const action = actions?.find(a => a.id === biggestAction.actionId);
      room.loopAnalysis = getLoopAnalysisQuote(
        prevLambda,
        room.state.globalLambda,
        action?.name ?? biggestAction.actionId,
        room.state.activeCascades
      );
    }

    // Capture what each faction did before resetting
    Object.entries(room.pendingActions).forEach(([fId, action]) => {
      if (action?.actionId) {
        const factionActions = FACTION_ACTIONS[fId as FactionId];
        const actionData = factionActions?.find(a => a.id === action.actionId);
        resolvedActions[fId] = {
          actionId: action.actionId,
          actionName: actionData?.name ?? action.actionId,
        };
      }
    });
  } catch (e) {
    console.error('[post-processTurn error]', e);
  }

  // If this winner was already acknowledged (observe mode), keep running
  if (room.state.gameOver && room.state.winner && room.acknowledgedWinners.has(room.state.winner)) {
    room.state.gameOver = false;
  }

  // Reset for next turn
  room.pendingActions = {};
  room.actionsSubmitted = new Set();
  room.phase = 'analysis';

  io.to(room.id).emit('turn:result', {
    state: room.state,
    prevState: room.prevState,
    loopAnalysis: room.loopAnalysis,
    subGames: evaluateAllSubGamesForEmit(room.state),
    resolvedActions,
  });

  if (!room.state.gameOver) {
    // Auto-advance to next turn after analysis window
    room.turnTimer = setTimeout(() => {
      room.phase = 'g_delay';
      io.to(room.id).emit('phase:change', { phase: 'g_delay', turn: room.state.turn + 1 });
    }, 22000);
  } else {
    io.to(room.id).emit('game:over', { winner: room.state.winner, state: room.state });
  }
}

function evaluateAllSubGamesForEmit(state: GameState) {
  try {
    const { evaluateAllSubGames } = require('../../src/engine/payoffEngine');
    return evaluateAllSubGames(state);
  } catch (e) {
    console.error('[evaluateAllSubGames error]', e);
    return [];
  }
}

// ── Socket.io event handlers ──────────────────────────────────────────
io.on('connection', (socket: Socket) => {
  console.log(`[connect] ${socket.id}`);

  // Create or join a room
  socket.on('room:join', ({ roomId, playerName, factionId }: {
    roomId: string;
    playerName: string;
    factionId: FactionId | 'DIRECTOR';
  }) => {
    let room = rooms.get(roomId);
    if (!room) {
      room = createRoom(roomId);
      rooms.set(roomId, room);
    }

    // Check if faction already taken
    const taken = room.players.some(p => p.factionId === factionId);
    if (taken && factionId !== 'DIRECTOR') {
      socket.emit('room:error', { message: `Faction ${factionId} is already taken.` });
      return;
    }

    room.players.push({ socketId: socket.id, factionId, name: playerName });
    socket.join(roomId);
    (socket as any).roomId = roomId;
    (socket as any).factionId = factionId;

    // Restore PC for human player taking over a faction mid-game (bots may have depleted it)
    if (factionId !== 'DIRECTOR' && room.state.factions[factionId as FactionId]) {
      const STARTING_PC: Record<FactionId, number> = {
        US: 50, IRAN: 45, CHINA: 55, BRICS: 40, LEGACY: 60, CRYPTO: 35, EUROPE: 48, SE_ASIA: 38,
      };
      room.state = {
        ...room.state,
        factions: {
          ...room.state.factions,
          [factionId]: {
            ...room.state.factions[factionId as FactionId],
            politicalCapital: STARTING_PC[factionId as FactionId],
          },
        },
      };
    }

    socket.emit('room:joined', { roomId, factionId, state: room.state });
    io.to(roomId).emit('room:update', { players: room.players });
    console.log(`[join] ${playerName} as ${factionId} in room ${roomId}`);
  });

  // Start game
  socket.on('game:start', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.phase = 'g_delay';
    io.to(roomId).emit('game:started', { state: room.state });
    io.to(roomId).emit('phase:change', { phase: 'g_delay', turn: 1 });
  });

  // Player submits their action for this turn
  socket.on('action:submit', ({ actionId, delayAction }: { actionId: string; delayAction?: string }) => {
    const roomId = (socket as any).roomId;
    const factionId = (socket as any).factionId as FactionId | 'DIRECTOR';
    const room = rooms.get(roomId);
    if (!room || room.state.gameOver) return;

    if (factionId === 'DIRECTOR') {
      // Director submitted all actions at once
      socket.emit('action:ack', { factionId });
      return;
    }

    room.pendingActions[factionId] = { actionId, delayAction };
    room.actionsSubmitted.add(socket.id);

    const humanPlayers = room.players.filter(p => p.factionId !== 'DIRECTOR');
    io.to(roomId).emit('action:progress', {
      submitted: room.actionsSubmitted.size,
      total: humanPlayers.length,
    });

    // If all human players submitted, process immediately
    if (room.actionsSubmitted.size >= humanPlayers.length) {
      if (room.turnTimer) clearTimeout(room.turnTimer);
      fillBotsAndProcess(room);
    }
  });

  // Director mode: submit all faction actions at once
  socket.on('director:submit', (actions: Partial<Record<FactionId, { actionId: string }>>) => {
    const roomId = (socket as any).roomId;
    const room = rooms.get(roomId);
    if (!room || room.state.gameOver) return;
    room.pendingActions = actions;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    fillBotsAndProcess(room);
  });

  // Reset game — wipe state back to INITIAL_STATE, keep players in room
  socket.on('game:reset', () => {
    const roomId = (socket as any).roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.state = { ...INITIAL_STATE };
    room.prevState = { ...INITIAL_STATE };
    room.pendingActions = {};
    room.actionsSubmitted = new Set();
    room.phase = 'lobby';
    room.loopAnalysis = null;
    room.acknowledgedWinners = new Set();
    io.to(roomId).emit('game:reset', { state: room.state });
    console.log(`[reset] room ${roomId}`);
  });

  // Continue observing after a win state
  socket.on('game:continue', () => {
    const roomId = (socket as any).roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.state.winner) room.acknowledgedWinners.add(room.state.winner);
    room.state.gameOver = false;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
      room.phase = 'g_delay';
      io.to(roomId).emit('phase:change', { phase: 'g_delay', turn: room.state.turn + 1 });
    }, 2000);
  });

  // Director: skip intel phases and jump straight to g_overreach
  socket.on('phase:skip', () => {
    const roomId = (socket as any).roomId;
    const factionId = (socket as any).factionId;
    const room = rooms.get(roomId);
    if (!room || factionId !== 'DIRECTOR') return;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.phase = 'g_overreach';
    io.to(roomId).emit('phase:change', { phase: 'g_overreach', turn: room.state.turn });
  });

  // Skip analysis window — advance to next turn immediately
  socket.on('analysis:next', () => {
    const roomId = (socket as any).roomId;
    const room = rooms.get(roomId);
    if (!room || room.state.gameOver) return;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.phase = 'g_delay';
    io.to(roomId).emit('phase:change', { phase: 'g_delay', turn: room.state.turn + 1 });
  });

  // Force advance turn (timeout)
  socket.on('turn:force', () => {
    const roomId = (socket as any).roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    fillBotsAndProcess(room);
  });

  socket.on('disconnect', () => {
    const roomId = (socket as any).roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.socketId !== socket.id);
    io.to(roomId).emit('room:update', { players: room.players });
    console.log(`[disconnect] ${socket.id} left room ${roomId}`);
  });
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Crisis Cascade server running on :${PORT}`);
});
