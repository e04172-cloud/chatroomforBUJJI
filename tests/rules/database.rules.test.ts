// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, remove, set, type Database } from 'firebase/database';
import { authEmail } from '../../src/domain/identity';

const A = 'aaaaaaaaaaaa';
const B = 'bbbbbbbbbbbb';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budae',
    database: { rules: readFileSync('database.rules.json', 'utf8') },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const rtdb = (ctx: { database(): unknown }) => ctx.database() as unknown as Database;
const student = (id: string) => rtdb(env.authenticatedContext(`uid-${id}`, { email: authEmail(id, 1) }));
const anon = () => rtdb(env.unauthenticatedContext());

describe('presence', () => {
  test('/presence/R/a/conn1을 a가 쓰기 성공', () => assertSucceeds(set(ref(student(A), `presence/R/${A}/conn1`), true)));
  test('a가 자기 연결 지우기 성공', () => assertSucceeds(remove(ref(student(A), `presence/R/${A}/conn1`))));
  test('b가 /presence/R/a/conn1 쓰기 실패', () => assertFails(set(ref(student(B), `presence/R/${A}/conn1`), true)));
  test('a가 true 아닌 값 쓰기 실패', () => assertFails(set(ref(student(A), `presence/R/${A}/conn1`), 'x'.repeat(100))));
  test('a가 방 전체를 덮어쓰기 실패', () => assertFails(set(ref(student(A), 'presence/R'), { [A]: { c: true } })));
  test('다른 도메인 이메일로 쓰기 실패', () =>
    assertFails(set(ref(rtdb(env.authenticatedContext('x', { email: `${A}-1@evil.com` })), `presence/R/${A}/c`), true)));
  test('로그인한 사람은 읽기 성공', () => assertSucceeds(get(ref(student(B), 'presence/R'))));
  test('로그인 안 하면 읽기 실패', () => assertFails(get(ref(anon(), 'presence/R'))));
  test('로그인 안 하면 쓰기 실패', () => assertFails(set(ref(anon(), `presence/R/${A}/conn1`), true)));
  test('presence 밖 경로 쓰기 실패', () => assertFails(set(ref(student(A), 'other'), true)));
});
