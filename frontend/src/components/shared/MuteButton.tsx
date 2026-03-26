// frontend/src/components/shared/MuteButton.tsx
import { useState } from 'react';
import { audioEngine } from '../../utils/audioEngine';

export function MuteButton() {
  const [muted, setMuted] = useState(() => audioEngine.isMuted());

  function toggle() {
    const next = !muted;
    audioEngine.setMuted(next);
    setMuted(next);
  }

  return (
    <button
      onClick={toggle}
      title={muted ? 'Unmute' : 'Mute'}
      className="text-gray-600 hover:text-white transition"
      style={{ lineHeight: 0 }}
    >
      {muted ? (
        // Speaker with slash
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        // Speaker with waves
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
