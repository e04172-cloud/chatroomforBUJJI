import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { InvalidNameError } from './errors';
import type { Settings } from './types';

export const DEFAULT_TEACHER_NAME = '담임선생님';

const settingsRef = () => doc(db, 'settings', 'app');

function withDefaults(d: Partial<Settings> | undefined): Settings {
  return { teacherName: d?.teacherName || DEFAULT_TEACHER_NAME, extraWords: d?.extraWords ?? [] };
}

// Latest value from a live watcher, so sending a message does not re-read settings each time.
let live: Settings | null = null;
let watchers = 0;

export function watchSettings(cb: (s: Settings) => void, onError?: (e: Error) => void): Unsubscribe {
  watchers++;
  const stop = onSnapshot(settingsRef(), (snap) => {
    live = withDefaults(snap.data() as Partial<Settings> | undefined);
    cb(live);
  }, onError);
  return () => {
    stop();
    if (--watchers === 0) live = null;
  };
}

export async function getSettings(): Promise<Settings> {
  if (live) return live;
  return withDefaults((await getDoc(settingsRef())).data() as Partial<Settings> | undefined);
}

export async function setTeacherName(name: string): Promise<void> {
  const n = name.trim();
  if (!n || n.length > 20) throw new InvalidNameError('선생님 이름은 1~20자로 적어 주세요');
  await setDoc(settingsRef(), { teacherName: n }, { merge: true });
}

export async function setExtraWords(words: string[]): Promise<void> {
  const clean = [...new Set(words.map((w) => w.trim()).filter(Boolean))];
  await setDoc(settingsRef(), { extraWords: clean }, { merge: true });
}
