// frontend/src/components/shared/ActionCard.tsx
import { motion } from 'framer-motion';
import { Action } from '@engine/factionActions';
import { getConsequenceLabel, getSubGameName, getSubGameStateLabel } from '../../utils/stanceEngine';

interface Props {
  action: Action;
  canAfford: boolean;
  isSelected: boolean;
  factionColor: string;
  onClick: () => void;
  index?: number;
  subGameState?: string;  // equilibriumState from live subGames
  showRaw?: boolean;       // Director mode — show cost/λ/energy numbers
}

export function ActionCard({
  action, canAfford, isSelected, factionColor, onClick,
  index = 0, subGameState, showRaw = false,
}: Props) {
  const { impact, impactColor, consequence } = getConsequenceLabel(action);
  const subGameLabel = getSubGameStateLabel(subGameState ?? '');

  return (
    <motion.button
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: canAfford ? 1 : 0.4, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      whileTap={canAfford ? { scale: 0.98 } : {}}
      disabled={!canAfford}
      onClick={onClick}
      className="w-full text-left rounded-xl border p-5 transition-colors"
      style={{
        backgroundColor: isSelected ? `${factionColor}15` : '#0d0d12',
        borderColor: isSelected ? factionColor : canAfford ? '#2a2a3a' : '#1a1a1a',
        cursor: canAfford ? 'pointer' : 'not-allowed',
        boxShadow: isSelected ? `0 0 0 1px ${factionColor}40` : 'none',
      }}
      onMouseEnter={e => {
        if (canAfford && !isSelected)
          (e.currentTarget as HTMLElement).style.borderColor = `${factionColor}60`;
      }}
      onMouseLeave={e => {
        if (!isSelected)
          (e.currentTarget as HTMLElement).style.borderColor = canAfford ? '#2a2a3a' : '#1a1a1a';
      }}
    >
      <div className="font-bold text-base text-white mb-2">{action.name}</div>
      <div className="text-sm text-gray-300 leading-relaxed mb-3">{action.flavorText}</div>

      {showRaw ? (
        /* Director mode: raw numbers */
        <div className="flex items-center gap-4 text-xs font-mono text-gray-500 border-t border-[#1a1a1a] pt-3">
          <span>{action.cost} PC</span>
          <span style={{ color: action.lambdaDelta > 0 ? '#ef4444' : '#22c55e' }}>
            λ {action.lambdaDelta >= 0 ? '+' : ''}{action.lambdaDelta.toFixed(2)}
          </span>
          {action.energyDelta !== undefined && action.energyDelta !== 0 && (
            <span style={{ color: action.energyDelta > 0 ? '#22c55e' : '#ef4444' }}>
              Energy {action.energyDelta > 0 ? '+' : ''}{action.energyDelta}
            </span>
          )}
          <span className="text-gray-700">{getSubGameName(action.subGameTrigger)}</span>
        </div>
      ) : (
        /* Player mode: decision matrix */
        <div className="flex items-center gap-3 text-[10px] font-mono border-t border-[#1a1a1a] pt-2 flex-wrap">
          <span style={{ color: subGameState ? subGameLabel.color : '#4b5563' }}>
            {getSubGameName(action.subGameTrigger)}{subGameState ? ` · ${subGameLabel.label}` : ''}
          </span>
          <span style={{ color: impactColor }}>{impact}</span>
          {consequence && (
            <span className="text-gray-600">{consequence}</span>
          )}
        </div>
      )}
    </motion.button>
  );
}
