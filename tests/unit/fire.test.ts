import { describe, expect, test } from 'vitest';
import { inOffWindow, isFireOn, manualFire, minutesKST, nextBoundary, nextChangeLabel } from '../../src/domain/fire';
import { kst } from './helpers';

const S = { enabled: true, offMin: 1320, onMin: 420 };
const none = { manual: null, manualUntil: null } as const;

describe('fire', () => {
  test('minutesKST', () => {
    expect(minutesKST(kst('2026-10-21T00:00'))).toBe(0);
    expect(minutesKST(kst('2026-10-21T23:59'))).toBe(1439);
    expect(minutesKST(kst('2026-10-21T07:30'))).toBe(450);
  });
  test('자정을 넘는 창', () => {
    expect(inOffWindow(1319, 1320, 420)).toBe(false);
    expect(inOffWindow(1320, 1320, 420)).toBe(true);
    expect(inOffWindow(0, 1320, 420)).toBe(true);
    expect(inOffWindow(419, 1320, 420)).toBe(true);
    expect(inOffWindow(420, 1320, 420)).toBe(false);
  });
  test('같은 날 안의 창과 빈 창', () => {
    expect(inOffWindow(600, 540, 720)).toBe(true);
    expect(inOffWindow(720, 540, 720)).toBe(false);
    expect(inOffWindow(100, 540, 720)).toBe(false);
    expect(inOffWindow(100, 500, 500)).toBe(false);
  });
  test('nextBoundary', () => {
    expect(nextBoundary(S, kst('2026-10-21T23:00'))).toBe(kst('2026-10-22T07:00'));
    expect(nextBoundary(S, kst('2026-10-21T22:00'))).toBe(kst('2026-10-22T07:00'));
    expect(nextBoundary(S, kst('2026-10-21T21:59'))).toBe(kst('2026-10-21T22:00'));
    expect(nextBoundary({ ...S, enabled: false }, kst('2026-10-21T23:00'))).toBeNull();
    expect(nextBoundary({ enabled: true, offMin: 60, onMin: 60 }, kst('2026-10-21T23:00'))).toBeNull();
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
  test('수동 상태가 없으면 스케줄을 따른다', () => {
    expect(isFireOn({ fire: none, schedule: S }, kst('2026-10-21T23:00'))).toBe(false);
    expect(isFireOn({ fire: none, schedule: S }, kst('2026-10-21T12:00'))).toBe(true);
    expect(isFireOn({ fire: none, schedule: { ...S, enabled: false } }, kst('2026-10-21T23:00'))).toBe(true);
  });
  test('nextChangeLabel', () => {
    const at = (iso: string, schedule = S, fire: Parameters<typeof isFireOn>[0]['fire'] = none) =>
      nextChangeLabel({ fire, schedule }, kst(iso));
    expect(at('2026-10-21T23:00')).toBe('아침 7시에 켜져요');
    expect(at('2026-10-21T12:00')).toBe('밤 10시에 꺼져요');
    expect(at('2026-10-21T12:40', { enabled: true, offMin: 0, onMin: 750 })).toBe('새벽 12시에 꺼져요');
    expect(at('2026-10-21T01:00', { enabled: true, offMin: 0, onMin: 750 })).toBe('오후 12시 30분에 켜져요');
    expect(at('2026-10-21T12:00', { ...S, enabled: false })).toBeNull();
  });
  test('수동 상태가 만료돼도 스케줄과 같으면 변화가 아니다', () => {
    const fire = { manual: 'on', manualUntil: kst('2026-10-22T07:00') } as const;
    expect(nextChangeLabel({ fire, schedule: S }, kst('2026-10-21T23:00'))).toBe('밤 10시에 꺼져요');
  });
  test('수동 끄기가 만료돼도 스케줄도 꺼짐이면 아침에 켜짐', () => {
    const fire = { manual: 'off', manualUntil: kst('2026-10-21T22:00') } as const;
    expect(nextChangeLabel({ fire, schedule: S }, kst('2026-10-21T14:00'))).toBe('아침 7시에 켜져요');
  });
});
