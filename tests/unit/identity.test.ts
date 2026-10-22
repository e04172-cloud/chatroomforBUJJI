import { expect, test } from 'vitest';
import { authEmail, newStudentId, parseAuthEmail, toAuthPassword, validatePin } from '../../src/domain/identity';

test('가짜 이메일 왕복', () => {
  expect(authEmail('abc123def456', 2)).toBe('abc123def456-2@students.budae.invalid');
  expect(parseAuthEmail('abc123def456-2@students.budae.invalid')).toEqual({ studentId: 'abc123def456', gen: 2 });
  expect(parseAuthEmail('teacher@gmail.com')).toBeNull();
  expect(parseAuthEmail('x@students.budae.invalid')).toBeNull();
});
test('암호', () => {
  expect(validatePin('123')).toBe('암호는 4자리 이상이에요');
  expect(validatePin('1234')).toBeNull();
  expect(toAuthPassword('1234')).toHaveLength(10);
});
test('studentId에는 -가 없다', () => {
  for (let i = 0; i < 50; i++) expect(newStudentId()).toMatch(/^[a-z0-9]{12}$/);
});
