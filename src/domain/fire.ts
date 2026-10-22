export type Schedule = { enabled: boolean; offMin: number; onMin: number };

/** Firebase-free view of a room's fire state; manualUntil is epoch ms. */
export type FireInput = {
  fire: { manual: 'on' | 'off' | null; manualUntil: number | null };
  schedule: Schedule;
};

const MIN_MS = 60_000;
const DAY_MIN = 1440;
const KST_OFFSET_MIN = 540;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Minutes since midnight in KST (0..1439). */
export function minutesKST(ms: number): number {
  return mod(Math.floor(ms / MIN_MS) + KST_OFFSET_MIN, DAY_MIN);
}

/** Whether `min` falls in the fire-off window [offMin, onMin), which may wrap past midnight. */
export function inOffWindow(min: number, offMin: number, onMin: number): boolean {
  if (offMin === onMin) return false;
  return offMin < onMin ? min >= offMin && min < onMin : min >= offMin || min < onMin;
}

function scheduleOn(schedule: Schedule, ms: number): boolean {
  return !(schedule.enabled && inOffWindow(minutesKST(ms), schedule.offMin, schedule.onMin));
}

function manualActive(fire: FireInput['fire'], nowMs: number): boolean {
  return fire.manual !== null && (fire.manualUntil === null || fire.manualUntil > nowMs);
}

export function isFireOn(room: FireInput, nowMs: number): boolean {
  if (manualActive(room.fire, nowMs)) return room.fire.manual === 'on';
  return scheduleOn(room.schedule, nowMs);
}

/** Next schedule boundary strictly after the current minute, or null if there is none. */
export function nextBoundary(schedule: Schedule, nowMs: number): number | null {
  if (!schedule.enabled || schedule.offMin === schedule.onMin) return null;
  const cur = minutesKST(nowMs);
  const delta = (t: number) => mod(t - cur - 1, DAY_MIN) + 1;
  const minutes = Math.min(delta(schedule.offMin), delta(schedule.onMin));
  return Math.floor(nowMs / MIN_MS) * MIN_MS + minutes * MIN_MS;
}

/** A manual override lasts until the next schedule boundary (forever if the schedule is inactive). */
export function manualFire(
  state: 'on' | 'off',
  schedule: Schedule,
  nowMs: number,
): { manual: 'on' | 'off'; manualUntil: number | null } {
  return { manual: state, manualUntil: nextBoundary(schedule, nowMs) };
}

function timeWord(hour: number): string {
  if (hour < 5) return '새벽';
  if (hour < 12) return '아침';
  if (hour < 18) return '오후';
  return '밤';
}

/** Label for the next moment the computed fire state flips, or null if it never will. */
export function nextChangeLabel(room: FireInput, nowMs: number): string | null {
  const current = isFireOn(room, nowMs);
  const candidates: number[] = [];
  const { manualUntil } = room.fire;
  if (manualActive(room.fire, nowMs) && manualUntil !== null) candidates.push(manualUntil);
  let t = nowMs;
  for (let i = 0; i < 3; i++) {
    const b = nextBoundary(room.schedule, t);
    if (b === null) break;
    candidates.push(b);
    t = b;
  }
  candidates.sort((a, b) => a - b);
  const flip = candidates.find((c) => isFireOn(room, c) !== current);
  if (flip === undefined) return null;

  const m = minutesKST(flip);
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const when = minute === 0 ? `${h12}시` : `${h12}시 ${minute}분`;
  return `${timeWord(hour)} ${when}에 ${current ? '꺼져요' : '켜져요'}`;
}
