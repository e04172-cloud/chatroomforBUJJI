// @vitest-environment node
import { beforeEach, describe, expect, test } from 'vitest';
import { arrayUnion, collection, doc, getDoc, getDocs, increment, updateDoc } from 'firebase/firestore';
import { get, ref } from 'firebase/database';
import { db, rtdb } from '../../src/data/firebase';
import {
  BannedError,
  FireOffError,
  NameTakenError,
  SessionExpiredError,
  TooFastError,
  TooLongError,
  WrongPinError,
} from '../../src/data/errors';
import {
  addStudent,
  claimStudent,
  currentStudent,
  loginStudent,
  logout,
  removeStudent,
  resetPin,
  watchSession,
} from '../../src/data/students';
import { ban, createRoom, deleteRoom, setFire, setSchedule, unban, watchRoom } from '../../src/data/rooms';
import { deleteMessage, markRead, sendMessage, unreadCount, watchMessages } from '../../src/data/messages';
import { joinPresence, watchOnlineCount } from '../../src/data/presence';
import { watchFlags } from '../../src/data/flags';
import { setTeacherName } from '../../src/data/settings';
import type { Flag, Message, Room, WithId } from '../../src/data/types';
import { asTeacher, otherTeacherClient, pause, resetEmulators, waitFor } from './setup';

const PIN = '1234';

beforeEach(resetEmulators);

/** Teacher adds students and one room (schedule off so the time of day never matters), then signs out. */
async function classroom(names = ['김가은', '이나래']) {
  await asTeacher();
  const ids: string[] = [];
  for (const n of names) ids.push(await addStudent(n));
  const room = await createRoom({ name: '부대찌개반', emoji: '🍲', members: ids });
  await setSchedule(room, { enabled: false, offMin: 1320, onMin: 420 });
  await logout();
  return { ids, room };
}

const author = (id: string, name = '김가은', ingredient = 'cheese') => ({ id, name, ingredient });

async function messagesAsTeacher(room: string): Promise<WithId<Message>[]> {
  await asTeacher();
  const snap = await getDocs(collection(db, 'rooms', room, 'messages'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Message) }));
}

describe('가입과 로그인', () => {
  test('가입 → 같은 이름 재가입 거절 → 로그인 → 틀린 암호', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    expect(currentStudent()).toEqual({ id: a, gen: 1 });
    await logout();

    await expect(claimStudent(a, '9999', 'spam')).rejects.toBeInstanceOf(NameTakenError);
    await loginStudent(a, PIN);
    expect(currentStudent()?.id).toBe(a);
    await logout();
    await expect(loginStudent(a, '0000')).rejects.toBeInstanceOf(WrongPinError);

    const msgs = await messagesAsTeacher(room);
    expect(msgs.find((m) => m.id === `joined-${a}-1`)).toMatchObject({ kind: 'joined', authorName: '김가은', ingredient: 'cheese' });
  });

  test('암호 초기화 뒤 옛 암호는 안 되고 새로 가입할 수 있다', async () => {
    const { ids: [a] } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await asTeacher();
    await resetPin(a);
    await logout();

    await expect(loginStudent(a, PIN)).rejects.toBeInstanceOf(WrongPinError);
    await claimStudent(a, '5678', 'spam');
    expect(currentStudent()).toEqual({ id: a, gen: 2 });
  });

  test('다른 기기에서 접속 중에 암호가 초기화되면 세션 만료를 알린다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    let expired: SessionExpiredError | undefined;
    const stop = watchSession((e) => (expired = e));

    const other = await otherTeacherClient();
    await updateDoc(doc(other.db, 'students', a), { gen: increment(1), claimedGen: null });
    expect((await waitFor(() => expired)).reason).toBe('reset');
    stop();

    await expect(sendMessage(room, '안녕', author(a))).rejects.toBeInstanceOf(SessionExpiredError);
    await other.close();
  });
});

describe('메시지', () => {
  test('욕설은 가려서 저장하고 원래 문장은 선생님만 본다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    expect(await sendMessage(room, '아 씨발', author(a))).toEqual({ flagged: true });
    await expect(getDocs(collection(db, 'flags'))).rejects.toMatchObject({ code: 'permission-denied' });

    const msgs = await messagesAsTeacher(room);
    expect(msgs.find((m) => m.kind === 'text')).toMatchObject({ text: '아 ＊＊', flagged: true });
    const flags = await new Promise<WithId<Flag>[]>((resolve) => {
      const stop = watchFlags((list) => {
        if (list.length) {
          stop();
          resolve(list);
        }
      });
    });
    expect(flags[0]).toMatchObject({ roomId: room, studentId: a, original: '아 씨발', masked: '아 ＊＊' });
  });

  test('공백만 있으면 아무것도 저장하지 않는다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    expect(await sendMessage(room, '   \n ', author(a))).toEqual({ flagged: false });
    expect((await messagesAsTeacher(room)).filter((m) => m.kind === 'text')).toHaveLength(0);
  });

  test('500자는 보내지고 501자는 막힌다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await sendMessage(room, '가'.repeat(500), author(a));
    await expect(sendMessage(room, '가'.repeat(501), author(a))).rejects.toBeInstanceOf(TooLongError);
  });

  test('너무 빨리 보내면 TooFastError', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await sendMessage(room, '하나', author(a));
    await expect(sendMessage(room, '둘', author(a))).rejects.toBeInstanceOf(TooFastError);
    await pause(1100);
    await sendMessage(room, '셋', author(a));
  });

  test('불을 끄면 학생은 FireOffError, 선생님은 계속 쓸 수 있다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await asTeacher();
    await setFire(room, 'off');
    await sendMessage(room, '오늘은 여기까지', 'teacher');
    await logout();

    await loginStudent(a, PIN);
    await expect(sendMessage(room, '안녕', author(a))).rejects.toBeInstanceOf(FireOffError);
    const msgs = await messagesAsTeacher(room);
    expect(msgs.find((m) => m.kind === 'fire')).toMatchObject({ text: 'off', authorId: 'teacher' });
  });

  test('선생님 이름과 메시지 삭제', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await sendMessage(room, '지울 말', author(a));
    await asTeacher();
    await setTeacherName('김선생');
    await sendMessage(room, '안녕하세요', 'teacher');

    const msgs = await messagesAsTeacher(room);
    expect(msgs.find((m) => m.authorId === 'teacher')).toMatchObject({ authorName: '김선생', text: '안녕하세요' });
    const target = msgs.find((m) => m.text === '지울 말')!;
    await deleteMessage(room, target.id);
    expect((await getDoc(doc(db, 'rooms', room, 'messages', target.id))).data()).toMatchObject({ deleted: true, text: '' });
  });

  test('안 읽은 수는 마지막으로 읽은 뒤 다른 사람이 보낸 메시지 수', async () => {
    const { ids: [a, b], room } = await classroom();
    await claimStudent(b, PIN, 'spam');
    await logout();
    await claimStudent(a, PIN, 'cheese');
    await markRead(room, a);
    await sendMessage(room, '내 말은 안 셈', author(a));
    await logout();

    await loginStudent(b, PIN);
    await sendMessage(room, '하나', author(b, '이나래', 'spam'));
    await pause(1100);
    await sendMessage(room, '둘', author(b, '이나래', 'spam'));
    await logout();

    await loginStudent(a, PIN);
    expect(await unreadCount(room, a)).toBe(2);
    await markRead(room, a);
    expect(await unreadCount(room, a)).toBe(0);
  });
});

describe('추방과 명단', () => {
  test('보고 있는 중에 추방되면 watchMessages가 BannedError로 알린다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    let denied: unknown;
    let seen = false;
    const stop = watchMessages(room, () => (seen = true), (e) => (denied = e));
    await waitFor(() => (seen ? true : undefined));

    const other = await otherTeacherClient();
    await updateDoc(doc(other.db, 'rooms', room), { banned: arrayUnion(a) });
    expect(await waitFor(() => denied)).toBeInstanceOf(BannedError);
    stop();
    await expect(sendMessage(room, '나 왜', author(a))).rejects.toBeInstanceOf(BannedError);
    await other.close();
  });

  test('ban과 unban, 추방돼도 방 문서는 보인다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await asTeacher();
    await ban(room, a);
    await logout();

    await loginStudent(a, PIN);
    const seen = await new Promise<WithId<Room>>((resolve, reject) => {
      const stop = watchRoom(room, (r) => {
        stop();
        resolve(r);
      }, reject);
    });
    expect(seen.banned).toContain(a);

    await asTeacher();
    await unban(room, a);
    expect((await getDoc(doc(db, 'rooms', room))).data()?.banned).toEqual([]);
  });

  test('명단에서 삭제해도 지난 메시지의 이름은 남는다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await sendMessage(room, '전학 가요', author(a));
    await asTeacher();
    await removeStudent(a);

    expect((await getDoc(doc(db, 'students', a))).exists()).toBe(false);
    expect((await getDoc(doc(db, 'rooms', room))).data()?.members).not.toContain(a);
    const msgs = await messagesAsTeacher(room);
    expect(msgs.find((m) => m.text === '전학 가요')).toMatchObject({ authorName: '김가은', ingredient: 'cheese' });
  });

  test('방을 지우면 메시지와 경고 기록도 지운다', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    await sendMessage(room, '씨발', author(a));
    await asTeacher();
    await deleteRoom(room);

    expect((await getDoc(doc(db, 'rooms', room))).exists()).toBe(false);
    expect((await getDocs(collection(db, 'rooms', room, 'messages'))).size).toBe(0);
    expect((await getDocs(collection(db, 'flags'))).size).toBe(0);
  });
});

describe('접속 표시', () => {
  test('한 학생이 두 기기로 접속해도 1명, 둘 다 나가야 0명', async () => {
    const { ids: [a], room } = await classroom();
    await claimStudent(a, PIN, 'cheese');
    let online = -1;
    const stop = watchOnlineCount(room, (n) => (online = n));

    const laptop = joinPresence(room, a);
    const phone = joinPresence(room, a);
    let conns = 0;
    for (let i = 0; i < 100 && conns < 2; i++, await pause(50))
      conns = (await get(ref(rtdb, `presence/${room}/${a}`))).size;
    expect(conns).toBe(2);
    await waitFor(() => (online === 1 ? true : undefined));

    laptop();
    await pause(300);
    expect(online).toBe(1);
    phone();
    await waitFor(() => (online === 0 ? true : undefined));
    stop();
  });
});
