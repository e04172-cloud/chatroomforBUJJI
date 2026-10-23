import { summarizePot } from '../domain/pot';

const VERDICT_CLASS = { '😋': 'verdict good', '🤔': 'verdict meh', '🤢': 'verdict' } as const;

/** One-line "오늘의 부대찌개" strip; scrolls sideways instead of wrapping on narrow screens. */
export function TodayPot({ ingredientKeys, maxChips = 7 }: { ingredientKeys: (string | null)[]; maxChips?: number }) {
  const { chips, moreKinds, verdict } = summarizePot(ingredientKeys, maxChips);
  if (!verdict) return null;
  return (
    <div className="today" data-testid="today-pot">
      <b>오늘의 부대찌개</b>
      {chips.map((c) => (
        <span key={c.emoji} className={c.classic ? 'chip' : 'chip odd'}>{c.emoji}×{c.count}</span>
      ))}
      {moreKinds > 0 && <span className="more">외 {moreKinds}종</span>}
      <span className={VERDICT_CLASS[verdict.emoji]}>맛: {verdict.emoji} {verdict.label}</span>
    </div>
  );
}
