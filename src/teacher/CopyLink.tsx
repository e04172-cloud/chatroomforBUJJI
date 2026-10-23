import { useState } from 'react';
import { studentLink } from './shell';

/** Copies the single student link; where the clipboard is unavailable (plain http) it shows the link instead. */
export function CopyLink({ className = 'pill' }: { className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(studentLink());
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('manual');
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void copy()}>
        {state === 'copied' ? '✔ 복사했어요' : '🔗 참여 링크 복사'}
      </button>
      {state === 'manual' && (
        <input className="input" readOnly value={studentLink()} onFocus={(e) => e.target.select()} aria-label="참여 링크"
          style={{ position: 'absolute', right: 12, top: '100%', width: 260, zIndex: 5 }} />
      )}
    </>
  );
}
