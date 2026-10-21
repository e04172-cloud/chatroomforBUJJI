export interface Ingredient {
  readonly key: string;
  readonly emoji: string;
  readonly label: string;
  readonly classic: boolean;
}

const c = (key: string, emoji: string, label: string): Ingredient => ({ key, emoji, label, classic: true });
const w = (key: string, emoji: string, label: string): Ingredient => ({ key, emoji, label, classic: false });

export const INGREDIENTS: readonly Ingredient[] = [
  c('sausage', '🌭', '소시지'),
  c('spam', '🥫', '스팸'),
  c('ramen', '🍜', '라면사리'),
  c('cheese', '🧀', '치즈'),
  c('kimchi', '🥬', '김치'),
  c('chili', '🌶️', '고추'),
  c('beans', '🫘', '베이크드빈'),
  c('bacon', '🥓', '베이컨'),
  c('mushroom', '🍄', '버섯'),
  c('onion', '🧅', '양파'),
  c('tteok', '🍡', '떡사리'),
  c('dumpling', '🥟', '만두'),
  c('fishcake', '🍢', '어묵'),
  c('garlic', '🧄', '마늘'),
  c('egg', '🥚', '계란'),
  c('tofu', '🧈', '두부'),
  w('choco', '🍫', '초콜릿'),
  w('jelly', '🍬', '젤리'),
  w('lollipop', '🍭', '막대사탕'),
  w('apple', '🍎', '사과'),
  w('strawberry', '🍓', '딸기'),
  w('banana', '🍌', '바나나'),
  w('watermelon', '🍉', '수박'),
  w('pineapple', '🍍', '파인애플'),
  w('icecream', '🍦', '아이스크림'),
  w('donut', '🍩', '도넛'),
  w('cupcake', '🧁', '컵케이크'),
  w('cookie', '🍪', '쿠키'),
  w('pizza', '🍕', '피자'),
  w('cola', '🥤', '콜라'),
];

export function ingredientByKey(key: string): Ingredient | undefined {
  return INGREDIENTS.find((i) => i.key === key);
}
