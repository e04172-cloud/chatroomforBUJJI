import { createContext, useContext } from 'react';
import type { Room, Settings, Student, WithId } from '../data/types';

/** Live data every teacher screen shares, subscribed once in TeacherApp. */
export interface TeacherShell {
  roster: WithId<Student>[];
  rooms: WithId<Room>[];
  settings: Settings;
}

export const TeacherContext = createContext<TeacherShell | null>(null);

export function useTeacher(): TeacherShell {
  const t = useContext(TeacherContext);
  if (!t) throw new Error('useTeacher outside TeacherApp');
  return t;
}

export const ROOM_EMOJIS = ['🍲', '🔬', '🎭', '📚', '⚽', '🎨', '🎵', '🧪', '🌏', '✏️', '🏫', '🎲', '🍳', '🌱', '🧩', '💡'];

export const studentLink = () => `${location.origin}/`;
