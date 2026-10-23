import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import { manualFire, type Schedule } from '../domain/fire';
import { db } from './firebase';
import { explainDenied } from './access';
import { RoomGoneError } from './errors';
import { newMessage } from './messages';
import { getSettings } from './settings';
import { currentStudent } from './students';
import type { Room, WithId } from './types';

export const DEFAULT_SCHEDULE: Schedule = { enabled: true, offMin: 1320, onMin: 420 };

const roomRef = (roomId: string) => doc(db, 'rooms', roomId);
const withId = (d: { id: string; data(): unknown }) => ({ id: d.id, ...(d.data() as Room) });

/** Includes rooms the student is banned from, so the lobby can show them greyed out. */
export function watchMyRooms(studentId: string, cb: (rooms: WithId<Room>[]) => void, onError?: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'rooms'), where('members', 'array-contains', studentId)),
    (snap) => cb(snap.docs.map(withId).sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))),
    (err) => void explainDenied(err).then((e) => onError?.(e)),
  );
}

export function watchAllRooms(cb: (rooms: WithId<Room>[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'rooms'), orderBy('createdAt')), (snap) => cb(snap.docs.map(withId)), onError);
}

/** onDenied fires when the room is deleted or the student is taken out of it (a banned student still sees it). */
export function watchRoom(roomId: string, cb: (room: WithId<Room>) => void, onDenied: (e: unknown) => void): Unsubscribe {
  const me = currentStudent();
  return onSnapshot(
    roomRef(roomId),
    (snap) => {
      if (!snap.exists()) return onDenied(new RoomGoneError());
      const room = withId(snap);
      // An open listener is not re-checked by the rules, so notice removal from the snapshot itself.
      if (me && !room.members.includes(me.id)) return onDenied(new RoomGoneError());
      cb(room);
    },
    (err) => void explainDenied(err, roomId).then(onDenied),
  );
}

export async function createRoom(r: { name: string; emoji: string; members: string[] }): Promise<string> {
  const ref = await addDoc(collection(db, 'rooms'), {
    name: r.name.trim(),
    emoji: r.emoji,
    createdAt: serverTimestamp(),
    members: [...new Set(r.members)],
    banned: [],
    fire: { manual: null, manualUntil: null },
    schedule: DEFAULT_SCHEDULE,
  });
  return ref.id;
}

export async function updateRoom(roomId: string, r: { name?: string; emoji?: string }): Promise<void> {
  await updateDoc(roomRef(roomId), { ...(r.name !== undefined && { name: r.name.trim() }), ...(r.emoji !== undefined && { emoji: r.emoji }) });
}

export async function updateRoomMembers(roomId: string, members: string[]): Promise<void> {
  await updateDoc(roomRef(roomId), { members: [...new Set(members)] });
}

async function deleteAll(q: Query): Promise<void> {
  for (;;) {
    const snap = await getDocs(query(q, limit(400)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Deletes the room with its messages, read/rate markers and flag log entries. */
export async function deleteRoom(roomId: string): Promise<void> {
  for (const sub of ['messages', 'reads', 'rate']) await deleteAll(collection(db, 'rooms', roomId, sub));
  await deleteAll(query(collection(db, 'flags'), where('roomId', '==', roomId)));
  const batch = writeBatch(db);
  batch.delete(roomRef(roomId));
  await batch.commit();
}

export async function ban(roomId: string, sid: string): Promise<void> {
  await updateDoc(roomRef(roomId), { banned: arrayUnion(sid) });
}

export async function unban(roomId: string, sid: string): Promise<void> {
  await updateDoc(roomRef(roomId), { banned: arrayRemove(sid) });
}

/** Manual on/off that lasts until the next schedule boundary, announced in the room. */
export async function setFire(roomId: string, state: 'on' | 'off'): Promise<void> {
  const snap = await getDoc(roomRef(roomId));
  if (!snap.exists()) throw new RoomGoneError();
  const f = manualFire(state, (snap.data() as Room).schedule, Date.now());
  const { teacherName } = await getSettings();
  const batch = writeBatch(db);
  batch.update(snap.ref, {
    fire: { manual: f.manual, manualUntil: f.manualUntil === null ? null : Timestamp.fromMillis(f.manualUntil) },
  });
  batch.set(doc(collection(db, 'rooms', roomId, 'messages')),
    newMessage({ kind: 'fire', authorId: 'teacher', authorName: teacherName, ingredient: null, text: state, flagged: false }));
  await batch.commit();
}

export async function setSchedule(roomId: string, schedule: Schedule): Promise<void> {
  const ok = (m: number) => Number.isInteger(m) && m >= 0 && m < 1440;
  if (!ok(schedule.offMin) || !ok(schedule.onMin)) throw new RangeError('시각은 00:00~23:59 사이여야 해요');
  await updateDoc(roomRef(roomId), {
    schedule: { enabled: schedule.enabled, offMin: schedule.offMin, onMin: schedule.onMin },
  });
}
