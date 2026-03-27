// frontend/src/components/shared/PhaseHint.tsx
import { useState } from 'react';

interface Props {
  phaseKey: string;
  text: string;
}

export function PhaseHint({ phaseKey, text }: Props) {
  const storageKey = `cc_hint_${phaseKey}`;
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(storageKey));

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }

  return (
    <div className="flex items-start justify-between gap-3 mb-5 py-2 px-4 rounded border-l-2 border-blue-900 bg-[#0e1520]">
      <p className="text-xs text-gray-400 leading-relaxed">{text}</p>
      <button
        onClick={dismiss}
        className="text-gray-600 hover:text-white transition flex-shrink-0 text-sm leading-none mt-0.5"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
