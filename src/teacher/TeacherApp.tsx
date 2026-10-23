import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { watchAllRooms } from '../data/rooms';
import { watchSettings } from '../data/settings';
import { watchRoster } from '../data/students';
import { isTeacherUser, watchUser, type User } from '../data/teacher';
import type { Room, Settings, Student, WithId } from '../data/types';
import { TeacherHome } from './TeacherHome';
import { NotTeacher, TeacherLogin } from './TeacherLogin';
import { TeacherRoom } from './TeacherRoom';
import { TeacherContext } from './shell';

const Loading = () => <div className="screen"><p className="center-note">주방 불 켜는 중…</p></div>;

/** Route "/teacher": Google sign-in, then rooms, roster, flag log and settings. */
export function TeacherApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => watchUser(setUser), []);

  if (user === undefined) return <Loading />;
  if (!user) return <TeacherLogin />;
  if (!isTeacherUser(user)) return <NotTeacher email={user.email} />;
  return <Kitchen />;
}

function Kitchen() {
  const [roster, setRoster] = useState<WithId<Student>[] | null>(null);
  const [rooms, setRooms] = useState<WithId<Room>[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => watchRoster(setRoster), []);
  useEffect(() => watchAllRooms(setRooms), []);
  useEffect(() => watchSettings(setSettings), []);

  const shell = useMemo(() => (roster && rooms && settings ? { roster, rooms, settings } : null), [roster, rooms, settings]);
  if (!shell) return <Loading />;
  return (
    <TeacherContext.Provider value={shell}>
      <Routes>
        <Route index element={<TeacherHome />} />
        <Route path="room/:roomId" element={<TeacherRoom />} />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Routes>
    </TeacherContext.Provider>
  );
}
