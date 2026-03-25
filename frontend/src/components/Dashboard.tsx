// frontend/src/components/Dashboard.tsx
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/game';
import { GDelayScreen }     from './phases/GDelayScreen';
import { MShockScreen }     from './phases/MShockScreen';
import { PFearScreen }      from './phases/PFearScreen';
import { GOverreachScreen } from './phases/GOverreachScreen';
import { ResolvingScreen }  from './phases/ResolvingScreen';

export function Dashboard() {
  const { phase } = useGameStore();

  return (
    <AnimatePresence mode="wait">
      {phase === 'g_delay'     && <GDelayScreen     key="g_delay" />}
      {phase === 'm_shock'     && <MShockScreen     key="m_shock" />}
      {phase === 'p_fear'      && <PFearScreen      key="p_fear" />}
      {phase === 'g_overreach' && <GOverreachScreen key="g_overreach" />}
      {phase === 'resolving'   && <ResolvingScreen  key="resolving" />}
    </AnimatePresence>
  );
}

export function MetricCard({ label, value, valueColor, children }: {
  label: string; value: string; valueColor: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-[#1a1a2a] rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500 uppercase">{label}</span>
        <span className="text-lg font-bold font-mono" style={{ color: valueColor }}>{value}</span>
      </div>
      {children}
    </div>
  );
}

export function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

import React from 'react';
