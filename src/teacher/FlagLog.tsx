import { useEffect, useMemo, useState } from 'react';
import { watchFlags } from '../data/flags';
import type { Flag, WithId } from '../data/types';
import { highlightedOriginal } from '../components/MessageBubble';
import { formatDateTime } from '../components/time';
import { useTeacher } from './shell';

/** Every masked message with its original, newest first, filterable by student. */
export function FlagLog() {
  const { roster, rooms } = useTeacher();
  const [flags, setFlags] = useState<WithId<Flag>[] | null>(null);
  const [studentId, setStudentId] = useState('');

  useEffect(() => watchFlags(setFlags, {}, () => setFlags([])), []);

  const names = useMemo(() => new Map(roster.map((s) => [s.id, s.name])), [roster]);
  const roomNames = useMemo(() => new Map(rooms.map((r) => [r.id, `${r.emoji} ${r.name}`])), [rooms]);
  const shown = (flags ?? []).filter((f) => !studentId || f.studentId === studentId);

  return (
    <div className="card">
      <div className="row-gap" style={{ justifyContent: 'space-between' }}>
        <h3 className="section-title">경고 기록</h3>
        <select className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="학생 고르기">
          <option value="">모든 학생</option>
          {roster.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <p className="note">가려진 메시지만 모아 보여요. 원래 문장은 선생님만 볼 수 있어요.</p>
      {!flags && <p className="note">불러오는 중…</p>}
      {flags && shown.length === 0 && <p className="center-note">기록이 없어요. 국물이 맑아요 😋</p>}
      <div>
        {shown.map((f) => (
          <div key={f.id} className="flag-row" data-testid="flag-row">
            <div className="meta">
              {f.createdAt ? formatDateTime(f.createdAt.toMillis()) : ''} · <b>{names.get(f.studentId) ?? '(명단에서 빠진 학생)'}</b> · {roomNames.get(f.roomId) ?? '(지운 냄비)'}
            </div>
            <div className="orig">원래: {highlightedOriginal(f.original, f.masked)}</div>
            <div className="count">보인 문장: {f.masked}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
