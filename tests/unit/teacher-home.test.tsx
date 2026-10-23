import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as rooms from '../../src/data/rooms';
import * as students from '../../src/data/students';
import * as teacher from '../../src/data/teacher';
import type { Student, WithId } from '../../src/data/types';
import { TeacherApp } from '../../src/teacher/TeacherApp';
import { TeacherHome } from '../../src/teacher/TeacherHome';
import { RosterPanel, parseNames } from '../../src/teacher/RosterPanel';
import { TeacherContext, type TeacherShell } from '../../src/teacher/shell';
import { room } from './fixtures';

vi.mock('../../src/data/teacher', () => ({
  watchUser: vi.fn(),
  isTeacherUser: vi.fn(),
  teacherSignIn: vi.fn(),
  teacherSignOut: vi.fn(),
}));
vi.mock('../../src/data/students', () => ({
  watchRoster: vi.fn(() => () => {}),
  addStudent: vi.fn(async () => 'new'),
  removeStudent: vi.fn(async () => {}),
  resetPin: vi.fn(async () => {}),
}));
vi.mock('../../src/data/rooms', () => ({ watchAllRooms: vi.fn(() => () => {}), createRoom: vi.fn(async () => 'NEW') }));
vi.mock('../../src/data/settings', () => ({ watchSettings: vi.fn(() => () => {}), setExtraWords: vi.fn(), setTeacherName: vi.fn() }));
vi.mock('../../src/data/flags', () => ({ watchFlags: vi.fn(() => () => {}) }));
vi.mock('../../src/data/messages', () => ({}));
vi.mock('../../src/data/presence', () => ({}));

const s = (id: string, name: string, claimed = true): WithId<Student> =>
  ({ id, name, order: 1, gen: 1, claimedGen: claimed ? 1 : null, ingredient: claimed ? 'cheese' : null });
const ROSTER = [s('a', '김가은'), s('b', '김도윤', false), s('c', '박서준')];
let shell: TeacherShell;

beforeEach(() => {
  shell = { roster: ROSTER, rooms: [room()], settings: { teacherName: '담임선생님', extraWords: [] } };
  vi.clearAllMocks();
});

function renderHome(ui = <TeacherHome />) {
  return render(
    <TeacherContext.Provider value={shell}>
      <MemoryRouter initialEntries={['/teacher']}>
        <Routes>
          <Route path="/teacher" element={ui} />
          <Route path="/teacher/room/:id" element={<p>ROOM</p>} />
        </Routes>
      </MemoryRouter>
    </TeacherContext.Provider>,
  );
}

describe('TeacherApp', () => {
  test('선생님이 아닌 계정은 권한 없음 안내', () => {
    vi.mocked(teacher.watchUser).mockImplementation((cb) => {
      cb({ email: 'kid@gmail.com', emailVerified: true } as teacher.User);
      return () => {};
    });
    vi.mocked(teacher.isTeacherUser).mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/teacher']}><Routes><Route path="/teacher/*" element={<TeacherApp />} /></Routes></MemoryRouter>);
    expect(screen.getByText('방을 만들 권한이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  test('로그인 전에는 구글 로그인 버튼', async () => {
    vi.mocked(teacher.watchUser).mockImplementation((cb) => {
      cb(null);
      return () => {};
    });
    render(<MemoryRouter initialEntries={['/teacher']}><Routes><Route path="/teacher/*" element={<TeacherApp />} /></Routes></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: '구글 계정으로 로그인' }));
    expect(teacher.teacherSignIn).toHaveBeenCalled();
  });
});

describe('반 명단', () => {
  test('parseNames: 빈 줄 무시, 앞뒤 공백 제거, 있는 이름은 건너뜀', () => {
    expect(parseNames('김가은\n 이시우 \n\n이시우\n김도윤\n', ['김가은'])).toEqual({ add: ['이시우', '김도윤'], skipped: ['김가은', '이시우'] });
  });

  test('여러 줄 붙여넣기로 한 번에 추가', async () => {
    renderHome(<RosterPanel />);
    await userEvent.type(screen.getByLabelText('학생 이름 붙여넣기'), '이시우{Enter}최유나{Enter}{Enter}김가은');
    await userEvent.click(screen.getByRole('button', { name: '명단에 넣기' }));
    expect(students.addStudent).toHaveBeenCalledTimes(2);
    expect(students.addStudent).toHaveBeenNthCalledWith(1, '이시우');
    expect(students.addStudent).toHaveBeenNthCalledWith(2, '최유나');
    expect(screen.getByText(/이미 있는 이름은 건너뛰었어요: 김가은/)).toBeInTheDocument();
  });

  test('명단에서 삭제는 확인창에서 삭제를 눌러야 한다', async () => {
    renderHome(<RosterPanel />);
    await userEvent.click(screen.getByRole('button', { name: '김가은 명단에서 삭제' }));
    expect(students.removeStudent).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    expect(students.removeStudent).toHaveBeenCalledWith('a');
  });

  test('암호 초기화 안내', async () => {
    renderHome(<RosterPanel />);
    await userEvent.click(screen.getByRole('button', { name: '김가은 암호 초기화' }));
    expect(students.resetPin).toHaveBeenCalledWith('a');
    expect(screen.getByText(/다음에 들어올 때 새 암호를 정해요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '김도윤 암호 초기화' })).toBeDisabled();
  });
});

describe('냄비 만들기', () => {
  test('이름이 비면 만들 수 없고, 체크한 학생이 members로 간다', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: '＋ 새 냄비 만들기' }));
    const dialog = screen.getByRole('dialog');
    const make = within(dialog).getByRole('button', { name: '냄비 만들기' });
    expect(make).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('냄비 이름'), '과학 모둠');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: '김도윤' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '🔬' }));
    await userEvent.click(make);
    expect(rooms.createRoom).toHaveBeenCalledWith({ name: '과학 모둠', emoji: '🔬', members: ['a', 'c'] });
    expect(await screen.findByText('ROOM')).toBeInTheDocument();
  });

  test('참여 링크 복사', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: '🔗 참여 링크 복사' }));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/`);
    expect(screen.getByText('✔ 복사했어요')).toBeInTheDocument();
  });
});
