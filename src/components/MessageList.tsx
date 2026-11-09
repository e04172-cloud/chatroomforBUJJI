import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Message, WithId } from '../data/types';
import { dayKey, formatDay } from './time';

const NEAR_BOTTOM_PX = 80;

/**
 * Scrollable message column with a date line whenever the KST day changes.
 * New messages scroll it down only if the reader was already at the bottom (or just sent one).
 */
export function MessageList({ messages, renderItem, empty, more }: {
  messages: WithId<Message>[];
  renderItem: (m: WithId<Message>) => ReactNode;
  empty?: ReactNode;
  /** Older messages exist: shows "이전 메시지 더 보기" above the first one. */
  more?: { loading: boolean; onLoad: () => void };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  // Distance from the bottom when older messages were asked for, so the reader stays on the same message.
  const keepFromBottom = useRef<number | null>(null);
  const firstId = messages[0]?.id;
  const lastId = messages.at(-1)?.id;

  const onScroll = () => {
    const el = ref.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const loadOlder = () => {
    const el = ref.current;
    if (el) keepFromBottom.current = el.scrollHeight - el.scrollTop;
    more?.onLoad();
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (keepFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - keepFromBottom.current;
      keepFromBottom.current = null;
    } else if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [firstId, lastId, messages.length]);

  let prevDay = '';
  return (
    <div className="msgs" ref={ref} onScroll={onScroll} role="log" aria-live="polite">
      {messages.length === 0 && empty}
      {more && messages.length > 0 && (
        <button type="button" className="older-btn" onClick={loadOlder} disabled={more.loading}>
          {more.loading ? '불러오는 중…' : '이전 메시지 더 보기'}
        </button>
      )}
      {messages.map((m) => {
        const ms = m.createdAt ? m.createdAt.toMillis() : Date.now();
        const day = dayKey(ms);
        const sep = day !== prevDay;
        prevDay = day;
        return (
          <Fragment key={m.id}>
            {sep && <div className="daysep">{formatDay(ms)}</div>}
            {renderItem(m)}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Lets a sender jump to the bottom after posting even if they had scrolled up. */
export function scrollToBottomSoon() {
  requestAnimationFrame(() => {
    const el = document.querySelector('.msgs');
    if (el) el.scrollTop = el.scrollHeight;
  });
}
