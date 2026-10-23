import { INGREDIENTS, ingredientByKey } from '../domain/ingredients';

const CLASSIC_TINTS = ['var(--broth-soft)', 'var(--cheese-soft)', 'var(--scallion-soft)', 'var(--muted)'];

/** Background tint: purple for the odd ingredients, a rotating warm tint for the classic ones. */
export function ingredientTint(key: string | null | undefined): string {
  const ing = key ? ingredientByKey(key) : undefined;
  if (!ing) return 'var(--muted)';
  if (!ing.classic) return 'var(--weird-soft)';
  return CLASSIC_TINTS[INGREDIENTS.indexOf(ing) % CLASSIC_TINTS.length];
}

export function Avatar({ ingredient, teacher, size = 40 }: { ingredient?: string | null; teacher?: boolean; size?: 32 | 40 }) {
  const cls = size === 32 ? 'av s32' : 'av';
  if (teacher) return <div className={cls} style={{ background: 'var(--cheese)' }} aria-hidden>🧑‍🍳</div>;
  const ing = ingredient ? ingredientByKey(ingredient) : undefined;
  if (!ing) return <div className={`${cls} unknown`} aria-hidden>?</div>;
  return <div className={cls} style={{ background: ingredientTint(ing.key) }} aria-hidden>{ing.emoji}</div>;
}

/** "치즈"-style label shown next to a student's name. */
export function IngredientTag({ ingredient }: { ingredient: string | null | undefined }) {
  const ing = ingredient ? ingredientByKey(ingredient) : undefined;
  return ing ? <span className="ing">{ing.label}</span> : null;
}
