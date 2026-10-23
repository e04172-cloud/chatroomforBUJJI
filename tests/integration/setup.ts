import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, connectAuthEmulator, getAuth, signInWithCredential, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { auth, firebaseConfig } from '../../src/data/firebase';

const PROJECT = firebaseConfig.projectId;
export const TEACHER_EMAIL = 'teacher@test.com';

const teacherCredential = () =>
  GoogleAuthProvider.credential(JSON.stringify({ sub: 'teacher', email: TEACHER_EMAIL, email_verified: true }));

/** Signs out and wipes Auth, Firestore and RTDB in the emulators. */
export async function resetEmulators(): Promise<void> {
  await signOut(auth);
  const res = await Promise.all([
    fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' }),
    fetch(`http://127.0.0.1:9000/.json?ns=${PROJECT}-default-rtdb`, {
      method: 'PUT', body: '{}', headers: { Authorization: 'Bearer owner' },
    }),
  ]);
  for (const r of res) if (!r.ok) throw new Error(`emulator reset failed: ${r.status} ${r.url}`);
}

/** Signs the app's shared auth in as the teacher. */
export async function asTeacher(): Promise<void> {
  await signOut(auth);
  await signInWithCredential(auth, teacherCredential());
}

/** A second, independent client signed in as the teacher, for acting while the main client watches. */
export async function otherTeacherClient(): Promise<{ db: Firestore; close: () => Promise<void> }> {
  const other: FirebaseApp = initializeApp(firebaseConfig, `other-${Math.random()}`);
  const otherAuth = getAuth(other);
  connectAuthEmulator(otherAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(other);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  await signInWithCredential(otherAuth, teacherCredential());
  return { db, close: () => deleteApp(other) };
}

/** Polls until fn returns something other than undefined. */
export async function waitFor<T>(fn: () => T | undefined, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
