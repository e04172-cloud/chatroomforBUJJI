// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  type DocumentData,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { authEmail } from '../../src/domain/identity';
import { minutesKST } from '../../src/domain/fire';

const A = 'aaaaaaaaaaaa';
const B = 'bbbbbbbbbbbb';
const C = 'cccccccccccc';
const TEACHER = 'teacher@test.com';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budae',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

/** Off-window around "now" in KST, so the schedule alone turns the fire off. */
function windowAroundNow() {
  const now = minutesKST(Date.now());
  return { enabled: true, offMin: (now + 1440 - 30) % 1440, onMin: (now + 30) % 1440 };
}
/** Off-window that wraps past midnight (offMin > onMin) and still contains "now". */
function wrappingWindowAroundNow() {
  const now = minutesKST(Date.now());
  return now < 1438 ? { enabled: true, offMin: 1439, onMin: now + 1 } : { enabled: true, offMin: now, onMin: 0 };
}
/** Off-window far from "now", so the schedule leaves the fire on. */
function windowAwayFromNow() {
  const now = minutesKST(Date.now());
  return { enabled: true, offMin: (now + 120) % 1440, onMin: (now + 180) % 1440 };
}
const future = () => Timestamp.fromMillis(Date.now() + 3_600_000);
const past = () => Timestamp.fromMillis(Date.now() - 3_600_000);

function room(members: string[], extra: Record<string, unknown> = {}) {
  return {
    name: '방',
    emoji: '🍲',
    createdAt: Timestamp.now(),
    members,
    banned: [],
    fire: { manual: null, manualUntil: null },
    schedule: windowAwayFromNow(),
    ...extra,
  };
}

async function seed(fn: (db: Firestore) => Promise<unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore);
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'students', A), { name: '김가', order: 1, gen: 1, claimedGen: 1, ingredient: 'cheese' });
    await setDoc(doc(db, 'students', B), { name: '이나', order: 2, gen: 1, claimedGen: 1, ingredient: 'spam' });
    await setDoc(doc(db, 'students', C), { name: '박다', order: 3, gen: 1, claimedGen: null, ingredient: null });
    await setDoc(doc(db, 'rooms', 'R'), room([A, B]));
    await setDoc(doc(db, 'rooms', 'Q'), room([B]));
    await setDoc(doc(db, 'rooms', 'R', 'messages', 'm1'), {
      kind: 'text', authorId: B, authorName: '이나', ingredient: 'spam', text: '안녕',
      flagged: false, deleted: false, createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'rooms', 'Q', 'messages', 'q1'), {
      kind: 'text', authorId: B, authorName: '이나', ingredient: 'spam', text: '안녕',
      flagged: false, deleted: false, createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'settings', 'app'), { teacherName: '담임선생님', extraWords: [] });
  });
});

const db = (ctx: { firestore(): unknown }) => ctx.firestore() as unknown as Firestore;
const anon = () => db(env.unauthenticatedContext());
const student = (id: string, gen = 1) =>
  db(env.authenticatedContext(`uid-${id}-${gen}`, { email: authEmail(id, gen) }));
const teacher = () => db(env.authenticatedContext('t', { email: TEACHER, email_verified: true }));
const unverifiedTeacher = () => db(env.authenticatedContext('t2', { email: TEACHER, email_verified: false }));
const otherGoogle = () => db(env.authenticatedContext('g', { email: 'someone@gmail.com', email_verified: true }));

function textMsg(authorId: string, text: string, extra: Record<string, unknown> = {}) {
  return {
    kind: 'text', authorId, authorName: authorId === A ? '김가' : '이나', ingredient: 'cheese',
    text, flagged: false, deleted: false, createdAt: serverTimestamp(), ...extra,
  };
}

/** Student message batch: message + rate/{sid}.at = request.time (+ optional flag). */
function sendBatch(
  d: Firestore,
  roomId: string,
  sid: string,
  msg: Record<string, unknown>,
  opts: { rate?: boolean; flag?: Record<string, unknown>; msgId?: string } = {},
) {
  const batch = writeBatch(d);
  const ref = opts.msgId ? doc(d, 'rooms', roomId, 'messages', opts.msgId) : doc(collection(d, 'rooms', roomId, 'messages'));
  batch.set(ref, msg);
  if (opts.rate !== false) batch.set(doc(d, 'rooms', roomId, 'rate', sid), { at: serverTimestamp() });
  if (opts.flag) batch.set(doc(d, 'flags', ref.id), opts.flag);
  return batch.commit();
}

const setRoom = (id: string, data: DocumentData) => seed((d) => updateDoc(doc(d, 'rooms', id), data));
const setRate = (sid: string, msAgo: number) =>
  seed((d) => setDoc(doc(d, 'rooms', 'R', 'rate', sid), { at: Timestamp.fromMillis(Date.now() - msAgo) }));

describe('로그인 안 한 사람', () => {
  test('students 목록 읽기 성공', () => assertSucceeds(getDocs(collection(anon(), 'students'))));
  test('rooms/R 읽기 실패', () => assertFails(getDoc(doc(anon(), 'rooms', 'R'))));
  test('settings/app 읽기 실패', () => assertFails(getDoc(doc(anon(), 'settings', 'app'))));
  test('students 쓰기 실패', () => assertFails(updateDoc(doc(anon(), 'students', C), { claimedGen: 1 })));
});

describe('학생 문서', () => {
  test('a가 자기 ingredient 바꾸기 성공', () =>
    assertSucceeds(updateDoc(doc(student(A), 'students', A), { ingredient: 'kimchi' })));
  test('a가 ingredient를 null로 바꾸기 성공', () =>
    assertSucceeds(updateDoc(doc(student(A), 'students', A), { ingredient: null })));
  test('a가 ingredient에 이상한 값 넣기 실패', () =>
    assertFails(updateDoc(doc(student(A), 'students', A), { ingredient: 'x'.repeat(200) })));
  test('a가 자기 name 바꾸기 실패', () =>
    assertFails(updateDoc(doc(student(A), 'students', A), { name: '해커' })));
  test('a가 자기 gen 바꾸기 실패', () =>
    assertFails(updateDoc(doc(student(A), 'students', A), { gen: 5 })));
  test('a가 자기 claimedGen 바꾸기 실패', () =>
    assertFails(updateDoc(doc(student(A), 'students', A), { claimedGen: null })));
  test('a가 b 문서 바꾸기 실패', () =>
    assertFails(updateDoc(doc(student(A), 'students', B), { ingredient: 'kimchi' })));
  test('a가 학생 만들기 실패', () =>
    assertFails(setDoc(doc(student(A), 'students', 'zzzzzzzzzzzz'), { name: 'x', order: 9, gen: 1, claimedGen: null, ingredient: null })));
  test('a가 학생 삭제 실패', () => assertFails(deleteDoc(doc(student(A), 'students', B))));
});

describe('c 가입', () => {
  test('c-1 계정으로 claimedGen 1 + ingredient 설정 성공', () =>
    assertSucceeds(updateDoc(doc(student(C, 1), 'students', C), { claimedGen: 1, ingredient: 'ramen' })));
  test('c-0(옛 세대) 계정으로는 실패', () =>
    assertFails(updateDoc(doc(student(C, 0), 'students', C), { claimedGen: 1 })));
  test('claimedGen을 gen과 다른 값으로 설정 실패', () =>
    assertFails(updateDoc(doc(student(C, 1), 'students', C), { claimedGen: 2 })));
  // Re-writing the same claimedGen is a no-op (Firestore drops unchanged keys), so the guard is
  // exercised by an already-claimed doc whose claimedGen the current account tries to change.
  test('이미 claimedGen이 있으면 실패', async () => {
    await seed((d) => updateDoc(doc(d, 'students', C), { gen: 2, claimedGen: 1 }));
    await assertFails(updateDoc(doc(student(C, 2), 'students', C), { claimedGen: 2, ingredient: 'ramen' }));
  });
  test('가입하면서 name 바꾸기 실패', () =>
    assertFails(updateDoc(doc(student(C, 1), 'students', C), { claimedGen: 1, name: '해커' })));
});

describe('암호 초기화 뒤 옛 세대', () => {
  test('a의 gen을 2로 올린 뒤 a-1로 R 메시지 읽기 실패', async () => {
    await seed((d) => updateDoc(doc(d, 'students', A), { gen: 2, claimedGen: null }));
    await assertFails(getDocs(collection(student(A, 1), 'rooms', 'R', 'messages')));
  });
  test('a의 gen을 2로 올린 뒤 a-1로 ingredient 바꾸기 실패', async () => {
    await seed((d) => updateDoc(doc(d, 'students', A), { gen: 2, claimedGen: null }));
    await assertFails(updateDoc(doc(student(A, 1), 'students', A), { ingredient: 'kimchi' }));
  });
  test('a의 gen을 2로 올린 뒤 a-2로는 R 메시지 읽기 성공', async () => {
    await seed((d) => updateDoc(doc(d, 'students', A), { gen: 2, claimedGen: null }));
    await assertSucceeds(getDocs(collection(student(A, 2), 'rooms', 'R', 'messages')));
  });
  test('명단에 없는 학생 이메일로 방 읽기 실패', () =>
    assertFails(getDoc(doc(student('zzzzzzzzzzzz'), 'rooms', 'R'))));
});

describe('방과 메시지 읽기', () => {
  test('a: R 방 문서 읽기 성공', () => assertSucceeds(getDoc(doc(student(A), 'rooms', 'R'))));
  test('a: Q 방 문서 읽기 실패', () => assertFails(getDoc(doc(student(A), 'rooms', 'Q'))));
  test('a: R 메시지 읽기 성공', () => assertSucceeds(getDocs(collection(student(A), 'rooms', 'R', 'messages'))));
  test('a: Q 메시지 읽기 실패', () => assertFails(getDocs(collection(student(A), 'rooms', 'Q', 'messages'))));
  test('a: rooms where members array-contains a 목록 성공', () =>
    assertSucceeds(getDocs(query(collection(student(A), 'rooms'), where('members', 'array-contains', A)))));
  test('a: rooms 전체 목록 실패', () => assertFails(getDocs(collection(student(A), 'rooms'))));
  test('a: settings/app 읽기 성공', () => assertSucceeds(getDoc(doc(student(A), 'settings', 'app'))));
  test('이메일 위조(도메인 다름) 계정은 R 읽기 실패', () =>
    assertFails(getDoc(doc(db(env.authenticatedContext('x', { email: `${A}-1@evil.com` })), 'rooms', 'R'))));
});

describe('a가 R에 메시지 쓰기', () => {
  test('message + rate batch 성공', () => assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '안녕하세요'))));
  test('500자 성공', () => assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '가'.repeat(500)))));
  test('authorId가 b면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(B, '안녕', { authorName: '김가' }))));
  test('authorName이 다른 학생 이름이면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕', { authorName: '이나' }))));
  test('501자 실패', () => assertFails(sendBatch(student(A), 'R', A, textMsg(A, '가'.repeat(501)))));
  test('"   " 실패', () => assertFails(sendBatch(student(A), 'R', A, textMsg(A, '   '))));
  test('빈 문자열 실패', () => assertFails(sendBatch(student(A), 'R', A, textMsg(A, ''))));
  test('flagged:false인데 원문 금지어 포함 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '아 씨발 진짜'))));
  test('여러 줄 안에 금지어가 있어도 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '첫 줄\n아 병신\n셋째 줄'))));
  test('flagged:true여도 원문 금지어 포함 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '아 씨발', { flagged: true }))));
  test('정상 한국어(시발점, 개발, 십분)는 성공', () =>
    assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '시발점에서 십분 걸려요. 개발 재밌다\n둘째 줄'))));
  test('deleted:true 실패', () => assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕', { deleted: true }))));
  test('createdAt이 서버 시각이 아니면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕', { createdAt: Timestamp.now() }))));
  test('필드가 더 있으면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕', { teacher: true }))));
  test('rate 없이 text 쓰기 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕'), { rate: false })));
  test('kind:fire 쓰기 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, 'off', { kind: 'fire' }))));
  test('Q(멤버 아님)에 쓰기 실패', () => assertFails(sendBatch(student(A), 'Q', A, textMsg(A, '안녕'))));
  test('옛 세대 계정으로 쓰기 실패', async () => {
    await seed((d) => updateDoc(doc(d, 'students', A), { gen: 2, claimedGen: null }));
    await assertFails(sendBatch(student(A, 1), 'R', A, textMsg(A, '안녕')));
  });
});

describe('도배', () => {
  test('rate/a.at가 0.5초 전이면 실패', async () => {
    await setRate(A, 500);
    await assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test('rate/a.at가 2초 전이면 성공', async () => {
    await setRate(A, 2000);
    await assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test('rate만 따로 과거 시각으로 되돌리기 실패', () =>
    assertFails(setDoc(doc(student(A), 'rooms', 'R', 'rate', A), { at: Timestamp.fromMillis(0) })));
  test('b의 rate 쓰기 실패', () =>
    assertFails(setDoc(doc(student(A), 'rooms', 'R', 'rate', B), { at: serverTimestamp() })));
});

describe('joined 메시지 (R6)', () => {
  const joined = (extra: Record<string, unknown> = {}) => ({
    kind: 'joined', authorId: A, authorName: '김가', ingredient: 'cheese',
    text: '', flagged: false, deleted: false, createdAt: serverTimestamp(), ...extra,
  });
  const jid = `joined-${A}-1`;
  test('rate 없이 joined 쓰기 성공', () =>
    assertSucceeds(sendBatch(student(A), 'R', A, joined(), { rate: false, msgId: jid })));
  test('불이 꺼져 있어도 joined 쓰기 성공', async () => {
    await setRoom('R', { fire: { manual: 'off', manualUntil: future() } });
    await assertSucceeds(sendBatch(student(A), 'R', A, joined(), { rate: false, msgId: jid }));
  });
  test('joined 문서 id가 정해진 모양이 아니면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, joined(), { rate: false, msgId: 'joined-x' })));
  test('joined를 같은 세대에 두 번 쓰기 실패', async () => {
    await assertSucceeds(sendBatch(student(A), 'R', A, joined(), { rate: false, msgId: jid }));
    await assertFails(sendBatch(student(A), 'R', A, joined(), { rate: false, msgId: jid }));
  });
  test('joined에 text가 있으면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, joined({ text: '안녕' }), { rate: false, msgId: jid })));
  test('joined가 flagged면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, joined({ flagged: true }), { rate: false, msgId: jid })));
  test('joined authorId가 b면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, joined({ authorId: B }), { rate: false, msgId: `joined-${B}-1` })));
  test('추방된 상태에서 joined 실패', async () => {
    await setRoom('R', { banned: [A] });
    await assertFails(sendBatch(student(A), 'R', A, joined(), { rate: false, msgId: jid }));
  });
});

describe('추방', () => {
  beforeEach(() => setRoom('R', { banned: [A] }));
  test('R 방 문서 읽기 성공(목록 표시용)', () => assertSucceeds(getDoc(doc(student(A), 'rooms', 'R'))));
  test('R 메시지 읽기 실패', () => assertFails(getDocs(collection(student(A), 'rooms', 'R', 'messages'))));
  test('R 메시지 쓰기 실패', () => assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕'))));
});

describe('불', () => {
  test("manual 'off'(manualUntil 미래)면 a 쓰기 실패", async () => {
    await setRoom('R', { fire: { manual: 'off', manualUntil: future() } });
    await assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test("manual 'off'(manualUntil null)면 a 쓰기 실패", async () => {
    await setRoom('R', { fire: { manual: 'off', manualUntil: null } });
    await assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test("manual 'off'가 지났으면(manualUntil 과거) 쓰기 성공", async () => {
    await setRoom('R', { fire: { manual: 'off', manualUntil: past() } });
    await assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test('스케줄 창 안이면 실패', async () => {
    await setRoom('R', { schedule: windowAroundNow() });
    await assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test('자정을 넘는 스케줄 창 안이면 실패', async () => {
    await setRoom('R', { schedule: wrappingWindowAroundNow() });
    await assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test('스케줄 창 안이어도 스케줄이 꺼져 있으면 성공', async () => {
    await setRoom('R', { schedule: { ...windowAroundNow(), enabled: false } });
    await assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test('offMin == onMin이면 창이 없어 성공', async () => {
    const now = minutesKST(Date.now());
    await setRoom('R', { schedule: { enabled: true, offMin: now, onMin: now } });
    await assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test("스케줄 창 안이어도 manual 'on'(미래까지)이면 성공", async () => {
    await setRoom('R', { schedule: windowAroundNow(), fire: { manual: 'on', manualUntil: future() } });
    await assertSucceeds(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test("스케줄 창 안이고 manual 'on'이 지났으면 실패", async () => {
    await setRoom('R', { schedule: windowAroundNow(), fire: { manual: 'on', manualUntil: past() } });
    await assertFails(sendBatch(student(A), 'R', A, textMsg(A, '안녕')));
  });
  test('선생님은 불 꺼져도 쓰기 성공', async () => {
    await setRoom('R', { fire: { manual: 'off', manualUntil: future() } });
    await assertSucceeds(
      setDoc(doc(collection(teacher(), 'rooms', 'R', 'messages')), {
        kind: 'text', authorId: 'teacher', authorName: '담임선생님', ingredient: null,
        text: '공지예요', flagged: false, deleted: false, createdAt: serverTimestamp(),
      }),
    );
  });
  test("선생님은 kind:'fire' 쓰기 성공", () =>
    assertSucceeds(
      setDoc(doc(collection(teacher(), 'rooms', 'R', 'messages')), {
        kind: 'fire', authorId: 'teacher', authorName: '담임선생님', ingredient: null,
        text: 'off', flagged: false, deleted: false, createdAt: serverTimestamp(),
      }),
    ));
  test('학생은 방의 fire 바꾸기 실패', () =>
    assertFails(updateDoc(doc(student(A), 'rooms', 'R'), { fire: { manual: 'on', manualUntil: null } })));
});

describe('flags', () => {
  const flag = (studentId: string, roomId = 'R') => ({
    roomId, studentId, original: '아 씨발', masked: '아 ＊＊', hits: ['씨발'], createdAt: serverTimestamp(),
  });
  const masked = () => textMsg(A, '아 ＊＊', { flagged: true });
  test('a가 메시지와 같은 batch에서 자기 flag 만들기 성공', () =>
    assertSucceeds(sendBatch(student(A), 'R', A, masked(), { flag: flag(A) })));
  test('b 이름으로 flag 만들기 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, masked(), { flag: flag(B) })));
  test('flag의 masked가 메시지와 다르면 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, masked(), { flag: { ...flag(A), masked: '다른 말' } })));
  test('메시지 없이 flag만 만들기 실패', () =>
    assertFails(setDoc(doc(student(A), 'flags', 'm1'), flag(A))));
  test('이미 있는 자기 메시지에 flag만 따로 만들기 실패', async () => {
    await seed((d) => updateDoc(doc(d, 'rooms', 'R', 'messages', 'm1'), { authorId: A, authorName: '김가', text: '아 ＊＊', flagged: true }));
    await assertFails(setDoc(doc(student(A), 'flags', 'm1'), flag(A)));
  });
  test('flagged가 아닌 메시지에 flag 만들기 실패', () =>
    assertFails(sendBatch(student(A), 'R', A, textMsg(A, '아 ＊＊'), { flag: flag(A) })));
  test('a가 flags 읽기 실패', () => assertFails(getDocs(collection(student(A), 'flags'))));
  test('선생님 flags 목록 읽기 성공', () => assertSucceeds(getDocs(collection(teacher(), 'flags'))));
});

describe('메시지 수정·삭제', () => {
  test('a가 자기 메시지 deleted:true 실패', async () => {
    await seed((d) => updateDoc(doc(d, 'rooms', 'R', 'messages', 'm1'), { authorId: A, authorName: '김가' }));
    await assertFails(updateDoc(doc(student(A), 'rooms', 'R', 'messages', 'm1'), { deleted: true }));
  });
  test('a가 자기 메시지 text 바꾸기 실패', async () => {
    await seed((d) => updateDoc(doc(d, 'rooms', 'R', 'messages', 'm1'), { authorId: A, authorName: '김가' }));
    await assertFails(updateDoc(doc(student(A), 'rooms', 'R', 'messages', 'm1'), { text: '고침' }));
  });
  test('선생님 deleted:true, text:"" 성공', () =>
    assertSucceeds(updateDoc(doc(teacher(), 'rooms', 'R', 'messages', 'm1'), { deleted: true, text: '' })));
  test('a가 메시지 삭제 실패', () => assertFails(deleteDoc(doc(student(A), 'rooms', 'R', 'messages', 'm1'))));
  test('선생님 메시지 삭제 성공', () => assertSucceeds(deleteDoc(doc(teacher(), 'rooms', 'R', 'messages', 'm1'))));
});

describe('선생님 계정', () => {
  test('rooms 생성 성공', () => assertSucceeds(setDoc(doc(teacher(), 'rooms', 'N'), room([A]))));
  test('rooms 수정 성공', () => assertSucceeds(updateDoc(doc(teacher(), 'rooms', 'R'), { banned: [A] })));
  test('rooms 삭제 성공', () => assertSucceeds(deleteDoc(doc(teacher(), 'rooms', 'R'))));
  test('rooms 전체 목록 성공', () => assertSucceeds(getDocs(collection(teacher(), 'rooms'))));
  test('students 생성 성공', () =>
    assertSucceeds(setDoc(doc(teacher(), 'students', 'dddddddddddd'), { name: '최라', order: 4, gen: 1, claimedGen: null, ingredient: null })));
  test('students 삭제 성공', () => assertSucceeds(deleteDoc(doc(teacher(), 'students', B))));
  test('students gen 수정 성공', () =>
    assertSucceeds(updateDoc(doc(teacher(), 'students', A), { gen: 2, claimedGen: null })));
  test('settings 쓰기 성공', () =>
    assertSucceeds(setDoc(doc(teacher(), 'settings', 'app'), { teacherName: '김선생님', extraWords: ['바보'] })));
  test('Q 메시지 읽기 성공', () => assertSucceeds(getDocs(collection(teacher(), 'rooms', 'Q', 'messages'))));
  test('email_verified false면 rooms 생성 실패', () =>
    assertFails(setDoc(doc(unverifiedTeacher(), 'rooms', 'N'), room([A]))));
  test('email_verified false면 students gen 수정 실패', () =>
    assertFails(updateDoc(doc(unverifiedTeacher(), 'students', A), { gen: 2 })));
  test('email_verified false면 settings 쓰기 실패', () =>
    assertFails(setDoc(doc(unverifiedTeacher(), 'settings', 'app'), { teacherName: 'x', extraWords: [] })));
  test('email_verified false면 flags 읽기 실패', () =>
    assertFails(getDocs(collection(unverifiedTeacher(), 'flags'))));
  test('다른 구글 계정은 rooms 생성 실패', () => assertFails(setDoc(doc(otherGoogle(), 'rooms', 'N'), room([A]))));
  test('학생은 rooms 생성 실패', () => assertFails(setDoc(doc(student(A), 'rooms', 'N'), room([A]))));
  test('학생은 settings 쓰기 실패', () =>
    assertFails(setDoc(doc(student(A), 'settings', 'app'), { teacherName: 'x', extraWords: [] })));
  test('학생은 자기를 members에 넣기 실패', () =>
    assertFails(updateDoc(doc(student(A), 'rooms', 'Q'), { members: [B, A] })));
  test('학생은 banned에서 자기 빼기 실패', async () => {
    await setRoom('R', { banned: [A] });
    await assertFails(updateDoc(doc(student(A), 'rooms', 'R'), { banned: [] }));
  });
});

describe('reads', () => {
  test('a가 reads/a 쓰기 성공', () =>
    assertSucceeds(setDoc(doc(student(A), 'rooms', 'R', 'reads', A), { at: serverTimestamp() })));
  test('a가 reads/a 읽기 성공', () => assertSucceeds(getDoc(doc(student(A), 'rooms', 'R', 'reads', A))));
  test('b가 reads/a 쓰기 실패', () =>
    assertFails(setDoc(doc(student(B), 'rooms', 'R', 'reads', A), { at: serverTimestamp() })));
  test('a가 Q(멤버 아님)의 reads/a 쓰기 실패', () =>
    assertFails(setDoc(doc(student(A), 'rooms', 'Q', 'reads', A), { at: serverTimestamp() })));
});
