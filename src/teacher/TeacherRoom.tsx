import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isFireOn, nextChangeLabel } from '../domain/fire';
import { watchFlagsForRoom } from '../data/flags';
import { deleteMessage, sendMessage, watchMessages } from '../data/messages';
import { watchOnlineIds } from '../data/presence';
import { ban, deleteRoom, setFire, setSchedule, unban, updateRoom, updateRoomMembers, watchRoom } from '../data/rooms';
import { toFireInput, type Flag, type Message, type Room, type WithId } from '../data/types';
import { Avatar } from '../components/Avatar';
import { Composer } from '../components/Composer';
import { Confirm } from '../components/Confirm';
import { MessageBubble } from '../components/MessageBubble';
import { MessageList, scrollToBottomSoon } from '../components/MessageList';
import { Flame, PotHeader } from '../components/PotHeader';
import { Sheet } from '../components/Sheet';
import { useNow } from '../components/useNow';
import { CopyLink } from './CopyLink';
import { RoomEditor } from './RoomEditor';
import { useTeacher } from './shell';

const pad = (n: number) => String(n).padStart(2, '0');
export const toHHMM = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const fromHHMM = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null;
};

function FireSwitch({ room, on }: { room: WithId<Room>; on: boolean }) {
  return (
    <span className="tog-hit">
      <button type="button" className="tog" role="switch" aria-checked={on} aria-label="냄비 불"
        onClick={() => void setFire(room.id, on ? 'off' : 'on')} />
    </span>
  );
}

function FirePanel({ room, on, now }: { room: WithId<Room>; on: boolean; now: number }) {
  const [draft, setDraft] = useState(room.schedule);
  useEffect(() => setDraft(room.schedule), [room.schedule]);

  const change = (patch: Partial<Room['schedule']>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void setSchedule(room.id, next);
  };
  const next = nextChangeLabel(toFireInput(room), now);

  return (
    <>
      <div className={on ? 'fire-box' : 'fire-box off'}>
        <span className="grow">{on ? <><Flame /> 냄비 불 켜짐</> : '💤 냄비 불 꺼짐'}</span>
        <FireSwitch room={room} on={on} />
      </div>
      <div className="sched">
        <label className="row-gap" style={{ gap: 4 }}>
          <input type="checkbox" checked={draft.enabled} onChange={(e) => change({ enabled: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: 'var(--broth)' }} aria-label="자동 불 끄기 사용" />
          ⏰ 자동 불 끄기
        </label>
        <div className="sched-times">
          <input type="time" className="tm" value={toHHMM(draft.offMin)} aria-label="끄는 시각" disabled={!draft.enabled}
            onChange={(e) => { const m = fromHHMM(e.target.value); if (m !== null) change({ offMin: m }); }} />
          ~
          <input type="time" className="tm" value={toHHMM(draft.onMin)} aria-label="켜는 시각" disabled={!draft.enabled}
            onChange={(e) => { const m = fromHHMM(e.target.value); if (m !== null) change({ onMin: m }); }} />
          매일
        </div>
        {next && <div style={{ width: '100%', fontSize: 12 }}>{next}</div>}
      </div>
    </>
  );
}

function MembersPanel({ room, online }: { room: WithId<Room>; online: Set<string> }) {
  const { roster } = useTeacher();
  const [menu, setMenu] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const byId = new Map(roster.map((s) => [s.id, s]));
  const members = room.members.map((id) => byId.get(id)).filter((s) => s !== undefined);
  const outside = roster.filter((s) => !room.members.includes(s.id));

  return (
    <>
      <div className="side-head">
        <h4>재료 명단</h4>
        <span className="count">{members.length}명 · 접속 {online.size}명</span>
        <button type="button" className="add-btn" onClick={() => { setPicked(new Set()); setAdding(true); }}>＋ 추가</button>
      </div>
      <div className="plist">
        {members.map((s) => {
          const banned = room.banned.includes(s.id);
          return (
            <div key={s.id}>
              <div className={menu === s.id ? 'p open' : 'p'} data-member={s.name}>
                <Avatar ingredient={s.ingredient} size={32} />
                <span className="nm-text" style={s.claimedGen == null ? { color: 'var(--sub)' } : undefined}>{s.name}</span>
                {online.has(s.id) && <span className="dot-on" aria-label="접속 중" />}
                {banned
                  ? <button type="button" className="st ban" onClick={() => void unban(room.id, s.id)}>추방됨 · 풀기</button>
                  : s.claimedGen == null && <span className="st wait">미가입</span>}
                <button type="button" className="more-btn" aria-label={`${s.name} 메뉴`} aria-expanded={menu === s.id}
                  onClick={() => setMenu(menu === s.id ? null : s.id)}>⋯</button>
              </div>
              {menu === s.id && (
                <div className="menu">
                  {!banned && <button type="button" className="d" onClick={() => { setMenu(null); void ban(room.id, s.id); }}>🚫 추방하기</button>}
                  <button type="button" className="d" onClick={() => { setMenu(null); void updateRoomMembers(room.id, room.members.filter((x) => x !== s.id)); }}>
                    이 냄비에서 빼기
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="냄비에 학생 넣기">
        {outside.length === 0 ? <p className="note">반 명단의 모든 학생이 이미 들어와 있어요.</p> : (
          <div className="check-grid">
            {outside.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" checked={picked.has(s.id)} onChange={() => setPicked((p) => {
                  const n = new Set(p);
                  if (n.has(s.id)) n.delete(s.id);
                  else n.add(s.id);
                  return n;
                })} />
                <span className="nm-text">{s.name}</span>
              </label>
            ))}
          </div>
        )}
        <button type="button" className="btn" disabled={picked.size === 0} onClick={() => {
          void updateRoomMembers(room.id, [...room.members, ...picked]);
          setAdding(false);
        }}>{picked.size}명 넣기</button>
      </Sheet>
    </>
  );
}

function SidePanel({ room, on, now, online, onEdit, onDelete }: {
  room: WithId<Room>; on: boolean; now: number; online: Set<string>; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <>
      <FirePanel room={room} on={on} now={now} />
      <MembersPanel room={room} online={online} />
      <div className="row-gap" style={{ padding: '8px 12px 16px', marginTop: 'auto' }}>
        <button type="button" className="link-btn" onClick={onEdit}>✏️ 냄비 고치기</button>
        <button type="button" className="link-btn" style={{ color: 'var(--danger)' }} onClick={onDelete}>🗑 냄비 지우기</button>
      </div>
    </>
  );
}

export function TeacherRoom() {
  const { roomId = '' } = useParams();
  const { roster } = useTeacher();
  const navigate = useNavigate();
  const now = useNow();
  const [room, setRoom] = useState<WithId<Room> | null>(null);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [flags, setFlags] = useState<Map<string, Flag>>(new Map());
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [toDelete, setToDelete] = useState<WithId<Message> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const home = () => navigate('/teacher', { replace: true });
  useEffect(() => watchRoom(roomId, setRoom, () => navigate('/teacher', { replace: true })), [roomId, navigate]);
  useEffect(() => watchMessages(roomId, setMessages, () => {}), [roomId]);
  useEffect(() => watchFlagsForRoom(roomId, setFlags), [roomId]);
  useEffect(() => watchOnlineIds(roomId, setOnline), [roomId]);

  if (!room) return <div className="screen wide"><p className="center-note">냄비를 여는 중…</p></div>;
  const on = isFireOn(toFireInput(room), now);

  async function send(text: string) {
    setError(null);
    try {
      await sendMessage(roomId, text, 'teacher');
      scrollToBottomSoon();
    } catch (e) {
      setError('보내지 못했어요. 인터넷 연결을 확인해 주세요.');
      throw e;
    }
  }

  const side = (
    <SidePanel room={room} on={on} now={now} online={online}
      onEdit={() => { setPanel(false); setEditing(true); }} onDelete={() => { setPanel(false); setRemoving(true); }} />
  );

  return (
    <div className="screen wide fixed">
      <PotHeader
        title={room.name}
        logo={room.emoji}
        fireOn={on}
        subtitle={on ? <>{room.members.length}명 · <Flame /> {online.size}명 보글보글</> : <>{room.members.length}명 · 💤 불 꺼짐</>}
        right={<>
          <span className="only-mobile"><FireSwitch room={room} on={on} /></span>
          <button type="button" className="icon-btn only-mobile" aria-label="불과 학생 관리" onClick={() => setPanel(true)}>👥</button>
          <span style={{ display: 'contents' }} className="hide-mobile"><CopyLink /></span>
          <button type="button" className="icon-btn" aria-label="주방으로" onClick={home}>✕</button>
        </>}
      />
      <div className="t-layout">
        <div className="t-chat">
          <MessageList
            messages={messages}
            empty={<p className="center-note">아직 조용한 냄비예요. 첫 공지를 넣어 보세요.</p>}
            renderItem={(m) => (
              <MessageBubble msg={m} mine={m.authorId === 'teacher'} teacherView original={flags.get(m.id)?.original}
                onDelete={m.kind === 'text' && m.authorId !== 'teacher' ? () => setToDelete(m) : undefined} />
            )}
          />
          {error && <div className="errbox" role="alert">{error}</div>}
          <Composer disabled={false} onSend={send} leading="🧑‍🍳" placeholder="공지나 메시지를 입력하세요" />
        </div>
        <aside className="side" aria-label="냄비 관리">{side}</aside>
      </div>

      <Sheet open={panel} onClose={() => setPanel(false)} title="불과 학생 관리">
        <div className="side" style={{ border: 0, borderRadius: 14 }}>{side}</div>
      </Sheet>
      <Sheet open={editing} onClose={() => setEditing(false)} title="냄비 고치기">
        <RoomEditor roster={roster} initial={room} submitLabel="저장" onSubmit={async (d) => {
          await updateRoom(room.id, { name: d.name, emoji: d.emoji });
          await updateRoomMembers(room.id, d.members);
          setEditing(false);
        }} />
      </Sheet>
      <Confirm open={removing} title={`"${room.name}" 냄비를 지울까요?`} confirmLabel="냄비 지우기" onClose={() => setRemoving(false)}
        onConfirm={async () => { await deleteRoom(room.id); home(); }}>
        이 냄비의 대화와 경고 기록이 모두 지워지고 되돌릴 수 없어요.
      </Confirm>
      <Confirm open={!!toDelete} title="이 메시지를 건져낼까요?" confirmLabel="🗑 삭제" onClose={() => setToDelete(null)}
        onConfirm={() => deleteMessage(roomId, toDelete!.id)}>
        <b>{toDelete?.authorName}</b>: {toDelete && (flags.get(toDelete.id)?.original ?? toDelete.text)}
        <br />학생들에게는 "주방장이 건져낸 메시지예요"로 보여요.
      </Confirm>
    </div>
  );
}
