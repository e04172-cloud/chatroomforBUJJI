import { useState, type FormEvent } from 'react';
import type { Student, WithId } from '../data/types';
import { ROOM_EMOJIS } from './shell';

export interface RoomDraft {
  name: string;
  emoji: string;
  members: string[];
}

/** Name, picture and members of a pot; new pots start with the whole roster ticked. */
export function RoomEditor({ roster, initial, submitLabel, onSubmit }: {
  roster: WithId<Student>[];
  initial?: RoomDraft;
  submitLabel: string;
  onSubmit: (d: RoomDraft) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? ROOM_EMOJIS[0]);
  const [members, setMembers] = useState<Set<string>>(() => new Set(initial?.members ?? roster.map((s) => s.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = roster.length > 0 && roster.every((s) => members.has(s.id));
  const toggle = (id: string) => setMembers((m) => {
    const next = new Set(m);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // Keep roster order so the member list reads like the class list.
      await onSubmit({ name: name.trim(), emoji, members: roster.map((s) => s.id).filter((id) => members.has(id)) });
    } catch {
      setError('저장하지 못했어요. 잠시 후 다시 해 보세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="lbl">냄비 이름</div>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="예: 과학 모둠 3조" aria-label="냄비 이름" />
      <div className="lbl">대표 이모지</div>
      <div className="emoji-pick" role="group" aria-label="대표 이모지">
        {ROOM_EMOJIS.map((em) => (
          <button key={em} type="button" aria-pressed={em === emoji} onClick={() => setEmoji(em)}>{em}</button>
        ))}
      </div>
      <div className="lbl row-gap" style={{ justifyContent: 'space-between' }}>
        <span>참여 학생 {members.size}명</span>
        <button type="button" className="link-btn" onClick={() => setMembers(all ? new Set() : new Set(roster.map((s) => s.id)))}>
          {all ? '모두 빼기' : '전체 선택'}
        </button>
      </div>
      {roster.length === 0
        ? <p className="note">반 명단이 비어 있어요. 먼저 반 명단에 학생을 넣어 주세요.</p>
        : (
          <div className="check-grid">
            {roster.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" checked={members.has(s.id)} onChange={() => toggle(s.id)} />
                <span className="nm-text">{s.name}</span>
              </label>
            ))}
          </div>
        )}
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={busy || !name.trim()}>{submitLabel}</button>
    </form>
  );
}
