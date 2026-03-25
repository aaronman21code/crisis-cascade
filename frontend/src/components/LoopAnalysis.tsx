// frontend/src/components/LoopAnalysis.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/game';
import { GAME_THEORY_DATA, FactionId } from '@engine/gameTheoryData';

const FACTION_COLORS: Record<string, string> = {
  US: '#60a5fa', IRAN: '#4ade80', CHINA: '#f87171',
  BRICS: '#facc15', LEGACY: '#c084fc', CRYPTO: '#fb923c',
  EUROPE: '#34d399', SE_ASIA: '#f59e0b',
};

const WINNER_LABELS: Record<string, { title: string; desc: string; color: string }> = {
  US:          { title: 'US / ISRAEL WINS',       desc: 'Hormuz open. Petrodollar intact. Minimal war.',         color: '#60a5fa' },
  IRAN:        { title: 'IRAN WINS',               desc: 'Yuan settlement dominant. Blockade succeeded.',         color: '#4ade80' },
  CHINA:       { title: 'CHINA WINS',              desc: 'Factories running. Zero-sum race survived.',            color: '#f87171' },
  BRICS:       { title: 'BRICS WINS',              desc: 'Multipolar order established. Yuan dominant.',          color: '#facc15' },
  LEGACY:      { title: 'LEGACY FINANCE WINS',     desc: 'Petrodollar defended. Crypto contained.',              color: '#c084fc' },
  CRYPTO:      { title: 'CRYPTO WINS',             desc: 'Petrodollar era ended. Settlement layer captured.',     color: '#fb923c' },
  EUROPE:      { title: 'EUROPEBLOC VICTORY',       desc: 'EuropeBloc Victory — Managed Fracture',                color: '#34d399' },
  SE_ASIA:     { title: 'SE ASIA VICTORY',          desc: 'SE Asia Victory — Early Action Paid Off',              color: '#f59e0b' },
  DIRECTOR:    { title: 'STABILITY ACHIEVED',       desc: 'Global Director held the board.',                      color: '#ffffff' },
  GLOBAL_LOSS: { title: 'GLOBAL ENERGY LOCKDOWN',  desc: '3.2 billion under restrictions. Energy pool depleted.', color: '#f43f5e' },
};

export function LoopAnalysis() {
  const { gameState, prevState, loopAnalysis, subGames, playerFaction, resetGame, continueObserving, skipAnalysis, observedWinner } = useGameStore();
  const isDirector = playerFaction === 'DIRECTOR';

  const prevLambda  = prevState?.globalLambda ?? 1.0;
  const newLambda   = gameState.globalLambda;
  const lambdaDelta = newLambda - prevLambda;
  const { lockNash } = GAME_THEORY_DATA.lambdaThresholds;

  const winner     = gameState.winner;
  const winnerData = winner ? WINNER_LABELS[winner] : null;
  const isGameOver = !!gameState.gameOver;

  const lambdaColor = newLambda >= lockNash ? '#ef4444' : newLambda >= 2.0 ? '#f97316' : '#22c55e';
  const deltaColor  = lambdaDelta > 0 ? '#ef4444' : '#22c55e';

  const turnHeadlines = gameState.newsFeed
    .filter(n => n.turn === gameState.turn)
    .slice(0, 3);

  return (
    <div className="min-h-screen text-white p-6" style={{ backgroundColor: '#050f08' }}>
      <div className="max-w-lg mx-auto space-y-8">

        {/* Observing banner — persists across turns when in observe mode */}
        {observedWinner && !isGameOver && (
          <div className="text-[10px] font-mono text-center py-2 px-3 rounded border border-[#2a2a2a] text-gray-600">
            {WINNER_LABELS[observedWinner]?.title ?? observedWinner} · observing continued play
          </div>
        )}

        {/* Win banner */}
        <AnimatePresence>
          {winnerData && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="text-center py-6 rounded-xl border"
              style={{
                borderColor: `${winnerData.color}30`,
                backgroundColor: `${winnerData.color}08`,
              }}
            >
              <div className="text-3xl font-black mb-2" style={{ color: winnerData.color }}>
                {winnerData.title}
              </div>
              <div className="text-sm text-gray-400">{winnerData.desc}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero quote */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xl text-white leading-loose">
            {loopAnalysis ?? `Global tension rose — every uncoordinated move raises pressure for all players.`}
          </p>
          {isDirector && (
            <p className="text-sm font-mono mt-3" style={{ color: '#4b5563' }}>
              λ{' '}
              <span style={{ color: '#9ca3af' }}>{prevLambda.toFixed(2)}</span>
              {' → '}
              <span style={{ color: lambdaColor }}>{newLambda.toFixed(2)}</span>
              {'  Δ '}
              <span style={{ color: deltaColor }}>
                {lambdaDelta >= 0 ? '+' : ''}{lambdaDelta.toFixed(3)}
              </span>
            </p>
          )}
        </motion.div>

        {/* 3 headlines */}
        {turnHeadlines.length > 0 && (
          <div>
            <div className="text-xs text-gray-600 uppercase tracking-widest mb-3 border-b border-[#1a1a1a] pb-2">
              This Turn
            </div>
            <div className="space-y-3">
              {turnHeadlines.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12 }}
                  className="text-sm text-white leading-snug border-l-2 pl-3"
                  style={{
                    borderColor: item.impact >= 20 ? '#ef4444' : item.impact >= 10 ? '#f97316' : '#374151',
                    color:       item.impact >= 20 ? '#fca5a5' : item.impact >= 10 ? '#fdba74' : '#d1d5db',
                  }}
                >
                  {item.title}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div>
              <div className="space-y-6">

                {/* Tension stat boxes */}
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Tension Before" value={tensionLabel(prevLambda)}  color="#9ca3af" sub={isDirector ? `λ ${prevLambda.toFixed(2)}` : undefined} />
                  <StatBox label="Tension Now"    value={tensionLabel(newLambda)}   color={lambdaColor} sub={isDirector ? `λ ${newLambda.toFixed(2)}` : undefined} />
                  <StatBox label="Change"         value={lambdaDelta > 0.05 ? 'Rising' : lambdaDelta < -0.05 ? 'Easing' : 'Stable'} color={deltaColor} sub={isDirector ? `${lambdaDelta >= 0 ? '+' : ''}${lambdaDelta.toFixed(3)}` : undefined} />
                </div>

                {/* Active cascades */}
                {gameState.activeCascades.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-widest mb-2">Active Cascades</div>
                    <div className="flex flex-wrap gap-2">
                      {gameState.activeCascades.map(c => {
                        const isNew = !(prevState?.activeCascades ?? []).includes(c);
                        return (
                          <span
                            key={c}
                            className="text-xs font-mono px-2 py-1 rounded border"
                            style={{
                              borderColor: isNew ? '#ef4444' : '#374151',
                              color:       isNew ? '#fca5a5' : '#6b7280',
                              backgroundColor: isNew ? '#7f1d1d30' : 'transparent',
                            }}
                          >
                            {isNew ? '⚡ ' : ''}{c.replace(/_/g, ' ')}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-game states */}
                {subGames.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-widest mb-2">Sub-Game States</div>
                    <div className="space-y-3">
                      {subGames.map(sg => (
                        <div
                          key={sg.key}
                          className="border-l-2 pl-3"
                          style={{
                            borderColor:
                              sg.equilibriumState === 'locked'    ? '#ef4444' :
                              sg.equilibriumState === 'dominated' ? '#f97316' :
                              sg.equilibriumState === 'shifting'  ? '#eab308' : '#22c55e',
                          }}
                        >
                          <div className="text-xs font-semibold text-white mb-0.5">{sg.name}</div>
                          <div className="text-xs text-gray-400">{sg.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Faction objectives */}
                <div>
                  <div className="text-xs text-gray-600 uppercase tracking-widest mb-3">Faction Objectives</div>
                  <div className="space-y-2">
                    {Object.entries(gameState.factions).map(([id, f]) => {
                      const color = FACTION_COLORS[id] ?? '#888';
                      const isMe  = id === playerFaction;
                      const prev  = prevState?.factions[id as FactionId]?.objectiveProgress ?? 0;
                      const delta = f.objectiveProgress - prev;

                      if (isMe) {
                        return (
                          <div key={id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color }} className="font-semibold">{id} (you)</span>
                              <span style={{ color }}>
                                {f.objectiveProgress}%
                                {delta !== 0 && (
                                  <span className="ml-1" style={{ color: delta > 0 ? '#22c55e' : '#ef4444' }}>
                                    {delta > 0 ? '+' : ''}{delta}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: color }}
                                initial={{ width: `${prev}%` }}
                                animate={{ width: `${f.objectiveProgress}%` }}
                                transition={{ duration: 0.8 }}
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={id} className="flex items-center gap-3">
                          <span className="text-xs w-14 text-gray-500">{id}</span>
                          <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${f.objectiveProgress}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-xs font-mono text-gray-500 w-8 text-right">{f.objectiveProgress}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
        </div>

        {/* Bottom actions */}
        <div className="pt-2 border-t border-[#1a1a1a] flex gap-3 justify-end">
          {!isGameOver && (
            <button
              onClick={skipAnalysis}
              className="px-5 py-2 bg-red-700 hover:bg-red-600 rounded font-bold text-sm transition"
            >
              Continue
            </button>
          )}
          {isGameOver && (
            <button
              onClick={continueObserving}
              className="px-5 py-2 border border-[#2a2a2a] hover:border-gray-500 text-gray-400 hover:text-white rounded font-bold text-sm transition"
            >
              Continue Observing
            </button>
          )}
          <button
            onClick={() => { if (confirm('Reset simulation? All progress will be lost.')) resetGame(); }}
            className={
              isGameOver
                ? 'px-5 py-2 bg-red-700 hover:bg-red-600 rounded font-bold text-sm transition'
                : 'px-4 py-2 border border-[#333] hover:border-red-500 text-gray-500 hover:text-red-400 rounded text-xs transition'
            }
          >
            New Game
          </button>
        </div>

      </div>
    </div>
  );
}

function tensionLabel(lambda: number): string {
  if (lambda < 1.5) return 'Stable';
  if (lambda < 2.0) return 'Elevated';
  if (lambda < 2.5) return 'Critical';
  return 'Extreme';
}

function StatBox({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3 text-center">
      <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs font-mono text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}
