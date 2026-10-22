/** Interprets 'YYYY-MM-DDTHH:mm' as KST (UTC+9) and returns epoch ms. */
export function kst(isoLocal: string): number {
  return Date.parse(`${isoLocal}:00+09:00`);
}
