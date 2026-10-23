import { INGREDIENTS } from '../domain/ingredients';

/** All 30 ingredients in one set, five per row. */
export function IngredientGrid({ value, onChange }: { value: string | null; onChange: (key: string) => void }) {
  return (
    <div className="emojis" role="group" aria-label="재료 고르기">
      {INGREDIENTS.map((i) => (
        <button key={i.key} type="button" className="em" aria-pressed={value === i.key} onClick={() => onChange(i.key)}
          aria-label={i.label}>
          <span aria-hidden>{i.emoji}</span>
          <small aria-hidden>{i.label}</small>
        </button>
      ))}
    </div>
  );
}
