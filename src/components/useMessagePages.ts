import { useEffect, useRef, useState } from 'react';
import { watchMessages } from '../data/messages';
import type { Message, WithId } from '../data/types';

/** Messages a room shows on entry; each "이전 메시지 더 보기" adds this many. Keeps reads within the free plan. */
export const PAGE_SIZE = 50;

/**
 * The latest messages of a room, live. loadMore widens the window by one page; the listener restarts with
 * the larger limit, so older messages stay live too (a teacher's delete shows up everywhere).
 */
export function useMessagePages(roomId: string, onDenied: (e: unknown) => void) {
  const [page, setPage] = useState({ roomId, max: PAGE_SIZE });
  const max = page.roomId === roomId ? page.max : PAGE_SIZE;
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const denied = useRef(onDenied);
  denied.current = onDenied;

  useEffect(() => watchMessages(roomId, (list) => {
    setMessages(list);
    setLoadingMore(false);
  }, (e) => denied.current(e), max), [roomId, max]);

  return {
    messages,
    hasMore: loadingMore || messages.length >= max,
    loadingMore,
    loadMore: () => {
      setLoadingMore(true);
      setPage({ roomId, max: max + PAGE_SIZE });
    },
  };
}
