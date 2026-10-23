import { useState } from 'react';
import { addStudent, removeStudent, resetPin } from '../data/students';
import type { Student, WithId } from '../data/types';
import { Avatar } from '../components/Avatar';
import { Confirm } from '../components/Confirm';
import { useTeacher } from './shell';

/** Splits pasted text into new names: trimmed, blank lines dropped, duplicates and existing names skipped. */
export function parseNames(text: string, existing: string[]): { add: string[]; skipped: string[] } {
  const seen = new Set(existing);
  const add: string[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.trim();
    if (!name) continue;
    if (seen.has(name)) skipped.push(name);
    else {
      seen.add(name);
      add.push(name);
    }
  }
  return { add, skipped };
}

export function RosterPanel() {
  const { roster, rooms } = useTeacher();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<WithId<Student> | null>(null);

  async function add() {
    const { add, skipped } = parseNames(text, roster.map((s) => s.name));
    if (!add.length && !skipped.length) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const name of add) await addStudent(name);
      setText('');
      setMessage({ ok: true, text: `${add.length}명을 넣었어요.${skipped.length ? ` 이미 있는 이름은 건너뛰었어요: ${skipped.join(', ')}` : ''}` });
    } catch {
      setMessage({ ok: false, text: '명단에 넣지 못한 이름이 있어요. 다시 해 보세요.' });
    } finally {
      setBusy(false);
    }
  }

  async function reset(s: WithId<Student>) {
    try {
      await resetPin(s.id);
      setMessage({ ok: true, text: `${s.name}: 다음에 들어올 때 새 암호를 정해요` });
    } catch {
      setMessage({ ok: false, text: '암호를 초기화하지 못했어요.' });
    }
  }

  const bannedIn = (id: string) => rooms.filter((r) => r.banned.includes(id)).map((r) => r.name);

  return (
    <div className="t-grid">
      <div className="card">
        <h3 className="section-title">이름 넣기</h3>
        <p className="note">한 줄에 한 명씩 붙여 넣으세요. 실명 대신 이름만 쓰거나 별명을 써도 돼요.</p>
        <textarea className="input" style={{ marginTop: 10 }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'김가은\n김도윤\n박서준'} aria-label="학생 이름 붙여넣기" />
        <button type="button" className="btn" disabled={busy || !text.trim()} onClick={() => void add()}>명단에 넣기</button>
        {message && <p className={message.ok ? 'ok' : 'err'} role="status">{message.text}</p>}
      </div>

      <div className="card">
        <h3 className="section-title">반 명단 {roster.length}명</h3>
        {roster.length === 0 && <p className="note">아직 아무도 없어요.</p>}
        <div className="list" style={{ marginTop: 8 }}>
          {roster.map((s) => {
            const banned = bannedIn(s.id);
            return (
              <div key={s.id} className="r-line" data-student={s.name}>
                <Avatar ingredient={s.ingredient} size={32} />
                <div className="grow">
                  <div className="nm-text">{s.name}</div>
                  <div className="count">
                    {s.claimedGen == null ? '미가입' : '가입함'}
                    {banned.length > 0 && <span style={{ color: 'var(--danger)' }}> · 추방됨: {banned.join(', ')}</span>}
                  </div>
                </div>
                <button type="button" className="link-btn" onClick={() => void reset(s)} disabled={s.claimedGen == null}
                  aria-label={`${s.name} 암호 초기화`}>🔑 암호 초기화</button>
                <button type="button" className="link-btn" style={{ color: 'var(--danger)' }} onClick={() => setRemoving(s)}
                  aria-label={`${s.name} 명단에서 삭제`}>삭제</button>
              </div>
            );
          })}
        </div>
      </div>

      <Confirm open={!!removing} title={`${removing?.name ?? ''}을(를) 명단에서 삭제할까요?`} confirmLabel="삭제"
        onClose={() => setRemoving(null)} onConfirm={() => removeStudent(removing!.id)}>
        모든 냄비에서 빠지고 다시 들어올 수 없어요. 지난 메시지는 이름과 함께 남아요.
        전학처럼 아예 빠질 때만 쓰고, 잠시 내보낼 때는 냄비 안에서 "추방하기"를 써 주세요.
      </Confirm>
    </div>
  );
}
