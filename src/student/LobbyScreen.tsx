import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isFireOn } from '../domain/fire';
import { ingredientByKey } from '../domain/ingredients';
import { SessionExpiredError } from '../data/errors';
import { UNREAD_CAP } from '../data/limits';
import { unreadCount } from '../data/messages';
import { watchMyRooms } from '../data/rooms';
import { toFireInput, type Room, type WithId } from '../data/types';
import { ingredientTint } from '../components/Avatar';
import { Flame, PotHeader } from '../components/PotHeader';
import { useNow } from '../components/useNow';
import { MeSheet } from './MeSheet';
import { useShell, withRo } from './shell';

const UNREAD_REFRESH_MS = 20_000;

export function LobbyScreen() {
  const { me, student, notice, setNotice, expire } = useShell();
  const navigate = useNavigate();
  const now = useNow();
  const [rooms, setRooms] = useState<WithId<Room>[] | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState(false);

  useEffect(() => watchMyRooms(me.id, setRooms, (e) => {
    if (e instanceof SessionExpiredError) expire(e);
    else setRooms([]);
  }), [me.id, expire]);

  const openIds = (rooms ?? []).filter((r) => !r.banned.includes(me.id)).map((r) => r.id).join(',');
  useEffect(() => {
    if (!openIds) return;
    let alive = true;
    const refresh = () => {
      for (const id of openIds.split(','))
        unreadCount(id, me.id).then((n) => alive && setUnread((u) => ({ ...u, [id]: n })), () => {});
    };
    refresh();
    const t = setInterval(refresh, UNREAD_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [openIds, me.id]);

  const ing = student.ingredient ? ingredientByKey(student.ingredient) : undefined;
  return (
    <div className="screen">
      <PotHeader
        title={student.name}
        subtitle={ing ? `${withRo(ing.label)} 참여 중` : '재료를 골라 주세요'}
        logo={<span style={{ background: ingredientTint(ing?.key), borderRadius: 14, width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>{ing?.emoji ?? '🍲'}</span>}
        fireOn
        right={<button type="button" className="pill" onClick={() => setSheet(true)}>내 재료 ▾</button>}
      />
      <div className="body">
        {notice && (
          <div className="errbox" role="alert" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="grow">{notice}</span>
            <button type="button" className="link-btn" onClick={() => setNotice(null)}>확인</button>
          </div>
        )}
        <div className="lbl">내가 들어가 있는 냄비</div>
        {!rooms && <p className="note">냄비를 찾는 중…</p>}
        {rooms?.length === 0 && <p className="center-note">아직 들어가 있는 냄비가 없어요.<br />선생님이 냄비에 넣어 주면 여기에 보여요.</p>}
        {rooms?.map((r) => {
          const banned = r.banned.includes(me.id);
          const on = isFireOn(toFireInput(r), now);
          const n = unread[r.id] ?? 0;
          return (
            <button key={r.id} type="button" disabled={banned} onClick={() => navigate(`/room/${r.id}`)}
              className={banned ? 'room banned' : on ? 'room' : 'room off'}>
              <div className="av" style={{ background: banned || !on ? '#F1ECE8' : 'var(--broth-soft)' }} aria-hidden>{r.emoji}</div>
              <div className="grow">
                <b>{r.name}</b>
                <div className="count">
                  {banned ? '이 냄비에서 잠시 나와 있어요'
                    : on ? <>{r.members.length}명 · <Flame /> 보글보글</>
                    : <>{r.members.length}명 · 💤 불 꺼짐</>}
                </div>
              </div>
              {!banned && n > 0 && <span className="badge" aria-label={`안 읽은 메시지 ${n}개`}>{n >= UNREAD_CAP ? '99+' : n}</span>}
            </button>
          );
        })}
      </div>
      <MeSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}
