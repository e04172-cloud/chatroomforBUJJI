import { describe, expect, test } from 'vitest';
import { ALLOW_WORDS, BASE_WORDS, bannedRegexSource, maskText } from '../../src/domain/filter';

test('기본 욕설은 같은 길이의 ＊로 가린다', () => {
  expect(maskText('아 진짜 씨발 일찍이네')).toEqual({ masked: '아 진짜 ＊＊ 일찍이네', flagged: true, hits: ['씨발'] });
});
test('띄어쓰기·특수문자·숫자를 섞은 변형도 잡는다', () => {
  for (const t of ['씨 발', '씨1발', '씨.발', 'ㅅㅂ', 'ㅆㅂ', '시bal'])
    expect(maskText(t).flagged).toBe(true);
  expect(maskText('씨 발').masked).toBe('＊＊＊');
});
test('정상 단어는 가리지 않는다', () => {
  for (const t of ['시발점에서 출발', '십분만 기다려', '개발자가 될래', '수박씨 발라 먹자'])
    expect(maskText(t)).toMatchObject({ flagged: false });
});
test('선생님이 추가한 단어', () => {
  expect(maskText('너 바보야', ['바보']).masked).toBe('너 ＊＊야');
});
test('깨끗한 문장은 그대로', () => {
  expect(maskText('도시락 챙겨요 🍱')).toEqual({ masked: '도시락 챙겨요 🍱', flagged: false, hits: [] });
});

const regress = ['서울시 발표', '도시 발전', '몇 개 색연필', '한 개 새로 샀어', '5개년 계획', '올챙이 변태', '김 씨 발표'];
test('일상 문장 회귀: 가리지 않는다', () => {
  for (const t of regress) expect(maskText(t)).toEqual({ masked: t, flagged: false, hits: [] });
});
test('분리형 욕설과 NFD·전각 변형', () => {
  expect(maskText('씨 . 발').masked).toBe('＊＊＊＊＊');
  expect(maskText('씨발'.normalize('NFD')).flagged).toBe(true);
  expect(maskText('ｓｉｂａｌ').flagged).toBe(true);
});

describe('bannedRegexSource', () => {
  const src = bannedRegexSource();
  const re = new RegExp(src.replace(/^\(\?s\)/, ''), 's');
  const normal = ['시발점에서 출발', '십분만 기다려', '개발자가 될래', '수박씨 발라 먹자', '도시락 챙겨요 🍱'];

  test('RE2 호환 형태', () => {
    expect(bannedRegexSource()).toMatch(/^\(\?s\)\.\*\(.+\)\.\*$/);
    expect(bannedRegexSource()).not.toMatch(/\(\?[=!<]|\[1-9]/);
  });
  test('허용어와 정상 문장은 통과', () => {
    for (const t of [...ALLOW_WORDS, ...normal]) expect(re.test(t)).toBe(false);
  });
  test('원문 욕설은 걸린다', () => {
    for (const t of ['씨발', '아 병신', 'ㅅㅂ', '너 개새끼야']) expect(re.test(t)).toBe(true);
  });
  test('가려진 출력은 걸리지 않는다', () => {
    const samples = ['아 진짜 씨발 일찍이네', '씨 발', '씨1발', '씨.발', 'ㅅㅂ', '시bal', '병신 지랄', ...normal];
    for (const t of samples) expect(re.test(maskText(t).masked)).toBe(false);
  });
  test('회귀 문장은 규칙에도 걸리지 않는다', () => {
    for (const t of regress) expect(re.test(t)).toBe(false);
  });
  test('여러 줄 메시지의 둘째 줄 욕설도 걸린다', () => {
    expect(re.test('안녕\n씨발')).toBe(true);
  });
  test('금지어 목록 규모', () => {
    expect(BASE_WORDS.length).toBeGreaterThanOrEqual(60);
    expect(BASE_WORDS.length).toBeLessThanOrEqual(100);
  });
});
