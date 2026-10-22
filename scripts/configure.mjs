#!/usr/bin/env node
// Generates firestore.rules, .firebaserc and the Vite env file from the template and arguments.
//   node scripts/configure.mjs --teacher <email> --project <projectId> [--config <firebaseConfig.json>]
//   node scripts/configure.mjs --test      (teacher@test.com, demo-budae, .env.emulator)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { tsImport } from 'tsx/esm/api';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => resolve(ROOT, p);

const CONFIG_KEYS = [
  ['apiKey', 'VITE_FIREBASE_API_KEY'],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
  ['databaseURL', 'VITE_FIREBASE_DATABASE_URL'],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
  ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'],
  ['messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'],
  ['appId', 'VITE_FIREBASE_APP_ID'],
];

function parseArgs(argv) {
  const out = { test: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--test') out.test = true;
    else if (a === '--teacher' || a === '--project' || a === '--config') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) fail(`${a} 뒤에 값이 필요해요.`);
      out[a.slice(2)] = v;
    } else fail(`알 수 없는 옵션: ${a}`);
  }
  return out;
}

function fail(msg) {
  console.error(`configure: ${msg}`);
  process.exit(1);
}

/** Escapes a value for a single-quoted Firestore rules string literal. */
const rulesString = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function writeRules(teacherEmail, bannedRegex) {
  const template = readFileSync(at('firestore.rules.template'), 'utf8');
  for (const ph of ['__TEACHER_EMAIL__', '__BANNED_REGEX__'])
    if (!template.includes(ph)) fail(`firestore.rules.template에 ${ph}가 없어요.`);
  const rules = template
    .replaceAll('__TEACHER_EMAIL__', rulesString(teacherEmail))
    .replaceAll('__BANNED_REGEX__', rulesString(bannedRegex));
  writeFileSync(at('firestore.rules'), rules);
}

function writeEnv(file, vars) {
  const body = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n');
  writeFileSync(at(file), `# configure.mjs가 만든 파일이에요. 직접 고치지 말고 다시 실행하세요.\n${body}\n`);
}

async function askConfig(projectId) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const cfg = {};
  console.log('Firebase 콘솔 > 프로젝트 설정 > 내 앱의 firebaseConfig 값을 입력하세요.');
  for (const [key] of CONFIG_KEYS) {
    const def = key === 'projectId' ? projectId : '';
    const ans = (await rl.question(`${key}${def ? ` (${def})` : ''}: `)).trim();
    cfg[key] = ans || def;
  }
  rl.close();
  return cfg;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const teacher = (args.test ? 'teacher@test.com' : args.teacher ?? '').trim().toLowerCase();
  const project = args.test ? 'demo-budae' : args.project ?? '';
  if (!/^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/.test(teacher)) fail('--teacher <선생님 구글 이메일>이 필요해요.');
  if (!/^[a-z0-9-]{4,40}$/.test(project)) fail('--project <Firebase 프로젝트 ID>가 필요해요.');

  const { bannedRegexSource } = await tsImport('../src/domain/filter.ts', import.meta.url);
  writeRules(teacher, bannedRegexSource());
  writeFileSync(at('.firebaserc'), JSON.stringify({ projects: { default: project } }, null, 2) + '\n');

  if (args.test) {
    writeEnv('.env.emulator', {
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-budae.firebaseapp.com',
      VITE_FIREBASE_DATABASE_URL: 'http://127.0.0.1:9000/?ns=demo-budae-default-rtdb',
      VITE_FIREBASE_PROJECT_ID: 'demo-budae',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-budae.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
      VITE_FIREBASE_APP_ID: 'demo-app',
      VITE_TEACHER_EMAIL: teacher,
      VITE_USE_EMULATORS: '1',
    });
    console.log('configure: firestore.rules, .firebaserc, .env.emulator (demo-budae, teacher@test.com)');
    return;
  }

  const cfg = args.config ? JSON.parse(readFileSync(resolve(process.cwd(), args.config), 'utf8')) : await askConfig(project);
  if (cfg.projectId && cfg.projectId !== project) fail(`config의 projectId(${cfg.projectId})가 --project(${project})와 달라요.`);
  const vars = {};
  for (const [key, name] of CONFIG_KEYS) {
    const v = key === 'projectId' ? project : String(cfg[key] ?? '').trim();
    if (!v) fail(`firebaseConfig.${key} 값이 없어요.`);
    if (/[\r\n]/.test(v)) fail(`firebaseConfig.${key} 값에 줄바꿈이 있어요.`);
    vars[name] = v;
  }
  vars.VITE_TEACHER_EMAIL = teacher;
  writeEnv('.env.local', vars);
  console.log(`configure: firestore.rules, .firebaserc, .env.local (${project}, ${teacher})`);
}

await main();
