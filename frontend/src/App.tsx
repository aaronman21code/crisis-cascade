// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store/game';
import { Dashboard } from './components/Dashboard';
import { LoopAnalysis } from './components/LoopAnalysis';
import { FactionId } from '@engine/gameTheoryData';
import { audioEngine } from './utils/audioEngine';

const FACTIONS: Array<{ id: FactionId | 'DIRECTOR'; label: string; desc: string; warCry: string; color: string; textColor: string }> = [
  { id: 'US',       label: 'US / Israel Bloc',  desc: 'Reopen Hormuz. Preserve petrodollar. No full war.',          warCry: 'Hold the strait. No war. No surrender.',        color: 'border-blue-500',   textColor: '#60a5fa' },
  { id: 'IRAN',     label: 'Iran',              desc: 'Force yuan settlement. Survive strikes. Max domestic support.', warCry: 'Let the dollar burn. Hormuz is ours.',           color: 'border-green-500',  textColor: '#4ade80' },
  { id: 'CHINA',    label: 'China',             desc: 'Keep factories running. Redirect robotics to energy triage.', warCry: 'Keep the factories. Survive anything.',          color: 'border-red-500',    textColor: '#f87171' },
  { id: 'BRICS',    label: 'BRICS Coalition',   desc: 'Activate yuan oil clearing. Pull Saudi + India in.',          warCry: 'The old order ends this turn.',                  color: 'border-yellow-500', textColor: '#facc15' },
  { id: 'LEGACY',   label: 'Legacy Finance',    desc: 'Delay dedollarization. Defend SWIFT. Capital controls.',      warCry: 'SWIFT will outlast this crisis.',                color: 'border-purple-500', textColor: '#c084fc' },
  { id: 'CRYPTO',   label: 'Crypto Ecosystem',  desc: 'Capture >40% of oil settlement. Become the neutral layer.',  warCry: 'Every freeze is our advertisement.',            color: 'border-orange-500', textColor: '#fb923c' },
  { id: 'EUROPE',   label: 'EuropeBloc',          desc: 'Contain the fracture. Preserve institutional order.',       warCry: 'Managed Fracture, Not Collapse',    color: 'border-emerald-400', textColor: '#34d399' },
  { id: 'SE_ASIA',  label: 'SE Asia Coalition',   desc: 'Move first on new settlement rails. Lock in trade routes.',  warCry: 'First Movers Set the Rules',         color: 'border-amber-400',   textColor: '#f59e0b' },
  { id: 'DIRECTOR', label: 'Global Director',     desc: 'God mode. Control all factions. Maximize global stability.', warCry: 'You move all pieces. Stabilize the board.',     color: 'border-gray-400',   textColor: '#ffffff' },
];

function generateRoomCode() {
  return Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join('');
}

export default function App() {
  const { connect, joinRoom, startGame, phase, players, roomId, playerName: storedName, connected, wantsLanding, clearWantsLanding } = useGameStore();
  const [screen, setScreen] = useState<'landing' | 'lobby' | 'game'>('landing');
  const [inputRoom, setInputRoom] = useState('');
  const [inputName, setInputName] = useState('');
  const [selectedFaction, setSelectedFaction] = useState<FactionId | 'DIRECTOR' | null>(null);

  useEffect(() => {
    connect(import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001');
  }, []);

  useEffect(() => {
    if (phase !== 'lobby' && screen === 'lobby') setScreen('game');
    if (phase === 'lobby' && screen === 'game') setScreen('lobby');
  }, [phase]);

  // After resetGame(), go back to landing so faction can be re-selected
  useEffect(() => {
    if (wantsLanding) {
      setScreen('landing');
      setSelectedFaction(null);
      // Pre-fill room and name from store so they don't need to retype
      if (roomId) setInputRoom(roomId);
      if (storedName && storedName !== 'Player') setInputName(storedName);
      clearWantsLanding();
    }
  }, [wantsLanding]);

  function handleJoin() {
    if (!selectedFaction || !inputRoom || !inputName) return;
    audioEngine.init();
    joinRoom(inputRoom.toUpperCase(), selectedFaction, inputName);
    setScreen('lobby');
  }

  // ── Landing ──
  if (screen === 'landing') {
    // Derive current step from existing state — no extra state needed
    const step = !inputName ? 1 : !inputRoom ? 2 : !selectedFaction ? 3 : 4;

    const glow = (color: string) => ({
      borderColor: color,
      boxShadow: `0 0 0 1px ${color}40, 0 0 16px 0 ${color}18`,
    });

    const nameGlow  = step === 1 ? glow('#3b82f6') : {};
    const roomGlow  = step === 2 ? glow('#3b82f6') : {};
    const factionActive = step >= 3;

    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="mb-2 text-xs tracking-widest text-red-400 uppercase">Crisis Cascade</div>
          <h1 className="text-4xl font-bold mb-2 text-white">Hormuz 2026</h1>
          <p className="text-gray-400 mb-8 text-lg">Play the end of the petrodollar — or direct it.</p>

          {/* Step 1 — Name */}
          <div className="mb-6 transition-opacity duration-500" style={{ opacity: 1 }}>
            <label className={`block text-xs uppercase mb-1 transition-colors duration-300 ${step === 1 ? 'text-blue-400' : 'text-gray-500'}`}>
              {step === 1 && <span className="mr-1.5 text-blue-500">①</span>}Your Name
            </label>
            <input
              className="w-full bg-[#111] border rounded px-3 py-2 text-white focus:outline-none transition-all duration-300"
              style={nameGlow}
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              placeholder="Commander..."
              autoFocus
            />
          </div>

          {/* Step 2 — Room Code */}
          <div
            className="mb-6 transition-all duration-500"
            style={{ opacity: step >= 2 ? 1 : 0.35 }}
          >
            <label className={`block text-xs uppercase mb-1 transition-colors duration-300 ${step === 2 ? 'text-blue-400' : 'text-gray-500'}`}>
              {step === 2 && <span className="mr-1.5 text-blue-500">②</span>}Room Code
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-[#111] border rounded px-3 py-2 text-white uppercase focus:outline-none transition-all duration-300"
                style={roomGlow}
                value={inputRoom}
                onChange={e => setInputRoom(e.target.value.toUpperCase())}
                placeholder="HORMUZ"
                disabled={step < 2}
              />
              <button
                type="button"
                onClick={() => setInputRoom(generateRoomCode())}
                disabled={step < 2}
                className="px-3 py-2 border border-[#333] hover:border-gray-500 text-gray-500 hover:text-white rounded text-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate
              </button>
            </div>
          </div>

          {/* Step 3 — Faction */}
          <div
            className="mb-8 transition-all duration-500"
            style={{ opacity: factionActive ? 1 : 0.25 }}
          >
            <label className={`block text-xs uppercase mb-3 transition-colors duration-300 ${step === 3 ? 'text-blue-400' : 'text-gray-500'}`}>
              {step === 3 && <span className="mr-1.5 text-blue-500">③</span>}Choose Faction
            </label>
            <div className="grid grid-cols-1 gap-2">
              {FACTIONS.map(f => {
                const isSelected = selectedFaction === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => factionActive && setSelectedFaction(f.id)}
                    disabled={!factionActive}
                    className={`text-left p-3 rounded border transition-all duration-200 ${
                      isSelected ? 'bg-white/5' : factionActive ? 'bg-transparent hover:bg-white/[0.04]' : 'bg-transparent'
                    }`}
                    style={{
                      borderColor: isSelected ? f.textColor : factionActive ? '#2a2a3a' : '#1a1a1a',
                      boxShadow: isSelected ? `0 0 0 1px ${f.textColor}30, 0 0 12px 0 ${f.textColor}14` : 'none',
                      cursor: factionActive ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <div className="font-semibold text-sm transition-colors duration-200" style={{ color: isSelected ? f.textColor : factionActive ? '#e5e7eb' : '#6b7280' }}>
                      {f.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
                    {isSelected && (
                      <div className="text-xs italic mt-1" style={{ color: f.textColor }}>{f.warCry}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleJoin}
            disabled={step < 4 || !connected}
            className="w-full py-3 rounded font-bold text-sm transition-all duration-500"
            style={{
              background: step === 4 ? '#dc2626' : '#1a1a1a',
              color: step === 4 ? '#fff' : '#4b5563',
              boxShadow: step === 4 ? '0 0 24px 0 #dc262640' : 'none',
              cursor: step === 4 && connected ? 'pointer' : 'not-allowed',
            }}
          >
            {connected ? 'Enter the Simulation' : 'Connecting...'}
          </button>

          <p className="text-center mt-5 text-xs text-gray-600">
            New here?{' '}
            <a
              href="https://crisis-cascade.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white underline transition"
            >
              Read about the simulation →
            </a>
          </p>
          <p className="text-center mt-3 text-[10px] text-gray-700 leading-relaxed max-w-sm mx-auto">
            Educational simulation. Models real geopolitical mechanisms through game theory to visualize how cascading crises unfold — not a forecast or political statement.
          </p>
        </div>
      </div>
    );
  }

  // ── Lobby ──
  if (screen === 'lobby') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Room: {roomId}</div>
          <h2 className="text-2xl font-bold mb-6">Waiting for players</h2>
          <div className="space-y-2 mb-8">
            {players.map(p => (
              <div key={p.socketId} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                <span className="text-white">{p.name}</span>
                <span className="text-gray-400">— {p.factionId}</span>
              </div>
            ))}
          </div>
          <button
            onClick={startGame}
            className="w-full py-3 bg-red-600 hover:bg-red-500 rounded font-bold text-sm transition"
          >
            Start Simulation
          </button>
        </div>
      </div>
    );
  }

  // ── Game ──
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {phase === 'analysis' ? (
            <LoopAnalysis key="analysis" />
          ) : (
            <Dashboard key="game" />
          )}
        </AnimatePresence>
      </div>
      <div className="text-center py-2 border-t border-[#1a1a1a]">
        <a
          href="https://crisis-cascade.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-gray-700 hover:text-gray-400 transition tracking-wide"
        >
          crisis-cascade.vercel.app — read more →
        </a>
      </div>
    </div>
  );
}
