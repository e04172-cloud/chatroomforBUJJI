# 부대찌개반 대화방 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선생님 한 명과 학생 약 26명이 브라우저(노트북·핸드폰)로 쓰는 부대찌개 콘셉트의 실시간 대화방을 Firebase 무료 요금제 위에 만든다.

**Architecture:** 서버 코드 없는 정적 웹앱(React)이 Firebase Auth·Firestore·Realtime Database에 직접 붙는다. 모든 권한(선생님 전용 기능, 방 멤버십, 추방, 불 꺼짐, 도배 제한)은 보안 규칙에서 확인하고, 화면은 같은 판단을 순수 함수로 미리 보여주기만 한다. 순수 로직(불 상태, 욕설 필터, 학생 식별, 오늘의 부대찌개)은 `src/domain/`에 모아 단위 테스트하고, 보안 규칙은 에뮬레이터로 테스트한다.

**Tech Stack:** Node 24, TypeScript 5.6, React 18.3, Vite 5.4, react-router-dom 6, Firebase JS SDK 11, firebase-tools 13 (npx로 실행), Vitest 2, @testing-library/react 16, @firebase/rules-unit-testing 4, Playwright 1.48, 글꼴 Pretendard(jsDelivr CDN).

**Spec:** `docs/superpowers/specs/2026-10-21-budae-chat-design.md` (화면 시안: `docs/superpowers/specs/2026-10-21-budae-chat-mockup.html`)

## Global Constraints

- Firebase **Spark(무료) 요금제**만 쓴다. Cloud Functions, Admin SDK를 쓰지 않는다.
- 권한은 반드시 보안 규칙에서 확인한다. 화면에서만 숨기는 권한은 없다.
- IP로 사람을 구분하지 않는다.
- 시간 판단은 서버 시간(`request.time`) 기준 **KST(UTC+9)**로 한다. 학생 기기 시계를 믿지 않는다.
- 학생 암호는 **최소 4자리**다. Firebase는 6자 이상을 요구하므로 내부적으로 접두어를 붙인다(Task 2).
- 메시지는 공백만으로 이루어질 수 없고 **최대 500자**다. 학생은 **1초에 1개**까지 보낼 수 있다(선생님은 제외).
- 자동 불 끄기 기본값은 **22:00~07:00**, 매일 적용한다. 수동 조작은 **다음 자동 전환 시각까지만** 유지된다. 자동 기능이 꺼져 있으면 수동 상태가 계속된다.
- 재료는 스펙 4.6의 **30가지, 한 묶음**이다(표시 순서는 스펙 순서).
- UI 문구는 한국어, 스펙의 문구를 그대로 쓴다: "냄비에 퐁당! 입장하기", "⚠️ 국물이 탁해져요! 바르고 고운 말을 써요. 부적절한 표현은 가려서 보냈어요.", "주방장이 건져낸 메시지예요", "주방장이 냄비 불을 껐어요.", "이 냄비에서 잠시 나와 있어요", "방을 만들 권한이 없어요", 선생님 배지 "주방장", 선생님 기본 이름 "담임선생님", 선생님 프로필 🧑‍🍳.
- 색은 시안 CSS 변수를 그대로 쓴다: `--bg:#FFF8F1 --ink:#3A2520 --sub:#8A7068 --line:#F0E2D6 --broth:#D9481C --broth-deep:#B5370F --broth-soft:#FDEBE2 --cheese:#F5B82E --cheese-soft:#FFF4D6 --scallion:#4E9A51 --scallion-soft:#E8F4E6 --warn-soft:#FFF3E2 --danger:#C93A2B --danger-soft:#FBE7E4`, 불 꺼짐 띠 `#8A7A72→#6B5C55`.
- 모바일: 폭 **360px**부터 가로 스크롤 없음, 누르는 칸 최소 **44px**, 대화 화면 `100dvh` 고정 헤더·입력창, 키보드가 입력창을 가리지 않음, safe-area 반영(스펙 4.6.1).
- 학생이 읽을 수 있는 문서에는 가려지기 전 원래 문장을 절대 넣지 않는다.

## Review Focus

1. **다른 기기에서 접속 중일 때 암호가 초기화됨**: 이전 세대 계정의 요청은 규칙에서 거절되므로, 화면이 멈추지 않고 로그아웃한 뒤 "선생님이 암호를 초기화했어요. 다시 들어와 주세요."를 보여줘야 한다. → Task 8 테스트
2. **방을 보고 있는 중에 추방됨**: 실시간 구독이 권한 오류로 끊길 때 빈 화면이나 오류창이 아니라 방 목록으로 돌아가 "이 냄비에서 잠시 나와 있어요"를 보여줘야 한다. → Task 9 테스트
3. **정상 단어 오탐**: "시발점", "십분", "개발" 같은 일반 단어는 가려지면 안 된다. → Task 3 테스트
4. **한 학생이 노트북과 핸드폰으로 동시에 접속**: 접속자 수는 1로 세고, 한쪽을 닫아도 다른 쪽이 살아 있으면 계속 1이다. → Task 6 테스트
5. **공백만 있거나 아주 긴 메시지, 띄어쓰기 없는 긴 단어·링크**: 공백만 있으면 보내지 않고, 500자를 넘으면 입력이 막히며, 긴 단어는 말풍선 안에서 줄바꿈된다. → Task 7, Task 9, Task 12 테스트

---

## 파일 구조

```
package.json, vite.config.ts, tsconfig.json, index.html, .gitignore
firebase.json                    호스팅·에뮬레이터·규칙 파일 연결
firestore.rules.template         규칙 원본(__TEACHER_EMAIL__, __BANNED_REGEX__ 자리표시)
firestore.rules                  configure 스크립트가 생성(커밋하지 않음)
firestore.indexes.json
database.rules.json              Realtime Database(접속 표시) 규칙
scripts/configure.mjs            선생님 이메일·Firebase 설정을 받아 규칙/.env/.firebaserc 생성
src/main.tsx, src/App.tsx        라우팅: "/" 학생, "/teacher" 선생님
src/styles/theme.css             색 토큰, 공통 스타일, 모바일 규칙
src/domain/ingredients.ts        재료 30가지
src/domain/fire.ts               불 상태 계산
src/domain/filter.ts, wordlist.ts 욕설 필터
src/domain/identity.ts           학생 가짜 이메일·암호 변환
src/domain/pot.ts                오늘의 부대찌개 요약
src/data/firebase.ts             Firebase 초기화, 개발 시 에뮬레이터 연결
src/data/types.ts                문서 타입
src/data/students.ts, rooms.ts, messages.ts, presence.ts, settings.ts, flags.ts
src/components/                  PotHeader, Avatar, MessageList, MessageBubble, Composer, TodayPot, FireBanner, Sheet
src/student/                     JoinScreen, LobbyScreen, RoomScreen
src/teacher/                     TeacherLogin, TeacherHome, RosterPanel, RoomEditor, TeacherRoom, FlagLog, FilterSettings
tests/unit/                      Vitest 단위 테스트
tests/rules/                     에뮬레이터 규칙 테스트
tests/integration/               에뮬레이터 대상 data 계층 테스트
tests/e2e/                       Playwright 화면·모바일 테스트
docs/설치안내.md                  선생님용 설치·배포 안내서
```

## 데이터 구조 (모든 Task가 공유)

```ts
// src/data/types.ts
export type IngredientKey = string;            // ingredients.ts의 key
export interface Student {                     // students/{studentId}  (로그인 전에도 읽기 가능)
  name: string; order: number;
  gen: number;                                 // 암호 초기화마다 +1
  claimedGen: number | null;                   // 가입하면 gen과 같아짐
  ingredient: IngredientKey | null;
}
export interface Room {                        // rooms/{roomId}
  name: string; emoji: string; createdAt: Timestamp;
  members: string[]; banned: string[];         // studentId 목록
  fire: { manual: 'on' | 'off' | null; manualUntil: Timestamp | null };
  schedule: { enabled: boolean; offMin: number; onMin: number }; // KST 자정 기준 분, 기본 1320 / 420
}
export interface Message {                     // rooms/{roomId}/messages/{msgId}
  kind: 'text' | 'joined' | 'fire';
  authorId: string;                            // studentId 또는 'teacher'
  authorName: string; ingredient: IngredientKey | null;  // 명단 삭제 후에도 표시하려고 복사
  text: string;                                // 가려진 문장. kind='fire'면 'on'|'off'
  flagged: boolean; deleted: boolean; createdAt: Timestamp;
}
export interface Flag {                        // flags/{msgId}  (선생님만 읽기)
  roomId: string; studentId: string; original: string; masked: string; hits: string[]; createdAt: Timestamp;
}
// rooms/{roomId}/rate/{studentId}  { at: Timestamp }   도배 제한용
// rooms/{roomId}/reads/{studentId} { at: Timestamp }   안 읽은 수용
// settings/app  { teacherName: string; extraWords: string[] }
// RTDB /presence/{roomId}/{studentId}/{connId} = true
```

---

### Task 1: 프로젝트 뼈대와 재료 목록

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/domain/ingredients.ts`, `firebase.json`
- Test: `tests/unit/ingredients.test.ts`

**Interfaces:**
- Produces: `INGREDIENTS: readonly { key: string; emoji: string; label: string; classic: boolean }[]`, `ingredientByKey(key: string): Ingredient | undefined`. npm 스크립트 `test`(vitest run tests/unit), `test:rules`, `test:int`, `test:e2e`, `dev`, `build`, `emulators`(`npx firebase emulators:start --only auth,firestore,database,hosting`).

- [ ] **Step 1: 준비물 설치 확인**
  Firestore 에뮬레이터에 Java가 필요하다(현재 PC에 없음). 실행: `winget install EclipseAdoptium.Temurin.21.JDK` 후 새 셸에서 `java -version` → `21`이 보여야 한다. `git init`, `.gitignore`에 `node_modules dist .env firestore.rules .firebaserc .superpowers test-results` 추가.
- [ ] **Step 2: Vite React TS 앱 생성**, 위 의존성 설치(`firebase-tools`는 devDependency). `firebase.json`: hosting `dist`, SPA rewrite `** → /index.html`, firestore rules `firestore.rules`, database rules `database.rules.json`, emulators auth 9099 / firestore 8080 / database 9000 / hosting 5000 / ui 사용.
- [ ] **Step 3: 실패하는 테스트 작성**
```ts
test('재료는 30가지이고 스펙 순서다', () => {
  expect(INGREDIENTS).toHaveLength(30);
  expect(INGREDIENTS[0]).toMatchObject({ emoji: '🌭', label: '소시지', classic: true });
  expect(INGREDIENTS[15]).toMatchObject({ emoji: '🧈', label: '두부', classic: true });
  expect(INGREDIENTS[16]).toMatchObject({ emoji: '🍫', label: '초콜릿', classic: false });
  expect(INGREDIENTS[29]).toMatchObject({ emoji: '🥤', label: '콜라', classic: false });
  expect(new Set(INGREDIENTS.map(i => i.key)).size).toBe(30);
});
```
- [ ] **Step 4: `npm test` → FAIL**
- [ ] **Step 5: `ingredients.ts` 작성**: 스펙 4.6 순서 그대로, 앞 16개 classic=true. key는 영문 소문자(`sausage`, `spam`, … `cola`).
- [ ] **Step 6: `npm test` → PASS, `npm run build` → 성공**
- [ ] **Step 7: Commit** `feat: scaffold app and ingredient list`

### Task 2: 불 상태 계산과 학생 식별 헬퍼

**Files:**
- Create: `src/domain/fire.ts`, `src/domain/identity.ts`
- Test: `tests/unit/fire.test.ts`, `tests/unit/identity.test.ts`

**Interfaces:**
- Produces:
  - `minutesKST(ms: number): number` (0~1439)
  - `inOffWindow(min: number, offMin: number, onMin: number): boolean`
  - `isFireOn(room: Pick<Room,'fire'|'schedule'>, nowMs: number): boolean` (Timestamp 대신 `manualUntil`을 ms로 받는 `FireInput` 타입을 써도 됨. 이름은 `FireInput`으로 고정)
  - `nextBoundary(schedule: Room['schedule'], nowMs: number): number | null`
  - `manualFire(state: 'on'|'off', schedule, nowMs): { manual; manualUntil: number | null }`
  - `nextChangeLabel(room, nowMs): string | null` → 예: `"아침 7시에 켜져요"`
  - `STUDENT_EMAIL_DOMAIN = 'students.budae.invalid'`, `authEmail(studentId: string, gen: number): string` → `${studentId}-${gen}@students.budae.invalid`
  - `parseAuthEmail(email: string): { studentId: string; gen: number } | null`
  - `toAuthPassword(pin: string): string` → `'budae!' + pin`
  - `validatePin(pin: string): string | null` (4자 미만이면 `"암호는 4자리 이상이에요"`, 아니면 null)
  - `newStudentId(): string`: 12자리 영문 소문자·숫자, `-` 없음

- [ ] **Step 1: 실패하는 테스트 작성**(시각은 KST. `kst('2026-10-21T23:00')` 헬퍼로 ms 생성)
```ts
const S = { enabled: true, offMin: 1320, onMin: 420 };
test('자정을 넘는 창', () => {
  expect(inOffWindow(1319, 1320, 420)).toBe(false);
  expect(inOffWindow(1320, 1320, 420)).toBe(true);
  expect(inOffWindow(0, 1320, 420)).toBe(true);
  expect(inOffWindow(419, 1320, 420)).toBe(true);
  expect(inOffWindow(420, 1320, 420)).toBe(false);
});
test('23:00 수동 켜기는 07:00까지, 그날 22:00엔 다시 꺼짐', () => {
  const f = manualFire('on', S, kst('2026-10-21T23:00'));
  expect(f.manualUntil).toBe(kst('2026-10-22T07:00'));
  const room = { fire: f, schedule: S };
  expect(isFireOn(room, kst('2026-10-22T06:59'))).toBe(true);
  expect(isFireOn(room, kst('2026-10-22T12:00'))).toBe(true);
  expect(isFireOn(room, kst('2026-10-22T22:00'))).toBe(false);
});
test('14:00 수동 끄기는 22:00까지 이어지고 07:00에 켜짐', () => {
  const f = manualFire('off', S, kst('2026-10-21T14:00'));
  expect(f.manualUntil).toBe(kst('2026-10-21T22:00'));
  const room = { fire: f, schedule: S };
  expect(isFireOn(room, kst('2026-10-21T21:59'))).toBe(false);
  expect(isFireOn(room, kst('2026-10-22T03:00'))).toBe(false);
  expect(isFireOn(room, kst('2026-10-22T07:00'))).toBe(true);
});
test('자동 기능이 꺼져 있으면 수동 상태가 계속된다', () => {
  const off = { enabled: false, offMin: 1320, onMin: 420 };
  const f = manualFire('off', off, kst('2026-10-21T14:00'));
  expect(f.manualUntil).toBeNull();
  expect(isFireOn({ fire: f, schedule: off }, kst('2026-10-30T12:00'))).toBe(false);
});
test('nextChangeLabel', () => {
  expect(nextChangeLabel({ fire: { manual: null, manualUntil: null }, schedule: S }, kst('2026-10-21T23:00'))).toBe('아침 7시에 켜져요');
});
// identity
test('가짜 이메일 왕복', () => {
  expect(authEmail('abc123def456', 2)).toBe('abc123def456-2@students.budae.invalid');
  expect(parseAuthEmail('abc123def456-2@students.budae.invalid')).toEqual({ studentId: 'abc123def456', gen: 2 });
  expect(parseAuthEmail('teacher@gmail.com')).toBeNull();
});
test('암호', () => {
  expect(validatePin('123')).toBe('암호는 4자리 이상이에요');
  expect(validatePin('1234')).toBeNull();
  expect(toAuthPassword('1234')).toHaveLength(10);
});
test('studentId에는 -가 없다', () => { expect(newStudentId()).toMatch(/^[a-z0-9]{12}$/); });
```
- [ ] **Step 2: `npm test` → FAIL**
- [ ] **Step 3: `fire.ts`, `identity.ts` 구현**. `minutesKST = Math.floor(ms / 60000 + 540) mod 1440`(음수 없게). `nextBoundary`는 now 다음 분부터 offMin·onMin 중 가장 가까운 시각을 분 단위로 계산한다(반복문 없이 두 후보의 "다음 발생"을 구해 작은 값). `isFireOn`: 수동이 있고 `manualUntil`이 null이거나 now보다 크면 수동 상태, 아니면 스케줄. `offMin === onMin`이면 창이 없는 것으로 본다. 라벨 형식: `오전/아침 H시`(5~11시 "아침", 12~17시 "오후", 18~23시 "밤", 0~4시 "새벽"), 분이 0이 아니면 `H시 M분`.
- [ ] **Step 4: `npm test` → PASS**
- [ ] **Step 5: Commit** `feat: fire schedule and student identity helpers`

### Task 3: 욕설 필터

**Files:**
- Create: `src/domain/wordlist.ts`, `src/domain/filter.ts`
- Test: `tests/unit/filter.test.ts`

**Interfaces:**
- Produces: `BASE_WORDS: string[]`, `ALLOW_WORDS: string[]`, `maskText(text: string, extraWords?: string[]): { masked: string; flagged: boolean; hits: string[] }`, `bannedRegexSource(): string`(규칙 파일용. `BASE_WORDS`를 RE2 호환 `.*(a|b|…).*` 형태로, configure 스크립트가 사용)

- [ ] **Step 1: 실패하는 테스트 작성**
```ts
test('기본 욕설은 같은 길이의 ＊로 가린다', () => {
  expect(maskText('아 진짜 씨발 일찍이네')).toEqual({ masked: '아 진짜 ＊＊ 일찍이네', flagged: true, hits: ['씨발'] });
});
test('띄어쓰기·특수문자·숫자를 섞은 변형도 잡는다', () => {
  for (const t of ['씨 발', '씨1발', '씨.발', 'ㅅㅂ', 'ㅆㅂ', '시bal'])
    expect(maskText(t).flagged).toBe(true);
  expect(maskText('씨 발').masked).toBe('＊＊＊');   // 사이 문자까지 가림
});
test('정상 단어는 가리지 않는다', () => {
  for (const t of ['시발점에서 출발', '십분만 기다려', '개발자가 될래', '수박씨 발라 먹자'])
    expect(maskText(t)).toMatchObject({ flagged: false });
});
test('선생님이 추가한 단어', () => {
  expect(maskText('너 바보야', ['바보']).masked).toBe('너 ＊＊야');
});
test('깨끗한 문장은 그대로', () => { expect(maskText('도시락 챙겨요 🍱')).toEqual({ masked: '도시락 챙겨요 🍱', flagged: false, hits: [] }); });
```
- [ ] **Step 2: `npm test` → FAIL**
- [ ] **Step 3: 구현**. `wordlist.ts`에 흔한 한국어 욕설·비속어와 초성 약어(약 60~100개), 오탐 방지 `ALLOW_WORDS`(시발점, 시발역, 십분, 개발, 수박씨 등). 방법: 원문 각 글자에 원래 위치를 붙인 "정규화 문자열"을 만든다(공백·숫자·문장부호 제거, 소문자화, 흔한 로마자 음차 `bal→발`, `si→시`, `ssi→씨` 치환). 먼저 정규화 문자열에서 `ALLOW_WORDS`가 차지하는 구간을 보호하고, 나머지에서 금지어를 찾는다. 찾은 구간의 원래 첫 위치~끝 위치를 원문에서 `＊`로 바꾼다.
- [ ] **Step 4: `npm test` → PASS**
- [ ] **Step 5: Commit** `feat: korean profanity mask with variants and allowlist`

### Task 4: 오늘의 부대찌개 요약

**Files:**
- Create: `src/domain/pot.ts`
- Test: `tests/unit/pot.test.ts`

**Interfaces:**
- Consumes: `INGREDIENTS`, `ingredientByKey` (Task 1)
- Produces: `summarizePot(ingredientKeys: (string|null)[], maxChips = 7): { chips: { emoji: string; count: number; classic: boolean }[]; moreKinds: number; verdict: { emoji: '😋'|'🤔'|'🤢'; label: '맛있음'|'애매'|'위험' } | null }`, `joinedLine(name: string, ingredientKey: string): string`

- [ ] **Step 1: 실패하는 테스트 작성**
```ts
test('많은 순으로 묶고 나머지는 외 n종', () => {
  const r = summarizePot(['sausage','sausage','ramen','choco',null], 2);
  expect(r.chips).toEqual([{ emoji:'🌭', count:2, classic:true }, { emoji:'🍜', count:1, classic:true }]);
  expect(r.moreKinds).toBe(1);
});
test('이상한 재료 비율로 맛 평가', () => {
  expect(summarizePot(['sausage','ramen','cheese','kimchi','spam']).verdict?.emoji).toBe('😋');   // 0%
  expect(summarizePot(['sausage','ramen','choco']).verdict?.emoji).toBe('🤔');                   // 33%
  expect(summarizePot(['sausage','choco','watermelon']).verdict?.emoji).toBe('🤢');              // 67%
  expect(summarizePot([null, null]).verdict).toBeNull();
});
test('입장 안내', () => {
  expect(joinedLine('김도윤','cheese')).toBe('🧀 김도윤 님이 냄비에 들어왔어요');
  expect(joinedLine('김도윤','watermelon')).toBe('🍉 김도윤(수박) 님이 냄비에 들어왔어요… 괜찮을까?');
});
```
- [ ] **Step 2: FAIL 확인 → Step 3: 구현**(비율 = 이상한 재료 수 / 재료를 고른 사람 수. 0.2 미만 😋, 0.5 미만 🤔, 그 이상 🤢. 같은 개수면 INGREDIENTS 순서) **→ Step 4: PASS 확인**
- [ ] **Step 5: Commit** `feat: today's pot summary`

### Task 5: 보안 규칙과 configure 스크립트

**Files:**
- Create: `firestore.rules.template`, `database.rules.json`, `firestore.indexes.json`, `scripts/configure.mjs`
- Test: `tests/rules/firestore.rules.test.ts`, `tests/rules/database.rules.test.ts`

**Interfaces:**
- Consumes: `bannedRegexSource()` (Task 3), 이메일 형식 (Task 2), 데이터 구조
- Produces: `node scripts/configure.mjs --teacher <email> --project <projectId> [--test]`. `firestore.rules`, `.firebaserc`, `.env.local`(VITE_FIREBASE_* 값을 묻거나 `--config <json파일>`로 받음)를 만든다. `--test`는 `teacher@test.com`, 프로젝트 `demo-budae`로 생성한다. `npm run test:rules` = `node scripts/configure.mjs --test && npx firebase emulators:exec --only firestore,database "vitest run tests/rules"`.

규칙에 반드시 들어갈 판단(이름 고정, 다른 Task의 테스트도 이 동작을 가정함):
- `isTeacher()`: `request.auth.token.email == '__TEACHER_EMAIL__' && request.auth.token.email_verified == true`
- `me()`: 이메일 앞부분 `split('-')`로 studentId·gen. `isStudent(sid)`: 그 studentId이고 `int(gen) == get(students/sid).data.gen`
- `fireOn(room)`: Task 2 `isFireOn`과 같은 계산. KST 분 = `math.floor(request.time.toMillis() / 60000 + 540) % 1440`

- [ ] **Step 1: 실패하는 Firestore 규칙 테스트 작성**. 픽스처: 학생 a(gen 1, 가입), b(gen 1, 가입), c(미가입), 방 R(members [a,b], banned [], 불 켜짐), 방 Q(members [b]). 각 테스트는 `assertSucceeds`/`assertFails` 하나:
  - 로그인 안 한 사람: `students` 목록 읽기 성공, `rooms/R` 읽기 실패, `settings/app` 읽기 실패
  - 학생 a: 자기 `ingredient` 바꾸기 성공 / 자기 `name`·`gen` 바꾸기 실패 / b의 문서 바꾸기 실패
  - c 가입: `c-1@…` 계정으로 `claimedGen: 1` 설정 성공 / `c-0@…`(옛 세대)로는 실패 / 이미 claimedGen이 있으면 실패
  - **암호 초기화 뒤 옛 세대**: a의 gen을 2로 올린 뒤 `a-1@…`로 R 메시지 읽기 실패
  - a: R 방 문서 읽기 성공, R 메시지 읽기 성공, Q 메시지 읽기 실패, `rooms` where members array-contains a 목록 성공
  - a가 R에 메시지 쓰기(batch: message + rate/a.at=request.time): 성공 / `authorId`가 b면 실패 / 501자 실패 / `"   "` 실패 / `flagged:false`인데 원문 금지어 포함 실패 / `deleted:true` 실패
  - 도배: rate/a.at가 0.5초 전이면 실패, 2초 전이면 성공
  - a가 banned에 있으면: R 방 문서 읽기 성공(목록 표시용), 메시지 읽기·쓰기 실패
  - 불: manual 'off'(manualUntil 미래)면 a 쓰기 실패 / 스케줄 창 안이면 실패 / 선생님은 불 꺼져도 쓰기 성공
  - flags: a가 자기 studentId로 메시지와 같은 batch에서 `flags/{msgId}` 만들기 성공 / 읽기 실패 / b 이름으로 만들기 실패. 선생님 목록 읽기 성공
  - 메시지 수정: a가 자기 메시지 `deleted:true` 실패, 선생님 `deleted:true, text:''` 성공
  - 선생님 계정(email_verified true): rooms 생성·수정·삭제, students 생성·삭제·gen 수정, settings 쓰기 성공. **같은 이메일이지만 email_verified false**면 실패. 다른 구글 계정은 rooms 생성 실패
  - reads/a: a 쓰기 성공, b가 reads/a 쓰기 실패
- [ ] **Step 2: RTDB 규칙 테스트 작성**: `/presence/R/a/conn1`을 a가 쓰기 성공, b가 쓰기 실패, 로그인한 사람은 읽기 성공, 로그인 안 하면 읽기 실패.
- [ ] **Step 3: `npm run test:rules` → FAIL**
- [ ] **Step 4: `firestore.rules.template`, `database.rules.json`, `configure.mjs` 구현**. 규칙의 금지어 정규식은 configure가 `bannedRegexSource()`로 채운다(스크립트는 `tsx`나 빌드된 모듈로 `wordlist.ts`를 불러온다). 인덱스: messages `createdAt` 오름차순(단일 필드면 자동이므로 필요한 것만).
- [ ] **Step 5: `npm run test:rules` → 전부 PASS**
- [ ] **Step 6: Commit** `feat: firestore and rtdb security rules with emulator tests`

### Task 6: 데이터 계층

**Files:**
- Create: `src/data/firebase.ts`, `src/data/types.ts`, `src/data/students.ts`, `src/data/rooms.ts`, `src/data/messages.ts`, `src/data/presence.ts`, `src/data/settings.ts`, `src/data/flags.ts`
- Test: `tests/integration/*.test.ts` (`npm run test:int` = configure --test 후 `emulators:exec --only auth,firestore,database "vitest run tests/integration"`)

**Interfaces:**
- Consumes: Task 2 identity·fire, Task 3 `maskText`, Task 4 `joinedLine`, Task 5 규칙
- Produces (모두 async, 실패 시 아래 이름의 Error 서브클래스를 던짐):
  - `firebase.ts`: `app, auth, db, rtdb`. `import.meta.env.VITE_USE_EMULATORS === '1'`이면 에뮬레이터 연결
  - `students.ts`: `watchRoster(cb: (list: (Student & {id})[]) => void): Unsubscribe`, `claimStudent(id, pin, ingredient): Promise<void>`(가입 → claimedGen 설정 → 속한 방마다 `kind:'joined'` 메시지. 이미 가입된 이름이면 `NameTakenError`), `loginStudent(id, pin)`(`WrongPinError`, `TooManyTriesError`), `currentStudent(): {id, gen} | null`, `setIngredient(key)`, `logout()`, 선생님용 `addStudent(name)`, `removeStudent(id)`(방 members·banned에서도 제거), `resetPin(id)`(gen+1, claimedGen null)
  - `rooms.ts`: `watchMyRooms(studentId, cb)`, `watchAllRooms(cb)`, `watchRoom(roomId, cb, onDenied)`, `createRoom({name, emoji, members})`(기본 schedule `{enabled:true, offMin:1320, onMin:420}`, fire 수동 없음), `updateRoomMembers(roomId, members)`, `deleteRoom(roomId)`(메시지 포함), `ban(roomId, sid)`, `unban(roomId, sid)`, `setFire(roomId, 'on'|'off')`(Task 2 `manualFire` 사용 + `kind:'fire'` 메시지), `setSchedule(roomId, schedule)`
  - `messages.ts`: `watchMessages(roomId, cb, onDenied, limit = 200)`, `sendMessage(roomId, text, me: {id, name, ingredient} | 'teacher'): Promise<{ flagged: boolean }>`(trim 후 빈 문자열이면 보내지 않고 `{flagged:false}`; 학생이면 `maskText` → message + rate + (flagged면 flags) 한 batch), `deleteMessage(roomId, msgId)`, `markRead(roomId, sid)`, `unreadCount(roomId, sid): Promise<number>`
  - `presence.ts`: `joinPresence(roomId, sid): () => void`(onDisconnect 제거), `watchOnlineCount(roomId, cb: (n: number) => void)`(studentId 개수)
  - `settings.ts`: `watchSettings(cb)`, `setTeacherName(name)`, `setExtraWords(words)`
  - `flags.ts`: `watchFlags(cb, filter?: {studentId?: string})`, `watchFlagsForRoom(roomId, cb): Map<msgId, Flag>`
  - `teacherSignIn()`(Google 팝업. 실패 시 리디렉트), `isTeacherUser(user): boolean`(이메일 == `VITE_TEACHER_EMAIL`, 화면 분기용일 뿐)

- [ ] **Step 1: 실패하는 통합 테스트 작성** (에뮬레이터, 선생님은 `signInWithCredential(GoogleAuthProvider.credential('{"sub":"t","email":"teacher@test.com","email_verified":true}'))`로 로그인):
  - 가입 흐름: addStudent → claimStudent → 같은 이름으로 다시 claimStudent하면 `NameTakenError` → loginStudent 성공 → 틀린 암호 `WrongPinError`
  - resetPin 뒤 옛 암호 로그인 실패, 새로 claimStudent 성공
  - sendMessage('아 씨발') → 저장된 text `'아 ＊＊'`, flagged true, 선생님이 `watchFlags`로 original `'아 씨발'`을 받음. 학생이 flags 읽기 시도 → 권한 오류
  - sendMessage('   ') → 아무 문서도 생기지 않음
  - setFire('off') 뒤 학생 sendMessage → 권한 오류. 이때 `FireOffError`로 바꿔 던짐
  - ban 뒤 watchMessages의 onDenied 호출
  - **동시 접속**: 같은 학생 두 연결이 joinPresence → count 1, 하나 끊으면 여전히 1, 둘 다 끊으면 0
  - removeStudent 뒤 그 학생의 기존 메시지 authorName 유지
  - unreadCount: markRead 후 메시지 2개 → 2
- [ ] **Step 2: `npm run test:int` → FAIL**
- [ ] **Step 3: 구현**. 권한 오류(`permission-denied`)는 원인별 Error로 바꾼다: 불 꺼짐 → `FireOffError`, 도배 → `TooFastError`(화면에 "조금 천천히 보내요"), 세대 불일치 → `SessionExpiredError`. 원인은 마지막으로 받은 room/student 스냅샷으로 판단한다.
- [ ] **Step 4: `npm run test:int` → PASS**
- [ ] **Step 5: Commit** `feat: firebase data layer`

### Task 7: 디자인 토큰과 공통 컴포넌트

**Files:**
- Create: `src/styles/theme.css`, `src/components/PotHeader.tsx`, `Avatar.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `Composer.tsx`, `TodayPot.tsx`, `FireBanner.tsx`, `Sheet.tsx`
- Test: `tests/unit/components.test.tsx`

**Interfaces:**
- Consumes: Task 1 재료, Task 4 `summarizePot`
- Produces (props 이름 고정):
  - `PotHeader({ title, subtitle, logo, fireOn, right?: ReactNode })`: 불 켜짐이면 국물 그라데이션 + 물결 + 일렁이는 🔥, 꺼짐이면 회갈색 + 💤
  - `Avatar({ ingredient?: string | null; teacher?: boolean; size?: 32 | 40 })`
  - `MessageBubble({ msg: Message; mine: boolean; teacherView?: boolean; original?: string; onDelete?: () => void })`: 삭제된 메시지는 "주방장이 건져낸 메시지예요". `teacherView && original`이면 원래 문장을 보여주고 걸린 부분을 강조하며 "가려짐" 꼬리표를 붙인다
  - `MessageList({ messages, renderItem })`: 새 메시지가 오면 맨 아래에 있을 때만 자동 스크롤
  - `Composer({ disabled: boolean; disabledText?: string; onSend: (text) => Promise<void>; leading?: ReactNode })`: 최대 500자(`maxLength`), 공백만 있으면 보내기 버튼 비활성, Enter 보내기 / Shift+Enter 줄바꿈(한글 조합 중 Enter 무시: `isComposing`)
  - `TodayPot({ ingredientKeys })`: 좁은 화면에서 한 줄, 넘치면 가로 스크롤(줄바꿈 금지)
  - `FireBanner({ nextLabel: string | null })`, `Sheet({ open, onClose, children })`(모바일 아래에서 올라오는 창)

- [ ] **Step 1: 실패하는 테스트 작성**
```tsx
test('삭제된 메시지 문구', () => { render(<MessageBubble msg={{...base, deleted:true, text:''}} mine={false}/>); expect(screen.getByText('주방장이 건져낸 메시지예요')).toBeInTheDocument(); });
test('선생님 화면은 원래 문장을 보인다', () => { render(<MessageBubble msg={{...base, text:'아 ＊＊', flagged:true}} mine={false} teacherView original="아 씨발"/>); expect(screen.getByText(/씨발/)).toBeInTheDocument(); expect(screen.getByText('가려짐')).toBeInTheDocument(); });
test('공백만 있으면 보내기 비활성', async () => { render(<Composer disabled={false} onSend={vi.fn()}/>); await userEvent.type(screen.getByRole('textbox'), '   '); expect(screen.getByRole('button', {name:'보내기'})).toBeDisabled(); });
test('불 꺼짐이면 입력 잠김', () => { render(<Composer disabled disabledText="💤 불이 꺼져 있어서 쓸 수 없어요" onSend={vi.fn()}/>); expect(screen.getByRole('textbox')).toBeDisabled(); });
test('한글 조합 중 Enter는 보내지 않는다', ...);   // fireEvent.keyDown(textbox, {key:'Enter', isComposing:true}) → onSend 호출 0회
```
- [ ] **Step 2: FAIL → Step 3: 구현**. `theme.css`: Global Constraints의 토큰, 시안 v5의 모양(말풍선 모서리, 배지, 칩), `body{overflow-x:hidden}`, 말풍선 `overflow-wrap:anywhere`, 앱 셸 `height:100dvh` + `env(safe-area-inset-*)` 패딩, 입력창 글자 16px 이상(iOS 확대 방지). index.html viewport에 `viewport-fit=cover, interactive-widget=resizes-content`. **→ Step 4: PASS**
- [ ] **Step 5: Commit** `feat: design tokens and shared chat components`

### Task 8: 학생 입장 화면

**Files:**
- Create: `src/student/JoinScreen.tsx`, `src/student/StudentApp.tsx`(로그인 상태에 따라 Join/Lobby/Room 전환)
- Test: `tests/unit/join.test.tsx` (data 계층은 vi.mock)

**Interfaces:**
- Consumes: `watchRoster`, `claimStudent`, `loginStudent`, `currentStudent`, `SessionExpiredError` (Task 6), 재료 (Task 1)
- Produces: `StudentApp` (라우트 "/"), localStorage 키 `budae.lastStudentId`(try/catch로 감쌈)

화면: 시안 ①. 이름 칸(가입한 이름은 ✔), 미가입 이름을 고르면 재료 30칸(5열, 360px에서도 칸 ≥44px) + 암호 + 미리보기 + "냄비에 퐁당! 입장하기". 가입한 이름을 고르면 암호 칸과 "들어가기"만.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 미가입 이름 클릭 → 재료 칸 30개 보임, 재료를 안 고르면 입장 버튼 비활성
  - 암호 3자리 → "암호는 4자리 이상이에요"
  - 가입한 이름 클릭 → 재료 칸 없이 암호만, loginStudent 호출
  - claimStudent가 `NameTakenError` → "방금 다른 사람이 이 이름으로 들어갔어요. 선생님께 말해 주세요." + 로그인 모드로 바뀜
  - `WrongPinError` → "암호가 맞지 않아요", `TooManyTriesError` → "너무 많이 틀렸어요. 잠시 후 다시 해 보세요."
  - localStorage에 `budae.lastStudentId`가 있으면 그 이름이 미리 선택됨, localStorage가 예외를 던져도 화면이 뜸
  - **Review Focus 1**: 로그인 상태에서 data 계층이 `SessionExpiredError`를 알리면 → 로그아웃 + "선생님이 암호를 초기화했어요. 다시 들어와 주세요."
- [ ] **Step 2: FAIL → Step 3: 구현 → Step 4: PASS**
- [ ] **Step 5: Commit** `feat: student join and login screen`

### Task 9: 학생 냄비 목록과 대화방

**Files:**
- Create: `src/student/LobbyScreen.tsx`, `src/student/RoomScreen.tsx`
- Test: `tests/unit/lobby.test.tsx`, `tests/unit/room.test.tsx`

**Interfaces:**
- Consumes: `watchMyRooms`, `watchRoom`, `watchMessages`, `sendMessage`, `markRead`, `unreadCount`, `joinPresence`, `watchOnlineCount`, `watchRoster`, `watchSettings`, `setIngredient`, `logout` (Task 6). Task 2 `isFireOn`, `nextChangeLabel`. Task 7 컴포넌트

목록(시안 ⑤): 방 이름, 이모지, 인원, 🔥 보글보글 / 💤 불 꺼짐, 안 읽은 수 배지. 추방된 방은 흐리게 "이 냄비에서 잠시 나와 있어요", 누를 수 없음.
대화방(시안 ②③): PotHeader(`{n}명 · 🔥 지금 {online}명 보글보글`), TodayPot, 메시지, Composer. 헤더 오른쪽 `{재료} {이름} ▾`를 누르면 Sheet: 재료 바꾸기(30칸), 냄비 목록으로, 나가기(로그아웃). 불 상태는 room 스냅샷과 30초 타이머로 다시 계산한다(스케줄 경계를 화면이 놓치지 않게).

- [ ] **Step 1: 실패하는 테스트 작성**
  - 목록: 추방된 방은 "이 냄비에서 잠시 나와 있어요"로 보이고 클릭해도 들어가지 않음, 안 읽은 수 3이면 배지 "3"
  - 대화방: 내 메시지는 오른쪽(`mine`), 선생님 메시지에 "주방장" 배지
  - sendMessage가 `{flagged:true}` → 경고 문구(Global Constraints 문구) 표시, 다음 정상 메시지를 보내면 사라짐
  - `isFireOn`이 false → FireBanner("주방장이 냄비 불을 껐어요." + nextChangeLabel), Composer 잠김("💤 불이 꺼져 있어서 쓸 수 없어요")
  - fake timer로 21:59→22:00 KST를 지나면 화면이 불 꺼짐으로 바뀜
  - `TooFastError` → "조금 천천히 보내요"
  - **Review Focus 2**: watchMessages의 onDenied가 호출되면(추방) → 목록 화면으로 이동 + "이 냄비에서 잠시 나와 있어요" 안내
  - **Review Focus 5**: 501번째 글자는 입력되지 않음(Composer maxLength 500 전달 확인)
  - 방에 들어가면 markRead 호출, joinPresence 호출, 나가면 정리 함수 호출
- [ ] **Step 2: FAIL → Step 3: 구현 → Step 4: PASS**
- [ ] **Step 5: Commit** `feat: student lobby and chat room`

### Task 10: 선생님 로그인, 방·명단 관리

**Files:**
- Create: `src/teacher/TeacherApp.tsx`(라우트 "/teacher"), `TeacherLogin.tsx`, `TeacherHome.tsx`, `RosterPanel.tsx`, `RoomEditor.tsx`
- Test: `tests/unit/teacher-home.test.tsx`

**Interfaces:**
- Consumes: `teacherSignIn`, `isTeacherUser`, `watchRoster`, `addStudent`, `removeStudent`, `resetPin`, `watchAllRooms`, `createRoom`, `updateRoomMembers`, `deleteRoom`, `setTeacherName` (Task 6)
- Produces: `TeacherApp`

화면: 구글 로그인 버튼 → 선생님이 아닌 계정은 "방을 만들 권한이 없어요" + 로그아웃. 홈: 방 목록(새 방 만들기: 이름, 대표 이모지, 반 명단에서 학생 체크. 기본 "전체 선택"), 반 명단 관리(이름 여러 줄 붙여넣기로 한 번에 추가, 미가입/가입/추방 여부, 암호 초기화, 명단에서 삭제 확인창), 선생님 이름 바꾸기, 참여 링크 복사(학생 링크는 사이트 주소 하나).

- [ ] **Step 1: 실패하는 테스트 작성**
  - 선생님 아닌 계정 → "방을 만들 권한이 없어요"
  - 여러 줄 붙여넣기 "김가은\n김도윤\n\n" → addStudent 2회(빈 줄 무시, 앞뒤 공백 제거, 이미 있는 이름이면 건너뛰고 알림)
  - 명단에서 삭제는 확인창에서 "삭제"를 눌러야 removeStudent 호출
  - 암호 초기화 → resetPin 호출 + "다음에 들어올 때 새 암호를 정해요" 안내
  - 새 방: 이름이 비었으면 만들기 비활성, 학생 체크 결과가 createRoom members로 전달
  - 참여 링크 복사 → `navigator.clipboard.writeText(location.origin + '/')`
- [ ] **Step 2: FAIL → Step 3: 구현 → Step 4: PASS**
- [ ] **Step 5: Commit** `feat: teacher sign-in, rooms and roster management`

### Task 11: 선생님 대화방 운영, 경고 기록, 금지어

**Files:**
- Create: `src/teacher/TeacherRoom.tsx`, `src/teacher/FlagLog.tsx`, `src/teacher/FilterSettings.tsx`
- Test: `tests/unit/teacher-room.test.tsx`

**Interfaces:**
- Consumes: `watchRoom`, `watchMessages`, `watchFlagsForRoom`, `watchFlags`, `sendMessage(…, 'teacher')`, `deleteMessage`, `ban`, `unban`, `setFire`, `setSchedule`, `updateRoomMembers`, `watchOnlineCount`, `watchSettings`, `setExtraWords` (Task 6), Task 7 컴포넌트

화면(시안 ④): 왼쪽 대화(선생님 메시지는 내 말풍선, 학생 메시지마다 🗑 삭제. 가려진 메시지는 `original`을 넘겨 원래 문장 표시), 오른쪽 패널(노트북) / Sheet(폭 ≤ 768px): "🔥 냄비 불 켜짐" 스위치 + "⏰ 자동 불 끄기 22:00~07:00 매일"(켜고 끄기, 시각 바꾸기), 이 방 학생 목록(접속 점, ⋯ 메뉴: 추방하기 / 추방됨이면 "풀기", 방에서 빼기), 학생 추가. 모바일에서는 헤더에 불 스위치를 따로 둬서 시트를 열지 않아도 한 번에 누를 수 있게 한다.
경고 기록: 시간, 학생, 방, 원래 문장, 가려진 문장. 학생 선택으로 거르기. 금지어 설정: 단어 추가·삭제(`extraWords`).

- [ ] **Step 1: 실패하는 테스트 작성**
  - 가려진 메시지에 flag가 있으면 원래 문장이 보임
  - 🗑 삭제 → 확인 후 deleteMessage
  - 불 스위치를 끔 → `setFire(roomId,'off')`. 스케줄 창 안에서는 스위치가 "💤 냄비 불 꺼짐"으로 보임
  - 자동 시간 22:30~06:30으로 바꿈 → `setSchedule({enabled:true, offMin:1350, onMin:390})`
  - 추방 → ban, 추방된 학생 행에 "추방됨 · 풀기", 풀기 → unban
  - 경고 기록에서 학생 b를 고르면 b의 기록만 남음
  - 금지어 "바보" 추가 → setExtraWords([...기존, '바보']), 중복은 추가하지 않음
- [ ] **Step 2: FAIL → Step 3: 구현 → Step 4: PASS**
- [ ] **Step 5: Commit** `feat: teacher room moderation, flag log and word list`

### Task 12: 모바일·화면 검증 (Playwright)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/seed.ts`(에뮬레이터에 명단 5명, 방 2개, 메시지 20개, 긴 단어 메시지 1개를 넣음), `tests/e2e/screens.spec.ts`
- Modify: Task 7~11 CSS에서 발견되는 문제

**Interfaces:**
- Consumes: 전체 앱. `npm run test:e2e` = configure --test → `emulators:exec --only auth,firestore,database "vite build --mode emulator && vite preview & playwright test"`(Windows에서 동작하도록 `start-server-and-test` 같은 도구 사용 가능)

- [ ] **Step 1: 테스트 작성**. 프로젝트 3개: `phone-small` 360×740, `phone` 390×844(터치·모바일 UA), `laptop` 1280×800. 화면마다(입장, 냄비 목록, 대화방, 불 꺼진 대화방, 선생님 홈, 선생님 대화방 + 시트 열림, 경고 기록):
  - `document.documentElement.scrollWidth <= window.innerWidth` (가로 넘침 없음)
  - 재료 칸·이름 칸·보내기 버튼의 `boundingBox` 높이와 너비 ≥ 44
  - 대화방: 입력창이 뷰포트 안에 있고, 메시지 목록만 스크롤됨(헤더 y 위치가 스크롤 후에도 0 근처)
  - **Review Focus 5**: 띄어쓰기 없는 200자 단어 메시지 말풍선이 뷰포트 폭을 넘지 않음
  - TodayPot 높이가 한 줄(≤ 44px)
  - 화면마다 `toHaveScreenshot()` 저장
- [ ] **Step 2: `npm run test:e2e` 실행 → 실패 항목 확인**
- [ ] **Step 3: CSS 수정**
- [ ] **Step 4: `npm run test:e2e` → 전부 PASS.** 스크린샷을 열어 시안 v5와 눈으로 비교하고, 다른 부분을 고치거나 메모한다
- [ ] **Step 5: Commit** `test: mobile and laptop layout checks`

### Task 13: 선생님용 설치·배포 안내서

**Files:**
- Create: `docs/설치안내.md`
- Modify: `package.json` (`deploy` = `vite build && npx firebase deploy --only hosting,firestore:rules,database`), `scripts/configure.mjs`(안내서 순서에 맞춘 한국어 질문 문구)

- [ ] **Step 1: 안내서 작성** (초보자 기준, 한 단계에 한 동작):
  1. Node.js 설치 확인
  2. Firebase 콘솔에서 프로젝트 만들기(구글 애널리틱스 끄기, Spark 요금제 그대로)
  3. Authentication에서 **Google**과 **이메일/비밀번호** 켜기
  4. Firestore 만들기(위치 `asia-northeast3` 서울), Realtime Database 만들기
  5. 웹 앱 등록 후 설정값 복사
  6. `npx firebase login`
  7. `node scripts/configure.mjs` 실행: 선생님 이메일, 프로젝트 ID, 설정값 붙여넣기
  8. `npm run deploy`
  9. 주소 열기 → `/teacher`에서 구글 로그인 → 명단 넣기 → 방 만들기 → 링크 공유
  - 명단 이름은 실명 대신 이름만 쓰거나 별명을 써도 된다는 안내
  - 자주 막히는 곳: Authentication의 승인된 도메인, 팝업 차단, 암호를 잊은 학생은 "암호 초기화"
- [ ] **Step 2: 확인**: 새 폴더에 저장소를 복제하고 안내서만 보고 `configure --test` → `npm run emulators`로 앱이 뜨는지 확인. 안내서와 다른 부분을 고친다
- [ ] **Step 3: Commit** `docs: teacher setup and deploy guide`
