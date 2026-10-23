import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { maskText } from '../domain/filter';
import { db } from './firebase';
import { explainDenied } from './access';
import { BannedError, RoomGoneError, TooLongError, isPermissionDenied } from './errors';
import { MAX_MESSAGE_LENGTH, UNREAD_CAP } from './limits';
import { getSettings } from './settings';
import { currentStudent } from './students';
import type { Author, Message, Room, WithId } from './types';

export { MAX_MESSAGE_LENGTH, UNREAD_CAP };

const messagesOf = (roomId: string) => collection(db, 'rooms', roomId, 'messages');

/** Fields every new message shares; createdAt is the server time the rules check against. */
export function newMessage(m: Pick<Message, 'kind' | 'authorId' | 'authorName' | 'ingredient' | 'text' | 'flagged'>) {
  return { ...m, deleted: false, createdAt: serverTimestamp() };
}

/**
 * onDenied gets the reason (BannedError, RoomGoneError, SessionExpiredError) once the student loses the room,
 * then both listeners stop. Firestore does not re-check an open listener when the room doc changes, so a
 * student also watches the room doc and leaves as soon as it shows them banned or removed.
 */
export function watchMessages(
  roomId: string,
  cb: (list: WithId<Message>[]) => void,
  onDenied: (e: unknown) => void,
  max = 200,
): Unsubscribe {
  const me = currentStudent();
  let closed = false;
  const close = () => {
    closed = true;
    stopMessages();
    stopRoom();
  };
  const deny = (e: unknown) => {
    if (closed) return;
    close();
    onDenied(e);
  };
  const explain = (err: unknown) => void explainDenied(err, roomId).then(deny);

  const stopMessages = onSnapshot(
    query(messagesOf(roomId), orderBy('createdAt'), limitToLast(max)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Message) }))),
    explain,
  );
  const stopRoom = me
    ? onSnapshot(doc(db, 'rooms', roomId), (snap) => {
        const room = snap.data() as Room | undefined;
        if (!room || !room.members.includes(me.id)) deny(new RoomGoneError());
        else if (room.banned.includes(me.id)) deny(new BannedError());
      }, explain)
    : () => {};
  return close;
}

let lastSentAt = 0;

/** Sends trimmed text; a student's text is masked first and the original goes to the teacher-only flag log. */
export async function sendMessage(roomId: string, text: string, me: Author | 'teacher'): Promise<{ flagged: boolean }> {
  const body = text.trim();
  if (!body) return { flagged: false };
  if (body.length > MAX_MESSAGE_LENGTH) throw new TooLongError();

  const batch = writeBatch(db);
  const msgRef = doc(messagesOf(roomId));
  if (me === 'teacher') {
    const { teacherName } = await getSettings();
    batch.set(msgRef, newMessage({ kind: 'text', authorId: 'teacher', authorName: teacherName, ingredient: null, text: body, flagged: false }));
    await batch.commit();
    return { flagged: false };
  }

  try {
    const { extraWords } = await getSettings();
    const { masked, flagged, hits } = maskText(body, extraWords);
    batch.set(msgRef, newMessage({ kind: 'text', authorId: me.id, authorName: me.name, ingredient: me.ingredient, text: masked, flagged }));
    batch.set(doc(db, 'rooms', roomId, 'rate', me.id), { at: serverTimestamp() });
    if (flagged)
      batch.set(doc(db, 'flags', msgRef.id), { roomId, studentId: me.id, original: body, masked, hits, createdAt: serverTimestamp() });
    await batch.commit();
    lastSentAt = Date.now();
    return { flagged };
  } catch (e) {
    throw await explainDenied(e, roomId, Date.now() - lastSentAt < 2000);
  }
}

/** Teacher only: students then see "주방장이 건져낸 메시지예요". The flag log keeps the original. */
export async function deleteMessage(roomId: string, msgId: string): Promise<void> {
  await updateDoc(doc(messagesOf(roomId), msgId), { deleted: true, text: '' });
}

export async function markRead(roomId: string, sid: string): Promise<void> {
  await setDoc(doc(db, 'rooms', roomId, 'reads', sid), { at: serverTimestamp() });
}

/** Messages by others since the student last read the room, up to UNREAD_CAP; 0 if the room is closed to them. */
export async function unreadCount(roomId: string, sid: string): Promise<number> {
  try {
    const read = await getDoc(doc(db, 'rooms', roomId, 'reads', sid));
    const since = read.exists() ? (read.data().at as Timestamp) : null;
    const q = since
      ? query(messagesOf(roomId), where('createdAt', '>', since), orderBy('createdAt'), limit(UNREAD_CAP))
      : query(messagesOf(roomId), orderBy('createdAt'), limit(UNREAD_CAP));
    const snap = await getDocs(q);
    return snap.docs.filter((d) => (d.data() as Message).authorId !== sid).length;
  } catch (e) {
    if (isPermissionDenied(e)) return 0;
    throw e;
  }
}
