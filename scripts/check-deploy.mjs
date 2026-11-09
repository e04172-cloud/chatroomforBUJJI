#!/usr/bin/env node
// Stops `npm run deploy` when the generated files are still the emulator ones (preview:local and the
// test scripts rerun `configure --test`, which overwrites firestore.rules and .firebaserc).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => resolve(ROOT, p);
const FIX = '설치안내서 7단계(node scripts/configure.mjs --teacher ... --project ...)를 다시 실행한 뒤 배포하세요.';

function fail(msg) {
  console.error(`check-deploy: ${msg}\n  → ${FIX}`);
  process.exit(1);
}

function readEnv(file) {
  const vars = {};
  for (const line of readFileSync(at(file), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

for (const f of ['.env.local', '.firebaserc', 'firestore.rules'])
  if (!existsSync(at(f))) fail(`${f} 파일이 없어요.`);

const env = readEnv('.env.local');
for (const k of ['API_KEY', 'AUTH_DOMAIN', 'DATABASE_URL', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID'])
  if (!env[`VITE_FIREBASE_${k}`]) fail(`.env.local에 VITE_FIREBASE_${k} 값이 없어요.`);
if (env.VITE_USE_EMULATORS === '1') fail('.env.local이 미리 보기용으로 되어 있어요.');
const teacher = (env.VITE_TEACHER_EMAIL ?? '').toLowerCase();
if (!teacher || teacher === 'teacher@test.com') fail('.env.local의 선생님 이메일이 비었거나 테스트용이에요.');

const project = JSON.parse(readFileSync(at('.firebaserc'), 'utf8')).projects?.default ?? '';
if (!project || project.startsWith('demo-')) fail(`.firebaserc가 미리 보기용 프로젝트(${project || '없음'})를 가리켜요.`);
if (project !== env.VITE_FIREBASE_PROJECT_ID)
  fail(`.firebaserc(${project})와 .env.local(${env.VITE_FIREBASE_PROJECT_ID})의 프로젝트가 달라요.`);

const rules = readFileSync(at('firestore.rules'), 'utf8');
if (rules.includes('teacher@test.com')) fail('firestore.rules가 미리 보기용(teacher@test.com)이에요.');
if (!rules.includes(`'${teacher}'`)) fail(`firestore.rules의 선생님 이메일이 ${teacher}가 아니에요.`);

console.log(`check-deploy: ${project} · ${teacher} 로 배포할 준비가 됐어요.`);
