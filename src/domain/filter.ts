import { ALLOW_WORDS, BASE_WORDS } from './wordlist';

export { ALLOW_WORDS, BASE_WORDS };

type Unit = { ch: string; start: number; end: number };

const ROMAN: [string, string][] = [['ssi', '씨'], ['si', '시'], ['bal', '발']];
const KEEP = /[ㄱ-ㆎ가-힣a-z]/;

/** Normalized string where each unit remembers its [start, end) span in the original text. */
function normalize(text: string): Unit[] {
  const kept: Unit[] = [];
  let pos = 0;
  for (const c of text.toLowerCase()) {
    if (KEEP.test(c)) kept.push({ ch: c, start: pos, end: pos + c.length });
    pos += c.length;
  }
  const out: Unit[] = [];
  for (let i = 0; i < kept.length; ) {
    const hit = ROMAN.find(([r]) => r.split('').every((l, k) => kept[i + k]?.ch === l));
    if (hit) {
      const last = kept[i + hit[0].length - 1];
      out.push({ ch: hit[1], start: kept[i].start, end: last.end });
      i += hit[0].length;
    } else out.push(kept[i++]);
  }
  return out;
}

const norm = (w: string) => normalize(w).map((u) => u.ch).join('');

function occurrences(hay: string, needle: string): number[] {
  const res: number[] = [];
  if (!needle) return res;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) res.push(i);
  return res;
}

export function maskText(
  text: string,
  extraWords: string[] = [],
): { masked: string; flagged: boolean; hits: string[] } {
  const units = normalize(text);
  const s = units.map((u) => u.ch).join('');
  const protectedAt = new Array<boolean>(s.length).fill(false);
  for (const a of ALLOW_WORDS.map(norm))
    for (const i of occurrences(s, a)) for (let k = i; k < i + a.length; k++) protectedAt[k] = true;

  const words = [...new Set([...BASE_WORDS, ...extraWords].map((w) => [w, norm(w)] as const).filter(([, n]) => n))]
    .sort((a, b) => b[1].length - a[1].length);
  const covered = new Array<boolean>(s.length).fill(false);
  const hits: string[] = [];
  const spans: [number, number][] = [];
  for (const [word, n] of words) {
    for (const i of occurrences(s, n)) {
      const idx = Array.from({ length: n.length }, (_, k) => i + k);
      if (idx.some((k) => protectedAt[k])) continue;
      if (idx.every((k) => covered[k])) continue;
      idx.forEach((k) => (covered[k] = true));
      spans.push([units[i].start, units[i + n.length - 1].end]);
      if (!hits.includes(word)) hits.push(word);
    }
  }
  if (!spans.length) return { masked: text, flagged: false, hits: [] };

  const chars = [...text];
  const maskedAt = new Array<boolean>(text.length).fill(false);
  for (const [a, b] of spans) for (let k = a; k < b; k++) maskedAt[k] = true;
  let out = '';
  let pos = 0;
  for (const c of chars) {
    out += maskedAt[pos] ? '＊' : c;
    pos += c.length;
  }
  return { masked: out, flagged: true, hits };
}

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** RE2-compatible `.*(a|b|…).*` for Firestore rules; skips base words that sit inside an allowlisted word. */
export function bannedRegexSource(): string {
  const allow = ALLOW_WORDS.map(norm);
  const words = BASE_WORDS.filter((w) => !allow.some((a) => a.includes(norm(w))));
  return `.*(${words.map(escapeRe).join('|')}).*`;
}
