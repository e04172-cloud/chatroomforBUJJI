import { useState, type FormEvent } from 'react';
import { BASE_WORDS } from '../domain/wordlist';
import { setExtraWords, setTeacherName } from '../data/settings';
import { useTeacher } from './shell';

export function FilterSettings() {
  const { settings } = useTeacher();
  const [word, setWord] = useState('');
  const [name, setName] = useState(settings.teacherName);
  const [message, setMessage] = useState<string | null>(null);

  async function addWord(e: FormEvent) {
    e.preventDefault();
    const w = word.trim();
    if (!w) return;
    setWord('');
    if (settings.extraWords.includes(w)) return setMessage(`"${w}"는 이미 들어 있어요.`);
    await setExtraWords([...settings.extraWords, w]);
    setMessage(null);
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    try {
      await setTeacherName(name);
      setMessage('선생님 이름을 바꿨어요.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '바꾸지 못했어요.');
    }
  }

  return (
    <div className="t-grid">
      <div className="card">
        <h3 className="section-title">금지어</h3>
        <p className="note">기본 욕설 {BASE_WORDS.length}개와 띄어쓰기·특수문자 변형은 이미 가려요. 반에서 따로 막고 싶은 말을 넣으세요.</p>
        <form className="row-gap" style={{ marginTop: 10, flexWrap: 'nowrap' }} onSubmit={addWord}>
          <input className="input" value={word} onChange={(e) => setWord(e.target.value)} placeholder="예: 바보" aria-label="금지어" maxLength={20} />
          <button type="submit" className="btn small" disabled={!word.trim()}>추가</button>
        </form>
        <div className="row-gap" style={{ marginTop: 12 }}>
          {settings.extraWords.length === 0 && <span className="note">아직 추가한 말이 없어요.</span>}
          {settings.extraWords.map((w) => (
            <span key={w} className="word-chip">
              {w}
              <button type="button" aria-label={`${w} 빼기`} onClick={() => void setExtraWords(settings.extraWords.filter((x) => x !== w))}>×</button>
            </span>
          ))}
        </div>
      </div>
      <div className="card">
        <h3 className="section-title">선생님 이름</h3>
        <p className="note">대화방에 🧑‍🍳 주방장 배지와 함께 보이는 이름이에요.</p>
        <form className="row-gap" style={{ marginTop: 10, flexWrap: 'nowrap' }} onSubmit={saveName}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="선생님 이름" />
          <button type="submit" className="btn small" disabled={!name.trim() || name.trim() === settings.teacherName}>저장</button>
        </form>
      </div>
      {message && <p className="ok" role="status">{message}</p>}
    </div>
  );
}
