import { INGREDIENTS, ingredientByKey } from './ingredients';

export interface PotChip {
  emoji: string;
  count: number;
  classic: boolean;
}

export interface PotVerdict {
  emoji: '😋' | '🤔' | '🤢';
  label: '맛있음' | '애매' | '위험';
}

export interface PotSummary {
  chips: PotChip[];
  moreKinds: number;
  verdict: PotVerdict | null;
}

export function summarizePot(ingredientKeys: (string | null)[], maxChips = 7): PotSummary {
  const counts = new Map<string, number>();
  let total = 0;
  let weird = 0;
  for (const k of ingredientKeys) {
    if (k == null) continue;
    const ing = ingredientByKey(k);
    if (!ing) continue;
    counts.set(ing.key, (counts.get(ing.key) ?? 0) + 1);
    total++;
    if (!ing.classic) weird++;
  }
  const all = INGREDIENTS.filter((i) => counts.has(i.key))
    .map((i) => ({ emoji: i.emoji, count: counts.get(i.key)!, classic: i.classic }));
  // Array.sort is stable, so ties keep INGREDIENTS order.
  all.sort((a, b) => b.count - a.count);
  const chips = all.slice(0, Math.max(0, maxChips));
  let verdict: PotVerdict | null = null;
  if (total > 0) {
    const ratio = weird / total;
    verdict =
      ratio < 0.2 ? { emoji: '😋', label: '맛있음' }
      : ratio < 0.5 ? { emoji: '🤔', label: '애매' }
      : { emoji: '🤢', label: '위험' };
  }
  return { chips, moreKinds: all.length - chips.length, verdict };
}

export function joinedLine(name: string, ingredientKey: string): string {
  const ing = ingredientByKey(ingredientKey);
  if (!ing) return `${name} 님이 냄비에 들어왔어요`;
  if (ing.classic) return `${ing.emoji} ${name} 님이 냄비에 들어왔어요`;
  return `${ing.emoji} ${name}(${ing.label}) 님이 냄비에 들어왔어요… 괜찮을까?`;
}
