// frontend/src/store/game.ts
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, INITIAL_STATE } from '@engine/logicEngine';
import { FactionId } from '@engine/gameTheoryData';

type Phase = 'lobby' | 'g_delay' | 'm_shock' | 'p_fear' | 'g_overreach' | 'resolving' | 'analysis';

interface SubGameResult {
  key: string;
  name: string;
  equilibriumState: string;
  dominantStrategy: string;
  description: string;
}

interface GameStore {
  // Connection
  socket: Socket | null;
  roomId: string | null;
  connected: boolean;

  // Game
  gameState: GameState;
  prevState: GameState | null;
  playerFaction: FactionId | 'DIRECTOR' | null;
  playerName: string;
  phase: Phase;
  players: Array<{ socketId: string; factionId: string; name: string }>;

  // Turn state
  pendingActionId: string | null;
  actionsProgress: { submitted: number; total: number };
  loopAnalysis: string | null;
  subGames: SubGameResult[];
  resolvedActions: Record<string, { actionId: string; actionName: string }>;
  observedWinner: string | null;
  wantsLanding: boolean;

  // Actions
  connect: (serverUrl: string) => void;
  advanceToAnalysis: () => void;
  skipAnalysis: () => void;
  skipToOverreach: () => void;
  continueObserving: () => void;
  clearWantsLanding: () => void;
  joinRoom: (roomId: string, factionId: FactionId | 'DIRECTOR', playerName: string) => void;
  startGame: () => void;
  submitAction: (actionId: string, delayAction?: string) => void;
  submitDirectorActions: (actions: Partial<Record<FactionId, { actionId: string }>>) => void;
  forceTurn: () => void;
  resetGame: () => void;
  setPendingAction: (actionId: string | null) => void;
  setPlayerName: (name: string) => void;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  roomId: null,
  connected: false,
  gameState: { ...INITIAL_STATE },
  prevState: null,
  playerFaction: null,
  playerName: 'Player',
  phase: 'lobby',
  players: [],
  pendingActionId: null,
  actionsProgress: { submitted: 0, total: 0 },
  loopAnalysis: null,
  subGames: [],
  resolvedActions: {},
  observedWinner: null,
  wantsLanding: false,

  connect: (serverUrl: string) => {
    if (get().socket?.connected) return;
    const socket = io(serverUrl ?? SOCKET_URL);

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));

    socket.on('room:joined', ({ factionId, state }: { factionId: FactionId | 'DIRECTOR'; state: GameState }) => {
      set({ playerFaction: factionId, gameState: state, phase: 'lobby' });
    });

    socket.on('room:update', ({ players }: { players: GameStore['players'] }) => {
      set({ players });
    });

    socket.on('room:error', ({ message }: { message: string }) => {
      alert(message);
    });

    socket.on('game:started', ({ state }: { state: GameState }) => {
      set({ gameState: state, phase: 'g_delay' });
    });

    socket.on('phase:change', ({ phase }: { phase: Phase }) => {
      // Don't auto-advance away from analysis — user must click Continue
      if (get().phase === 'analysis') return;
      set({ phase });
    });

    socket.on('action:progress', (progress: { submitted: number; total: number }) => {
      set({ actionsProgress: progress });
    });

    socket.on('turn:result', ({
      state,
      prevState,
      loopAnalysis,
      subGames,
      resolvedActions,
    }: {
      state: GameState;
      prevState: GameState;
      loopAnalysis: string;
      subGames: SubGameResult[];
      resolvedActions: Record<string, { actionId: string; actionName: string }>;
    }) => {
      set({
        gameState: state,
        prevState,
        loopAnalysis,
        subGames,
        resolvedActions: resolvedActions ?? {},
        phase: 'resolving',
        pendingActionId: null,
        actionsProgress: { submitted: 0, total: 0 },
      });
    });

    socket.on('game:over', ({ winner, state }: { winner: string; state: GameState }) => {
      set({ gameState: state, phase: 'analysis', observedWinner: null });
    });

    socket.on('game:reset', ({ state }: { state: GameState }) => {
      set({
        gameState: state,
        prevState: null,
        phase: 'lobby',
        pendingActionId: null,
        loopAnalysis: null,
        subGames: [],
        resolvedActions: {},
        observedWinner: null,
        actionsProgress: { submitted: 0, total: 0 },
      });
    });

    set({ socket });
  },

  joinRoom: (roomId, factionId, playerName) => {
    get().socket?.emit('room:join', { roomId, factionId, playerName });
    set({ roomId, playerName });
  },

  startGame: () => {
    const { socket, roomId } = get();
    socket?.emit('game:start', { roomId });
  },

  submitAction: (actionId, delayAction) => {
    get().socket?.emit('action:submit', { actionId, delayAction });
    set({ pendingActionId: actionId });
  },

  submitDirectorActions: (actions) => {
    get().socket?.emit('director:submit', actions);
  },

  forceTurn: () => {
    get().socket?.emit('turn:force');
  },

  resetGame: () => {
    get().socket?.emit('game:reset');
    set({ wantsLanding: true });
  },

  advanceToAnalysis: () => set({ phase: 'analysis' }),
  skipAnalysis: () => get().socket?.emit('analysis:next'),
  skipToOverreach: () => get().socket?.emit('phase:skip'),
  continueObserving: () => {
    const winner = get().gameState.winner;
    get().socket?.emit('game:continue');
    set({ observedWinner: winner });
  },
  clearWantsLanding: () => set({ wantsLanding: false }),
  setPendingAction: (actionId) => set({ pendingActionId: actionId }),
  setPlayerName: (name) => set({ playerName: name }),
}));
