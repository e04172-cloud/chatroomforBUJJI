import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { authEmail, newStudentId, parseAuthEmail, toAuthPassword, validatePin } from '../domain/identity';
import { auth, db } from './firebase';
import {
  InvalidNameError,
  InvalidPinError,
  NameTakenError,
  NotOnRosterError,
  SessionExpiredError,
  TooManyTriesError,
  WrongPinError,
  errorCode,
  isPermissionDenied,
} from './errors';
import type { IngredientKey, Room, Student, WithId } from './types';

export type Me = { id: string; gen: number };

const studentRef = (id: string) => doc(db, 'students', id);

export function watchRoster(cb: (list: WithId<Student>[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'students'), orderBy('order')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Student) }))),
    onError,
  );
}

export function currentStudent(): Me | null {
  const p = parseAuthEmail(auth.currentUser?.email ?? '');
  return p && { id: p.studentId, gen: p.gen };
}

/** Fires once auth has loaded and again whenever the signed-in student changes. */
export function watchCurrentStudent(cb: (me: Me | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, () => cb(currentStudent()));
}

/** Calls onExpired once if the teacher resets this student's PIN or removes them from the roster. */
export function watchSession(onExpired: (e: SessionExpiredError) => void): Unsubscribe {
  const me = currentStudent();
  if (!me) return () => {};
  let done = false;
  const expire = (e: SessionExpiredError) => {
    if (!done) {
      done = true;
      onExpired(e);
    }
  };
  return onSnapshot(studentRef(me.id), (snap) => {
    if (!snap.exists()) expire(new SessionExpiredError('removed'));
    else if ((snap.data() as Student).gen !== me.gen) expire(new SessionExpiredError('reset'));
  });
}

function authError(e: unknown): unknown {
  const code = errorCode(e);
  if (code === 'auth/too-many-requests') return new TooManyTriesError();
  if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found']
    .includes(code)) return new WrongPinError();
  return e;
}

async function readStudent(id: string): Promise<Student> {
  const snap = await getDoc(studentRef(id));
  if (!snap.exists()) throw new NotOnRosterError();
  return snap.data() as Student;
}

/** First sign-up for a roster name: creates the auth account, claims the name, announces it in each room. */
export async function claimStudent(id: string, pin: string, ingredient: IngredientKey): Promise<void> {
  const bad = validatePin(pin);
  if (bad) throw new InvalidPinError(bad);
  const s = await readStudent(id);
  if (s.claimedGen != null) throw new NameTakenError();

  const email = authEmail(id, s.gen);
  const password = toAuthPassword(pin);
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    if (errorCode(e) !== 'auth/email-already-in-use') throw authError(e);
    // An earlier claim may have created the account and then stopped; the same PIN finishes it.
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      throw new NameTakenError();
    }
  }
  try {
    await updateDoc(studentRef(id), { claimedGen: s.gen, ingredient });
  } catch (e) {
    await signOut(auth);
    throw isPermissionDenied(e) ? new NameTakenError() : e;
  }

  // The join notice is cosmetic: a room that refuses it must not undo the sign-up.
  const rooms = await getDocs(query(collection(db, 'rooms'), where('members', 'array-contains', id)));
  await Promise.allSettled(rooms.docs
    .filter((r) => !(r.data() as Room).banned.includes(id))
    .map((r) => setDoc(doc(db, 'rooms', r.id, 'messages', `joined-${id}-${s.gen}`), {
      kind: 'joined', authorId: id, authorName: s.name, ingredient, text: '',
      flagged: false, deleted: false, createdAt: serverTimestamp(),
    })));
}

export async function loginStudent(id: string, pin: string): Promise<void> {
  const { gen } = await readStudent(id);
  try {
    await signInWithEmailAndPassword(auth, authEmail(id, gen), toAuthPassword(pin));
  } catch (e) {
    throw authError(e);
  }
}

export async function setIngredient(key: IngredientKey): Promise<void> {
  const me = currentStudent();
  if (!me) throw new SessionExpiredError('reset');
  await updateDoc(studentRef(me.id), { ingredient: key });
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

// ---------- teacher ----------

export async function addStudent(name: string): Promise<string> {
  const n = name.trim();
  if (!n || n.length > 40) throw new InvalidNameError('이름은 1~40자로 적어 주세요');
  const all = await getDocs(collection(db, 'students'));
  const order = Math.max(0, ...all.docs.map((d) => (d.data() as Student).order)) + 1;
  const id = newStudentId();
  await setDoc(studentRef(id), { name: n, order, gen: 1, claimedGen: null, ingredient: null } satisfies Student);
  return id;
}

/** Removes a student from the roster and from every room; their old messages stay. */
export async function removeStudent(id: string): Promise<void> {
  const rooms = await getDocs(collection(db, 'rooms'));
  const batch = writeBatch(db);
  for (const r of rooms.docs) {
    const d = r.data() as Room;
    if (d.members.includes(id) || d.banned.includes(id))
      batch.update(r.ref, { members: arrayRemove(id), banned: arrayRemove(id) });
  }
  batch.delete(studentRef(id));
  await batch.commit();
}

/** Bumps the generation so the old account stops working and the name can be claimed again. */
export async function resetPin(id: string): Promise<void> {
  await updateDoc(studentRef(id), { gen: increment(1), claimedGen: null });
}
