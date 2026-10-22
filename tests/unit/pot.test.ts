import { describe, expect, test } from 'vitest';
import { summarizePot, joinedLine } from '../../src/domain/pot';

describe('pot', () => {
  test('많은 순으로 묶고 나머지는 외 n종', () => {
    const r = summarizePot(['sausage', 'sausage', 'ramen', 'choco', null], 2);
    expect(r.chips).toEqual([
      { emoji: '🌭', count: 2, classic: true },
      { emoji: '🍜', count: 1, classic: true },
    ]);
    expect(r.moreKinds).toBe(1);
  });
  test('이상한 재료 비율로 맛 평가', () => {
    expect(summarizePot(['sausage', 'ramen', 'cheese', 'kimchi', 'spam']).verdict?.emoji).toBe('😋');
    expect(summarizePot(['sausage', 'ramen', 'choco']).verdict?.emoji).toBe('🤔');
    expect(summarizePot(['sausage', 'choco', 'watermelon']).verdict?.emoji).toBe('🤢');
    expect(summarizePot([null, null]).verdict).toBeNull();
  });
  test('알 수 없는 키는 무시', () => {
    const r = summarizePot(['nope', 'sausage']);
    expect(r.chips).toHaveLength(1);
    expect(r.verdict?.label).toBe('맛있음');
  });
  test('입장 안내', () => {
    expect(joinedLine('김도윤', 'cheese')).toBe('🧀 김도윤 님이 냄비에 들어왔어요');
    expect(joinedLine('김도윤', 'watermelon')).toBe('🍉 김도윤(수박) 님이 냄비에 들어왔어요… 괜찮을까?');
  });
});
