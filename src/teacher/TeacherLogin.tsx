import { useState } from 'react';
import { PotHeader } from '../components/PotHeader';
import { teacherSignIn, teacherSignOut } from '../data/teacher';

export function TeacherLogin() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await teacherSignIn();
    } catch {
      setError('로그인하지 못했어요. 팝업이 막혀 있다면 허용해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <PotHeader title="주방장 입구" subtitle="선생님만 들어올 수 있어요" logo="🧑‍🍳" fireOn />
      <div className="body">
        <p className="note" style={{ fontSize: 14 }}>등록된 선생님 구글 계정으로 로그인하면 냄비와 반 명단을 관리할 수 있어요.</p>
        <button type="button" className="btn" disabled={busy} onClick={() => void signIn()}>구글 계정으로 로그인</button>
        {error && <p className="err" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export function NotTeacher({ email }: { email: string | null }) {
  return (
    <div className="screen">
      <PotHeader title="주방장 입구" subtitle={email ?? ''} logo="🧑‍🍳" fireOn />
      <div className="body">
        <p className="center-note" style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 700 }}>방을 만들 권한이 없어요</p>
        <p className="note" style={{ textAlign: 'center' }}>선생님으로 등록된 구글 계정으로 다시 로그인해 주세요.</p>
        <button type="button" className="btn secondary" onClick={() => void teacherSignOut()}>로그아웃</button>
      </div>
    </div>
  );
}
