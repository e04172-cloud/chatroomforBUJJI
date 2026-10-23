import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Message, WithId } from '../data/types';
import { dayKey, formatDay } from './time';

const NEAR_BOTTOM_PX = 80;

/**
 * Scrollable message column with a date line whenever the KST day changes.
 * New messages scroll it down only if the reader was already at the bottom (or just sent one).
 */
export function MessageList({ messages, renderItem, empty }: {
  messages: WithId<Message>[];
  renderItem: (m: WithId<Message>) => ReactNode;
  empty?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastId = messages.at(-1)?.id;

  const onScroll = () => {
    const el = ref.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId, messages.length]);

  let prevDay = '';
  return (
    <div className="msgs" ref={ref} onScroll={onScroll} role="log" aria-live="polite">
      {messages.length === 0 && empty}
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
