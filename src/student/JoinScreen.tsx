import { useEffect, useState, type FormEvent } from 'react';
import { validatePin } from '../domain/identity';
import { ingredientByKey } from '../domain/ingredients';
import { BudaeError, NameTakenError } from '../data/errors';
import { claimStudent, loginStudent } from '../data/students';
import type { Student, WithId } from '../data/types';
import { Avatar, IngredientTag } from '../components/Avatar';
import { IngredientGrid } from '../components/IngredientGrid';
import { PotHeader } from '../components/PotHeader';
import { loadLastStudentId, saveLastStudentId } from './storage';

const messageOf = (e: unknown) => (e instanceof BudaeError && e.message ? e.message : '문제가 생겼어요. 잠시 후 다시 해 보세요.');

/** Pick your name from the roster; first time you also pick an ingredient and set a PIN. */
export function JoinScreen({ roster, notice }: { roster: WithId<Student>[] | null; notice?: string | null }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ingredient, setIngredient] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Names that turned out to be taken while this screen was open.
  const [takenNow, setTakenNow] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selected || !roster) return;
    const last = loadLastStudentId();
    if (last && roster.some((s) => s.id === last)) setSelected(last);
  }, [roster, selected]);

  const student = roster?.find((s) => s.id === selected) ?? null;
  const claimed = !!student && (student.claimedGen != null || takenNow.has(student.id));

  function pick(id: string) {
    setSelected(id);
    setPin('');
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!student || busy) return;
    const bad = validatePin(pin);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      if (claimed) await loginStudent(student.id, pin);
      else await claimStudent(student.id, pin, ingredient!);
      saveLastStudentId(student.id);
    } catch (err) {
      if (err instanceof NameTakenError) {
        setTakenNow((s) => new Set(s).add(student.id));
        setPin('');
      }
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const ing = ingredient ? ingredientByKey(ingredient) : undefined;
  return (
    <div className="screen">
      <PotHeader title="부대찌개반에 어서 와!" subtitle="오늘은 어떤 재료로 들어갈래?" logo="🍲" fireOn />
      <form className="body" onSubmit={submit}>
        {notice && <div className="errbox" role="alert" style={{ margin: 0 }}>{notice}</div>}

        <div className="lbl">1. 내 이름 고르기</div>
        {!roster && <p className="note">명단을 불러오는 중…</p>}
        {roster?.length === 0 && <p className="note">아직 명단이 비어 있어요. 선생님이 명단을 넣으면 여기에 이름이 보여요.</p>}
        {roster && roster.length > 0 && (
          <>
            <div className="names" role="group" aria-label="이름 고르기">
              {roster.map((s) => (
                <button key={s.id} type="button" aria-pressed={s.id === selected} onClick={() => pick(s.id)}
                  className={s.claimedGen != null || takenNow.has(s.id) ? 'nm taken' : 'nm'}>
                  {(s.claimedGen != null || takenNow.has(s.id)) && <span className="tick" aria-hidden>✔ </span>}
                  {s.name}
                </button>
              ))}
            </div>
            <p className="note">✔ 표시는 이미 가입한 이름이에요. 누르면 암호만 넣고 들어가요.</p>
          </>
        )}

        {student && !claimed && (
          <>
            <div className="lbl">2. 나는 어떤 재료?</div>
            <IngredientGrid value={ingredient} onChange={setIngredient} />
            <p className="note">여러 친구가 같은 재료를 골라도 돼요. 들어간 뒤에도 바꿀 수 있어요.</p>
          </>
        )}

        {student && (
          <>
            <div className="lbl">{claimed ? '2. 암호 넣기' : '3. 암호 정하기'}</div>
            <input className="input" type="password" inputMode="numeric" autoComplete={claimed ? 'current-password' : 'new-password'}
              value={pin} onChange={(e) => setPin(e.target.value)} aria-label="암호"
              placeholder={claimed ? '내 암호' : '4자리 이상'} />
            {!claimed && <p className="note">잊어버리면 선생님이 초기화해 줄 수 있어요.</p>}
          </>
        )}

        {student && !claimed && ing && (
          <>
            <div className="lbl">미리보기</div>
            <div className="preview">
              <Avatar ingredient={ing.key} />
              <div>
                <b>{student.name}</b><IngredientTag ingredient={ing.key} />
                <div className="count">대화방에서 이렇게 보여요</div>
              </div>
            </div>
          </>
        )}

        {error && <p className="err" role="alert">{error}</p>}

        {student && (
          <button className="btn" type="submit" disabled={busy || !pin || (!claimed && !ingredient)}>
            {busy ? '잠시만요…' : claimed ? '들어가기' : '냄비에 퐁당! 입장하기'}
          </button>
        )}
      </form>
    </div>
  );
}
