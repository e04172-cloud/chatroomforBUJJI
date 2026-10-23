import { doc, getDoc } from 'firebase/firestore';
import { isFireOn } from '../domain/fire';
import { db } from './firebase';
import {
  BannedError,
  FireOffError,
  RoomGoneError,
  SessionExpiredError,
  TooFastError,
  isPermissionDenied,
} from './errors';
import { currentStudent } from './students';
import { toFireInput, type Room, type Student } from './types';

/**
 * Turns a permission-denied error for the signed-in student into the reason behind it, read from fresh
 * snapshots: expired session, then lost room access, then the fire, then (if they just sent) the rate limit.
 * Anything else is returned unchanged.
 */
export async function explainDenied(err: unknown, roomId?: string, justSent = false): Promise<unknown> {
  if (!isPermissionDenied(err)) return err;
  const me = currentStudent();
  if (!me) return err;
  try {
    const s = await getDoc(doc(db, 'students', me.id));
    if (!s.exists()) return new SessionExpiredError('removed');
    if ((s.data() as Student).gen !== me.gen) return new SessionExpiredError('reset');
  } catch {
    return err;
  }
  if (!roomId) return err;

  let room: Room;
  try {
    const r = await getDoc(doc(db, 'rooms', roomId));
    if (!r.exists()) return new RoomGoneError();
    room = r.data() as Room;
  } catch {
    return new RoomGoneError();
  }
  if (!room.members.includes(me.id)) return new RoomGoneError();
  if (room.banned.includes(me.id)) return new BannedError();
  if (!isFireOn(toFireInput(room), Date.now())) return new FireOffError();
  return justSent ? new TooFastError() : err;
}
