import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { TEACHER_EMAIL, USE_EMULATORS, auth } from './firebase';
import { errorCode } from './errors';

export type { User };

if (USE_EMULATORS && typeof window !== 'undefined') {
  // Emulator builds only: lets the screen tests sign in as a Google account without the popup.
  Object.assign(window, {
    __budaeGoogleSignIn: (email = TEACHER_EMAIL) =>
      signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true }))),
  });
}

/** Google sign-in in a popup, falling back to a full-page redirect where popups are blocked. */
export async function teacherSignIn(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(errorCode(e)))
      await signInWithRedirect(auth, provider);
    else throw e;
  }
}

/** Only decides which screen to show; the security rules make the real check. */
export function isTeacherUser(user: User | null): boolean {
  return !!user && user.emailVerified && (user.email ?? '').toLowerCase() === TEACHER_EMAIL;
}

export function watchUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function teacherSignOut(): Promise<void> {
  await signOut(auth);
}
