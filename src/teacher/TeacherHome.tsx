import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isFireOn } from '../domain/fire';
import { createRoom } from '../data/rooms';
import { teacherSignOut } from '../data/teacher';
import { toFireInput } from '../data/types';
import { Flame, PotHeader } from '../components/PotHeader';
import { Sheet } from '../components/Sheet';
import { useNow } from '../components/useNow';
import { CopyLink } from './CopyLink';
import { FilterSettings } from './FilterSettings';
import { FlagLog } from './FlagLog';
import { RoomEditor } from './RoomEditor';
import { RosterPanel } from './RosterPanel';
import { useTeacher } from './shell';

const TABS = [['rooms', '🍲 냄비'], ['roster', '📋 반 명단'], ['flags', '⚠️ 경고 기록'], ['settings', '⚙️ 설정']] as const;
type Tab = (typeof TABS)[number][0];

export function TeacherHome() {
  const { roster, rooms, settings } = useTeacher();
  const navigate = useNavigate();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('rooms');
  const [creating, setCreating] = useState(false);

  return (
    <div className="screen wide">
      <PotHeader
        title={`${settings.teacherName} 주방`}
        subtitle={`반 명단 ${roster.length}명 · 냄비 ${rooms.length}개`}
        logo="🧑‍🍳"
        fireOn
        right={<><CopyLink /><button type="button" className="pill" onClick={() => void teacherSignOut()}>로그아웃</button></>}
      />
      <div className="body">
        <div className="tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" className="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {tab === 'rooms' && (
          <div className="list">
            <button type="button" className="btn" style={{ marginTop: 0 }} onClick={() => setCreating(true)}>＋ 새 냄비 만들기</button>
            {rooms.length === 0 && <p className="center-note">아직 냄비가 없어요. 반 명단을 넣고 첫 냄비를 만들어 보세요.</p>}
            {rooms.map((r) => {
              const on = isFireOn(toFireInput(r), now);
              return (
                <button key={r.id} type="button" className={on ? 'room' : 'room off'} onClick={() => navigate(`room/${r.id}`)}>
                  <div className="av" style={{ background: on ? 'var(--broth-soft)' : '#F1ECE8' }} aria-hidden>{r.emoji}</div>
                  <div className="grow">
                    <b>{r.name}</b>
                    <div className="count">
                      {r.members.length}명 · {on ? <><Flame /> 보글보글</> : '💤 불 꺼짐'}
                      {r.banned.length > 0 && ` · 추방 ${r.banned.length}명`}
                    </div>
                  </div>
                  <span aria-hidden style={{ color: 'var(--sub)' }}>›</span>
                </button>
              );
            })}
          </div>
        )}
        {tab === 'roster' && <RosterPanel />}
        {tab === 'flags' && <FlagLog />}
        {tab === 'settings' && <FilterSettings />}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="새 냄비 만들기">
        <RoomEditor roster={roster} submitLabel="냄비 만들기" onSubmit={async (d) => {
          const id = await createRoom(d);
          setCreating(false);
          navigate(`room/${id}`);
        }} />
      </Sheet>
    </div>
  );
}
