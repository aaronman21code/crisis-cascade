import { motion } from 'framer-motion';
import { GAME_THEORY_DATA } from '@engine/gameTheoryData';

interface Props {
  lambda: number;
  size?: 'sm' | 'md' | 'lg';
}

function getLambdaColor(lambda: number): string {
  const { lockNash, cascadeTrigger, fullEnergyLockdownRisk } = GAME_THEORY_DATA.lambdaThresholds;
  if (lambda >= fullEnergyLockdownRisk) return '#f43f5e';
  if (lambda >= lockNash)              return '#ef4444';
  if (lambda >= cascadeTrigger)        return '#f97316';
  return '#22c55e';
}

const SIZE_CLASSES = {
  sm: 'text-2xl font-bold',
  md: 'text-4xl font-bold',
  lg: 'text-7xl font-black',
};

export function LambdaHero({ lambda, size = 'md' }: Props) {
  const color = getLambdaColor(lambda);
  const shouldPulse = lambda >= GAME_THEORY_DATA.lambdaThresholds.lockNash;

  return (
    <motion.span
      className={`font-mono tabular-nums ${SIZE_CLASSES[size]}`}
      style={{ color }}
      animate={shouldPulse ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
      transition={shouldPulse ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      λ = {lambda.toFixed(2)}
    </motion.span>
  );
}
