import { motion } from 'framer-motion';

const PHASES = [
  { key: 'g_delay',     label: 'G·DELAY' },
  { key: 'm_shock',     label: 'M·SHOCK' },
  { key: 'p_fear',      label: 'P·FEAR'  },
  { key: 'g_overreach', label: 'G·OVER'  },
];

const PHASE_ORDER = PHASES.map(p => p.key);

interface Props {
  current: string;
  factionColor?: string;
}

export function PhaseBar({ current, factionColor = '#60a5fa' }: Props) {
  const currentIdx = PHASE_ORDER.indexOf(current);

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const isActive = phase.key === current;
        const isPast   = i < currentIdx;

        return (
          <motion.div
            key={phase.key}
            layout
            className="px-2 py-0.5 rounded text-xs font-mono tracking-wider transition-colors"
            style={{
              backgroundColor: isActive ? 'white' : isPast ? `${factionColor}30` : '#1a1a1a',
              color: isActive ? '#0a0a0f' : isPast ? factionColor : '#4b5563',
              fontWeight: isActive ? 700 : 400,
            }}
          >
            {phase.label}
          </motion.div>
        );
      })}
    </div>
  );
}
