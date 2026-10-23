import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { SessionExpiredError } from '../data/errors';
import { logout, watchCurrentStudent, watchRoster, watchSession, type Me } from '../data/students';
import type { Student, WithId } from '../data/types';
import { JoinScreen } from './JoinScreen';
import { LobbyScreen } from './LobbyScreen';
import { RoomScreen } from './RoomScreen';
import { ShellContext, type StudentShell } from './shell';

const Loading = () => <div className="screen"><p className="center-note">냄비 데우는 중…</p></div>;

/** Route "/": join screen when signed out, otherwise the room list and rooms. */
export function StudentApp() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [roster, setRoster] = useState<WithId<Student>[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => watchRoster(setRoster, () => setRoster([])), []);
  useEffect(() => watchCurrentStudent(setMe), []);

  const expire = useCallback((e: SessionExpiredError) => {
    setNotice(e.message);
    void logout();
  }, []);
  useEffect(() => (me ? watchSession(expire) : undefined), [me, expire]);

  // A fresh sign-in starts without the previous session's notice.
  const meId = me?.id;
  useEffect(() => {
    if (meId) setNotice(null);
  }, [meId]);

  const student = me && roster?.find((s) => s.id === me.id);
  const shell = useMemo<StudentShell | null>(
    () => (me && student && roster ? { me, student, roster, notice, setNotice, expire } : null),
    [me, student, roster, notice, expire],
  );

  if (me === undefined) return <Loading />;
  if (!me) return <JoinScreen roster={roster} notice={notice} />;
  if (!shell) return <Loading />;
  return (
    <ShellContext.Provider value={shell}>
      <Routes>
        <Route path="/" element={<LobbyScreen />} />
        <Route path="/room/:roomId" element={<RoomScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShellContext.Provider>
  );
}
