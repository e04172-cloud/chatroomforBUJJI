import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isFireOn, nextChangeLabel } from '../domain/fire';
import { ingredientByKey } from '../domain/ingredients';
import { BannedError, BudaeError, FireOffError, SessionExpiredError, TooFastError } from '../data/errors';
import { markRead, sendMessage, watchMessages } from '../data/messages';
import { joinPresence, watchOnlineCount } from '../data/presence';
import { watchRoom } from '../data/rooms';
import { toFireInput, type Message, type Room, type WithId } from '../data/types';
import { Composer } from '../components/Composer';
import { FireBanner } from '../components/FireBanner';
import { MessageBubble } from '../components/MessageBubble';
import { MessageList, scrollToBottomSoon } from '../components/MessageList';
import { Flame, PotHeader } from '../components/PotHeader';
import { TodayPot } from '../components/TodayPot';
import { useNow } from '../components/useNow';
import { MeSheet } from './MeSheet';
import { useShell } from './shell';

export const WARN_TEXT = '⚠️ 국물이 탁해져요! 바르고 고운 말을 써요. 부적절한 표현은 가려서 보냈어요.';
export const BANNED_TEXT = '이 냄비에서 잠시 나와 있어요';
const READ_THROTTLE_MS = 10_000;

export function RoomScreen() {
  const { roomId = '' } = useParams();
  const { me, student, roster, setNotice, expire } = useShell();
  const navigate = useNavigate();
  const now = useNow();
  const [room, setRoom] = useState<WithId<Room> | null>(null);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [online, setOnline] = useState(0);
  const [warn, setWarn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  const leave = useCallback((e: unknown) => {
    if (e instanceof SessionExpiredError) return expire(e);
    setNotice(e instanceof BannedError ? BANNED_TEXT : e instanceof BudaeError ? e.message : '이 냄비에 들어갈 수 없어요');
    navigate('/', { replace: true });
  }, [expire, navigate, setNotice]);

  useEffect(() => watchRoom(roomId, (r) => {
    if (r.banned.includes(me.id)) leave(new BannedError());
    else setRoom(r);
  }, leave), [roomId, me.id, leave]);
  useEffect(() => watchMessages(roomId, setMessages, leave), [roomId, leave]);
  useEffect(() => joinPresence(roomId, me.id), [roomId, me.id]);
  useEffect(() => watchOnlineCount(roomId, setOnline), [roomId]);

  // Mark read on entry, at most every few seconds while new messages arrive, and on the way out.
  const lastRead = useRef(0);
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    if (Date.now() - lastRead.current < READ_THROTTLE_MS) return;
    lastRead.current = Date.now();
    markRead(roomId, me.id).catch(() => {});
  }, [roomId, me.id, lastId]);
  useEffect(() => () => void markRead(roomId, me.id).catch(() => {}), [roomId, me.id]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const memberIngredients = useMemo(() => {
    if (!room) return [];
    const byId = new Map(roster.map((s) => [s.id, s.ingredient]));
    return room.members.filter((id) => !room.banned.includes(id)).map((id) => byId.get(id) ?? null);
  }, [room, roster]);

  if (!room) return <div className="screen"><p className="center-note">냄비를 여는 중…</p></div>;

  const fire = toFireInput(room);
  const on = isFireOn(fire, now);
  const ing = student.ingredient ? ingredientByKey(student.ingredient) : undefined;

  async function send(text: string) {
    setError(null);
    try {
      const { flagged } = await sendMessage(roomId, text, { id: me.id, name: student.name, ingredient: student.ingredient });
      setWarn(flagged);
      scrollToBottomSoon();
    } catch (e) {
      if (e instanceof SessionExpiredError || e instanceof BannedError) leave(e);
      else if (e instanceof TooFastError || e instanceof FireOffError) setError(e.message);
      else setError(e instanceof BudaeError ? e.message : '보내지 못했어요. 인터넷 연결을 확인해 주세요.');
      throw e;
    }
  }

  return (
    <div className={on ? 'screen fixed' : 'screen fixed chat-off'}>
      <PotHeader
        title={room.name}
        logo={room.emoji}
        fireOn={on}
        subtitle={on
          ? <>{room.members.length}명 · <Flame /> 지금 {online}명 보글보글</>
          : <>{room.members.length}명 · 💤 불 꺼짐</>}
        right={<>
          <button type="button" className="icon-btn" aria-label="냄비 목록으로" onClick={() => navigate('/')}>☰</button>
          <button type="button" className="pill" onClick={() => setSheet(true)} aria-label="내 재료와 메뉴">
            {ing?.emoji}<span className="pill-name"> {student.name}</span> ▾
          </button>
        </>}
      />
      <TodayPot ingredientKeys={memberIngredients} />
      {!on && <FireBanner nextLabel={nextChangeLabel(fire, now)} />}
      <MessageList
        messages={messages}
        empty={<p className="center-note">아직 조용한 냄비예요. 첫 마디를 넣어 볼까요?</p>}
        renderItem={(m) => <MessageBubble msg={m} mine={m.authorId === me.id} />}
      />
      {warn && <div className="warnbox" role="alert">{WARN_TEXT}</div>}
      {error && <div className="errbox" role="alert">{error}</div>}
      <Composer disabled={!on} disabledText="💤 불이 꺼져 있어서 쓸 수 없어요" onSend={send} leading={ing?.emoji} />
      <MeSheet open={sheet} onClose={() => setSheet(false)} onLobby={() => navigate('/')} />
    </div>
  );
}
