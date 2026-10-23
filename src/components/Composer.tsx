import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { MAX_MESSAGE_LENGTH } from '../data/limits';

/**
 * Message box: Enter sends, Shift+Enter breaks the line, and Enter while a Korean syllable is still
 * being composed is ignored. A failed send keeps the text so nothing typed is lost.
 */
export function Composer({ disabled, disabledText, onSend, leading, placeholder = '메시지를 입력하세요' }: {
  disabled: boolean;
  disabledText?: string;
  onSend: (text: string) => Promise<void>;
  leading?: ReactNode;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !busy && text.trim().length > 0;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  async function send() {
    if (!canSend) return;
    setBusy(true);
    try {
      await onSend(text);
      setText('');
    } catch {
      // The parent shows the reason; keep the text for another try.
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    void send();
  }

  return (
    <div className={disabled ? 'composer off' : 'composer'}>
      {leading != null && <span className="composer-lead" aria-hidden>{leading}</span>}
      <textarea
        ref={ref}
        rows={1}
        value={disabled ? '' : text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={disabled ? disabledText : placeholder}
        maxLength={MAX_MESSAGE_LENGTH}
        enterKeyHint="send"
        aria-label="메시지"
      />
      <button type="button" className="send" onClick={() => void send()} disabled={!canSend} aria-label="보내기">➤</button>
    </div>
  );
}
