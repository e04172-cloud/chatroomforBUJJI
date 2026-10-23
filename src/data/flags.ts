import { collection, limit, onSnapshot, orderBy, query, where, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { Flag, WithId } from './types';

const LOG_LIMIT = 500;

const toFlag = (d: { id: string; data(o: { serverTimestamps: 'estimate' }): unknown }) =>
  ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Flag) });

/** Teacher only. Newest first; the flag id is the message id. */
export function watchFlags(
  cb: (flags: WithId<Flag>[]) => void,
  filter: { studentId?: string } = {},
  onError?: (e: Error) => void,
): Unsubscribe {
  const base = collection(db, 'flags');
  const q = filter.studentId
    ? query(base, where('studentId', '==', filter.studentId), orderBy('createdAt', 'desc'), limit(LOG_LIMIT))
    : query(base, orderBy('createdAt', 'desc'), limit(LOG_LIMIT));
  return onSnapshot(q, (snap) => cb(snap.docs.map(toFlag)), onError);
}

/** Teacher only: flags of one room keyed by message id, to show originals next to masked messages. */
export function watchFlagsForRoom(
  roomId: string,
  cb: (flags: Map<string, Flag>) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'flags'), where('roomId', '==', roomId), orderBy('createdAt', 'desc'), limit(LOG_LIMIT));
  return onSnapshot(q, (snap) => cb(new Map(snap.docs.map((d) => [d.id, toFlag(d)]))), onError);
}
