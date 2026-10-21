import { describe, expect, test } from 'vitest';
import { INGREDIENTS, ingredientByKey } from '../../src/domain/ingredients';

describe('ingredients', () => {
  test('재료는 30가지이고 스펙 순서다', () => {
    expect(INGREDIENTS).toHaveLength(30);
    expect(INGREDIENTS[0]).toMatchObject({ emoji: '🌭', label: '소시지', classic: true });
    expect(INGREDIENTS[15]).toMatchObject({ emoji: '🧈', label: '두부', classic: true });
    expect(INGREDIENTS[16]).toMatchObject({ emoji: '🍫', label: '초콜릿', classic: false });
    expect(INGREDIENTS[29]).toMatchObject({ emoji: '🥤', label: '콜라', classic: false });
    expect(new Set(INGREDIENTS.map((i) => i.key)).size).toBe(30);
  });

  test('앞 16개만 정통 재료다', () => {
    expect(INGREDIENTS.filter((i) => i.classic)).toHaveLength(16);
    expect(INGREDIENTS.slice(0, 16).every((i) => i.classic)).toBe(true);
  });

  test('ingredientByKey는 키로 찾고 없으면 undefined', () => {
    expect(ingredientByKey('cola')?.label).toBe('콜라');
    expect(ingredientByKey('nope')).toBeUndefined();
  });
});
