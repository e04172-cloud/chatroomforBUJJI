import { createContext, useContext } from 'react';
import type { SessionExpiredError } from '../data/errors';
import type { Me } from '../data/students';
import type { Student, WithId } from '../data/types';

/** What every signed-in student screen needs from StudentApp. */
export interface StudentShell {
  me: Me;
  student: WithId<Student>;
  roster: WithId<Student>[];
  notice: string | null;
  setNotice: (n: string | null) => void;
  expire: (e: SessionExpiredError) => void;
}

export const ShellContext = createContext<StudentShell | null>(null);

export function useShell(): StudentShell {
  const s = useContext(ShellContext);
  if (!s) throw new Error('useShell outside StudentApp');
  return s;
}

/** "치즈로" / "스팸으로": picks 로 or 으로 from the last syllable (ㄹ takes 로). */
export function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}로`;
  const jong = code % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
}
