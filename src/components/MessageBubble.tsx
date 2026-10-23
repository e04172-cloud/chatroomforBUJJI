import type { ReactNode } from 'react';
import { joinedLine } from '../domain/pot';
import type { Message } from '../data/types';
import { Avatar, IngredientTag } from './Avatar';
import { formatTime } from './time';

export const DELETED_TEXT = '주방장이 건져낸 메시지예요';

/** Wraps runs of ＊ so masked words read as a soft grey blot. */
function maskedText(text: string): ReactNode[] {
  return text.split(/(＊+)/).filter(Boolean).map((part, i) =>
    part.startsWith('＊') ? <span key={i} className="mask">{part}</span> : part);
}

/** Highlights, in the original, the characters the mask replaced (maskText keeps one ＊ per character). */
export function highlightedOriginal(original: string, masked: string): ReactNode[] {
  const o = [...original];
  const m = [...masked];
  const out: ReactNode[] = [];
  let run = '';
  let runHit = false;
  const flush = () => {
    if (run) out.push(runHit ? <mark key={out.length} className="hit">{run}</mark> : run);
    run = '';
  };
  o.forEach((ch, i) => {
    const hit = m[i] === '＊' && ch !== '＊';
    if (hit !== runHit) {
      flush();
      runHit = hit;
    }
    run += ch;
  });
  flush();
  return out;
}

export function MessageBubble({ msg, mine, teacherView, original, onDelete }: {
  msg: Message;
  mine: boolean;
  teacherView?: boolean;
  original?: string;
  onDelete?: () => void;
}) {
  const at = msg.createdAt ? msg.createdAt.toMillis() : Date.now();

  if (msg.kind === 'joined') {
    return <div className="sys">{joinedLine(msg.authorName, msg.ingredient ?? '')}</div>;
  }
  if (msg.kind === 'fire') {
    const line = msg.text === 'off' ? '💨 냄비 불이 꺼졌어요' : '🔥 냄비 불이 켜졌어요';
    return <div className="sys">{line} · {formatTime(at)}</div>;
  }

  const teacher = msg.authorId === 'teacher';
  let body: ReactNode;
  let cls = teacher ? 'bub teacher' : 'bub';
  if (msg.deleted) {
    body = DELETED_TEXT;
    cls = 'bub deleted';
  } else if (teacherView && original && msg.flagged) {
    body = <>{highlightedOriginal(original, msg.text)}<span className="masked-tag">가려짐</span></>;
  } else {
    body = maskedText(msg.text);
  }

  return (
    <div className={mine ? 'm-row me' : 'm-row'} data-author={msg.authorId}>
      <Avatar ingredient={msg.ingredient} teacher={teacher} />
      <div className="m-main">
        {!mine && (
          <div className="who">
            <b>{msg.authorName}</b>
            {teacher ? <span className="teacher-badge">주방장</span> : <IngredientTag ingredient={msg.ingredient} />}
          </div>
        )}
        <div className="m-line">
          <div className={cls}>{body}</div>
          {onDelete && !msg.deleted && (
            <button type="button" className="del-chip" onClick={onDelete} aria-label={`${msg.authorName}의 메시지 삭제`}>🗑 삭제</button>
          )}
          <span className="time">{formatTime(at)}</span>
        </div>
      </div>
    </div>
  );
}
