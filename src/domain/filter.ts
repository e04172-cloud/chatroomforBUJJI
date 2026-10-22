import { ALLOW_WORDS, BASE_WORDS, STRICT_WORDS } from './wordlist';

export { ALLOW_WORDS, BASE_WORDS, STRICT_WORDS };

type Unit = { ch: string; start: number; end: number; tok: number };

const ROMAN: [string, string][] = [['ssi', '씨'], ['si', '시'], ['bal', '발']];
const KEEP = /[ㄱ-ㆎ가-힣a-z]/;
const isConjoining = (c: string) => /[ᄀ-ᇿ]/.test(c);
const isCompatJamo = (c: string) => /[㄰-㆏]/.test(c);

/** Normalized string where each unit remembers its [start, end) span and whitespace token in the original text. */
function normalize(text: string): Unit[] {
  const kept: Unit[] = [];
  const cps = [...text];
  let pos = 0;
  let tok = 0;
  let prevSpace = true;
  for (let i = 0; i < cps.length; ) {
    let j = i + 1;
    if (isConjoining(cps[i])) while (j < cps.length && isConjoining(cps[j])) j++;
    const group = cps.slice(i, j).join('');
    const start = pos;
    pos += group.length;
    i = j;
    if (/^\s+$/.test(group)) {
      if (!prevSpace) tok++;
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    // NFKC would turn compatibility jamo (ㅅㅂ) into conjoining jamo, so leave those alone.
    const folded = (isCompatJamo(group) ? group : group.normalize('NFKC')).toLowerCase();
    for (const c of folded) if (KEEP.test(c)) kept.push({ ch: c, start, end: pos, tok });
  }
  const out: Unit[] = [];
  for (let i = 0; i < kept.length; ) {
    const hit = ROMAN.find(([r]) => r.split('').every((l, k) => kept[i + k]?.ch === l));
    if (hit) {
      const last = kept[i + hit[0].length - 1];
      out.push({ ch: hit[1], start: kept[i].start, end: last.end, tok: kept[i].tok });
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
      const first = units[i];
      const last = units[i + n.length - 1];
      if (first.tok !== last.tok) {
        // Spacing between letters only counts when the match spans whole tokens ("씨 발").
        const startsToken = i === 0 || units[i - 1].tok !== first.tok;
        const endsToken = i + n.length === units.length || units[i + n.length].tok !== last.tok;
        if (!startsToken || !endsToken) continue;
      }
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

/** RE2-compatible `(?s).*(a|b|…).*` for Firestore rules; only STRICT_WORDS, minus any that sit inside an allowlisted word. */
export function bannedRegexSource(): string {
  const allow = ALLOW_WORDS.map(norm);
  const words = STRICT_WORDS.filter((w) => !allow.some((a) => a.includes(norm(w))));
  return `(?s).*(${words.map(escapeRe).join('|')}).*`;
}
