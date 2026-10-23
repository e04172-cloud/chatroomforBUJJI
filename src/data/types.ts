import type { Timestamp } from 'firebase/firestore';
import type { FireInput, Schedule } from '../domain/fire';

export type IngredientKey = string;
export type WithId<T> = T & { id: string };

/** students/{studentId} — readable before sign-in so the join screen can list names. */
export interface Student {
  name: string;
  order: number;
  gen: number; // +1 on every PIN reset
  claimedGen: number | null; // equals gen once the student has signed up
  ingredient: IngredientKey | null;
}

/** rooms/{roomId} */
export interface Room {
  name: string;
  emoji: string;
  createdAt: Timestamp;
  members: string[];
  banned: string[];
  fire: { manual: 'on' | 'off' | null; manualUntil: Timestamp | null };
  schedule: Schedule; // minutes after KST midnight, default 1320 / 420
}

/** rooms/{roomId}/messages/{msgId} */
export interface Message {
  kind: 'text' | 'joined' | 'fire';
  authorId: string; // studentId or 'teacher'
  authorName: string;
  ingredient: IngredientKey | null; // copied so it survives roster removal
  text: string; // masked text; 'on' | 'off' when kind is 'fire'
  flagged: boolean;
  deleted: boolean;
  createdAt: Timestamp;
}

/** flags/{msgId} — teacher only; the only place the unmasked text is stored. */
export interface Flag {
  roomId: string;
  studentId: string;
  original: string;
  masked: string;
  hits: string[];
  createdAt: Timestamp;
}

/** settings/app */
export interface Settings {
  teacherName: string;
  extraWords: string[];
}

export interface Author {
  id: string;
  name: string;
  ingredient: IngredientKey | null;
}

export function toFireInput(room: Pick<Room, 'fire' | 'schedule'>): FireInput {
  return {
    fire: { manual: room.fire.manual, manualUntil: room.fire.manualUntil?.toMillis() ?? null },
    schedule: room.schedule,
  };
}
