import { Timestamp } from 'firebase/firestore';
import type { Message, Room, WithId } from '../../src/data/types';

export const at = (iso: string) => Timestamp.fromMillis(Date.parse(`${iso}:00+09:00`));

export function msg(over: Partial<WithId<Message>> = {}): WithId<Message> {
  return {
    id: 'm1',
    kind: 'text',
    authorId: 'aaaaaaaaaaaa',
    authorName: '김가은',
    ingredient: 'cheese',
    text: '안녕',
    flagged: false,
    deleted: false,
    createdAt: at('2026-10-21T09:12'),
    ...over,
  };
}

export function room(over: Partial<WithId<Room>> = {}): WithId<Room> {
  return {
    id: 'R',
    name: '부대찌개반',
    emoji: '🍲',
    createdAt: at('2026-10-20T09:00'),
    members: ['aaaaaaaaaaaa', 'bbbbbbbbbbbb'],
    banned: [],
    fire: { manual: null, manualUntil: null },
    schedule: { enabled: true, offMin: 1320, onMin: 420 },
    ...over,
  };
}
