// Fills the running emulators with a small demo class so the app can be looked at locally.
//   npx tsx scripts/seed-emulator.ts        (emulators must be running: npm run emulators)
// Students 김가은 / 이시우 / 최유나 have PIN 1234; 박서준 and 정예준 have not signed up yet.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc, type Firestore } from 'firebase/firestore';
import { authEmail, toAuthPassword } from '../src/domain/identity';

const PROJECT = 'demo-budae';
export const DEMO_PIN = '1234';

export const DEMO_STUDENTS = [
  { id: 'gaeun0000001', name: '김가은', ingredient: 'cheese', claimed: true },
  { id: 'siwoo0000002', name: '이시우', ingredient: 'ramen', claimed: true },
  { id: 'yuna00000003', name: '최유나', ingredient: 'watermelon', claimed: true },
  { id: 'seojun000004', name: '박서준', ingredient: null, claimed: false },
  { id: 'yejun0000005', name: '정예준', ingredient: null, claimed: false },
] as const;

const LONG_WORD = 'https://example.com/' + 'abcdefghij'.repeat(18);

async function wipe() {
  await Promise.all([
    fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' }),
  ]);
}

async function signUp(email: string, password: string) {
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  if (!res.ok) throw new Error(`signUp ${email}: ${res.status} ${await res.text()}`);
}

export async function seed() {
  await wipe();
  const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: 8080 } });
  const base = Date.now() - 3 * 3600_000;
  const at = (min: number) => Timestamp.fromMillis(base + min * 60_000);

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    let order = 1;
    for (const s of DEMO_STUDENTS)
      await setDoc(doc(db, 'students', s.id), { name: s.name, order: order++, gen: 1, claimedGen: s.claimed ? 1 : null, ingredient: s.ingredient });
    await setDoc(doc(db, 'settings', 'app'), { teacherName: '담임선생님', extraWords: [] });

    const ids = DEMO_STUDENTS.map((s) => s.id);
    const off = { enabled: false, offMin: 1320, onMin: 420 };
    await setDoc(doc(db, 'rooms', 'budae'), {
      name: '부대찌개반', emoji: '🍲', createdAt: at(0), members: ids, banned: [],
      fire: { manual: null, manualUntil: null }, schedule: off,
    });
    await setDoc(doc(db, 'rooms', 'science'), {
      name: '과학 모둠 3조', emoji: '🔬', createdAt: at(1), members: ids.slice(0, 3), banned: [],
      fire: { manual: 'off', manualUntil: null }, schedule: off,
    });
    await setDoc(doc(db, 'rooms', 'play'), {
      name: '학예회 준비', emoji: '🎭', createdAt: at(2), members: ids.slice(0, 2), banned: [ids[0]],
      fire: { manual: null, manualUntil: null }, schedule: off,
    });

    const [gaeun, siwoo, yuna] = DEMO_STUDENTS;
    type Who = (typeof DEMO_STUDENTS)[number] | 'teacher';
    let n = 0;
    const say = async (room: string, who: Who, text: string, extra: Record<string, unknown> = {}) => {
      const id = `seed${String(++n).padStart(3, '0')}`;
      const author = who === 'teacher'
        ? { authorId: 'teacher', authorName: '담임선생님', ingredient: null }
        : { authorId: who.id, authorName: who.name, ingredient: who.ingredient };
      await setDoc(doc(db, 'rooms', room, 'messages', id), {
        kind: 'text', ...author, text, flagged: false, deleted: false, createdAt: at(10 + n), ...extra,
      });
      return id;
    };

    for (const s of [gaeun, siwoo, yuna])
      await setDoc(doc(db, 'rooms', 'budae', 'messages', `joined-${s.id}-1`), {
        kind: 'joined', authorId: s.id, authorName: s.name, ingredient: s.ingredient, text: '', flagged: false, deleted: false, createdAt: at(5),
      });
    await say('budae', siwoo, '내일 현장체험학습 몇 시까지 와야 돼?');
    await say('budae', 'teacher', '8시 40분까지 운동장으로 오세요. 도시락 꼭 챙기고요! 🍱');
    const flaggedId = await say('budae', yuna, '아 진짜 ＊＊ 일찍이네 ㅋㅋ', { flagged: true });
    await setDoc(doc(db, 'flags', flaggedId), {
      roomId: 'budae', studentId: yuna.id, original: '아 진짜 씨발 일찍이네 ㅋㅋ', masked: '아 진짜 ＊＊ 일찍이네 ㅋㅋ', hits: ['씨발'], createdAt: at(13),
    });
    await say('budae', gaeun, '나 버스 같이 탈 사람!');
    await say('budae', siwoo, '나!! 🙋');
    await say('budae', yuna, '정문 앞에서 만나자');
    await say('budae', siwoo, '이거 봐봐 ' + LONG_WORD);
    await say('budae', gaeun, '', { deleted: true });
    for (let i = 1; i <= 12; i++) await say('budae', [gaeun, siwoo, yuna][i % 3], `준비물 ${i}번 챙겼어?`);
    await say('budae', 'teacher', '모두 내일 봐요 😊');

    await say('science', gaeun, '실험 보고서 다 썼어?');
    await say('science', siwoo, '아직 ㅠㅠ');
    await setDoc(doc(db, 'rooms', 'science', 'messages', 'fireoff'), {
      kind: 'fire', authorId: 'teacher', authorName: '담임선생님', ingredient: null, text: 'off', flagged: false, deleted: false, createdAt: at(60),
    });
  });
  await env.cleanup();

  for (const s of DEMO_STUDENTS) if (s.claimed) await signUp(authEmail(s.id, 1), toAuthPassword(DEMO_PIN));
}

if (process.argv[1]?.endsWith('seed-emulator.ts')) {
  await seed();
  console.log('seed: 학생 5명(김가은·이시우·최유나 암호 1234), 냄비 3개, 메시지를 넣었어요.');
}
