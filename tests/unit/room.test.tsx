import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { BannedError, TooFastError } from '../../src/data/errors';
import * as messages from '../../src/data/messages';
import * as presence from '../../src/data/presence';
import * as rooms from '../../src/data/rooms';
import type { Message, Room, Student, WithId } from '../../src/data/types';
import { LobbyScreen } from '../../src/student/LobbyScreen';
import { BANNED_TEXT, RoomScreen, WARN_TEXT } from '../../src/student/RoomScreen';
import { ShellContext, type StudentShell } from '../../src/student/shell';
import { msg, room as roomFixture } from './fixtures';

vi.mock('../../src/data/students', () => ({ setIngredient: vi.fn(), logout: vi.fn() }));
vi.mock('../../src/data/rooms', () => ({ watchRoom: vi.fn(), watchMyRooms: vi.fn() }));
vi.mock('../../src/data/messages', () => ({
  watchMessages: vi.fn(),
  sendMessage: vi.fn(),
  markRead: vi.fn(async () => {}),
  unreadCount: vi.fn(async () => 0),
}));
vi.mock('../../src/data/presence', () => ({ joinPresence: vi.fn(), watchOnlineCount: vi.fn() }));

const A = 'aaaaaaaaaaaa';
const B = 'bbbbbbbbbbbb';
const student = (id: string, name: string, ingredient: string): WithId<Student> =>
  ({ id, name, order: 1, gen: 1, claimedGen: 1, ingredient });
const ROSTER = [student(A, '김가은', 'cheese'), student(B, '이나래', 'watermelon')];

let shell: StudentShell;
let pushRoom: (r: WithId<Room>) => void;
let pushMessages: (m: WithId<Message>[]) => void;
let deny: (e: unknown) => void;
const leavePresence = vi.fn();

beforeEach(() => {
  shell = { me: { id: A, gen: 1 }, student: ROSTER[0], roster: ROSTER, notice: null, setNotice: vi.fn(), expire: vi.fn() };
  vi.mocked(rooms.watchRoom).mockImplementation((_id, cb, onDenied) => {
    pushRoom = cb;
    deny = onDenied;
    return () => {};
  });
  vi.mocked(messages.watchMessages).mockImplementation((_id, cb, onDenied) => {
    pushMessages = cb;
    deny = onDenied;
    return () => {};
  });
  vi.mocked(messages.sendMessage).mockReset().mockResolvedValue({ flagged: false });
  vi.mocked(messages.markRead).mockClear();
  vi.mocked(presence.joinPresence).mockReset().mockReturnValue(leavePresence);
  vi.mocked(presence.watchOnlineCount).mockImplementation((_id, cb) => {
    cb(1);
    return () => {};
  });
  leavePresence.mockClear();
});
afterEach(() => vi.useRealTimers());

function renderRoom() {
  return render(
    <ShellContext.Provider value={shell}>
      <MemoryRouter initialEntries={['/room/R']}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomScreen />} />
          <Route path="/" element={<p>LOBBY</p>} />
        </Routes>
      </MemoryRouter>
    </ShellContext.Provider>,
  );
}

function openRoom(over: Partial<WithId<Room>> = {}, list: WithId<Message>[] = []) {
  const view = renderRoom();
  act(() => {
    pushRoom(roomFixture({ schedule: { enabled: false, offMin: 1320, onMin: 420 }, ...over }));
    pushMessages(list);
  });
  return view;
}

describe('RoomScreen', () => {
  test('내 메시지는 오른쪽, 선생님 메시지에는 주방장 배지', () => {
    openRoom({}, [
      msg({ id: '1', authorId: A, text: '내 말' }),
      msg({ id: '2', authorId: 'teacher', authorName: '담임선생님', ingredient: null, text: '공지' }),
    ]);
    expect(screen.getByText('내 말').closest('.m-row')).toHaveClass('me');
    expect(screen.getByText('공지').closest('.m-row')).not.toHaveClass('me');
    expect(screen.getByText('주방장')).toBeInTheDocument();
    expect(screen.getByText(/지금 1명 보글보글/)).toBeInTheDocument();
  });

  test('가려진 메시지를 보내면 경고, 다음 정상 메시지에서 사라진다', async () => {
    openRoom();
    vi.mocked(messages.sendMessage).mockResolvedValueOnce({ flagged: true });
    await userEvent.type(screen.getByRole('textbox'), '나쁜 말{Enter}');
    expect(screen.getByText(WARN_TEXT)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), '고운 말{Enter}');
    expect(screen.queryByText(WARN_TEXT)).not.toBeInTheDocument();
    expect(messages.sendMessage).toHaveBeenLastCalledWith('R', '고운 말', { id: A, name: '김가은', ingredient: 'cheese' });
  });

  test('불이 꺼지면 안내와 입력 잠김', () => {
    openRoom({ fire: { manual: 'off', manualUntil: null } });
    expect(screen.getByText('주방장이 냄비 불을 껐어요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByPlaceholderText('💤 불이 꺼져 있어서 쓸 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveClass('off');
  });

  test('밤 10시가 되면 화면이 불 꺼짐으로 바뀐다', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(Date.parse('2026-10-21T21:59:40+09:00'));
    openRoom({ schedule: { enabled: true, offMin: 1320, onMin: 420 } });
    expect(screen.getByRole('textbox')).toBeEnabled();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('아침 7시에 켜져요')).toBeInTheDocument();
  });

  test('너무 빨리 보내면 안내', async () => {
    openRoom();
    vi.mocked(messages.sendMessage).mockRejectedValueOnce(new TooFastError());
    await userEvent.type(screen.getByRole('textbox'), '빨리{Enter}');
    expect(screen.getByText('조금 천천히 보내요')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('빨리');
  });

  test('보고 있는 중에 추방되면 목록으로 돌아가 안내한다', () => {
    openRoom();
    act(() => deny(new BannedError()));
    expect(screen.getByText('LOBBY')).toBeInTheDocument();
    expect(shell.setNotice).toHaveBeenCalledWith(BANNED_TEXT);
  });

  test('500자까지만 입력된다', () => {
    openRoom();
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '500');
  });

  test('들어가면 읽음 표시·접속 표시, 나가면 정리', () => {
    const view = openRoom();
    expect(messages.markRead).toHaveBeenCalledWith('R', A);
    expect(presence.joinPresence).toHaveBeenCalledWith('R', A);
    view.unmount();
    expect(leavePresence).toHaveBeenCalled();
  });

  test('오늘의 부대찌개는 방 학생들의 재료로 만든다', () => {
    openRoom();
    expect(screen.getByTestId('today-pot')).toHaveTextContent('🧀×1');
    expect(screen.getByTestId('today-pot')).toHaveTextContent('🍉×1');
  });
});

describe('LobbyScreen', () => {
  function renderLobby(list: WithId<Room>[]) {
    vi.mocked(rooms.watchMyRooms).mockImplementation((_id, cb) => {
      cb(list);
      return () => {};
    });
    return render(
      <ShellContext.Provider value={shell}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<LobbyScreen />} />
            <Route path="/room/:roomId" element={<p>ROOM</p>} />
          </Routes>
        </MemoryRouter>
      </ShellContext.Provider>,
    );
  }

  test('추방된 방은 흐리게 안내하고 들어갈 수 없다', async () => {
    renderLobby([roomFixture({ id: 'X', name: '학예회 준비', banned: [A] })]);
    const btn = screen.getByRole('button', { name: /학예회 준비/ });
    expect(btn).toHaveTextContent('이 냄비에서 잠시 나와 있어요');
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(screen.queryByText('ROOM')).not.toBeInTheDocument();
  });

  test('안 읽은 수 배지와 방 들어가기', async () => {
    vi.mocked(messages.unreadCount).mockResolvedValue(3);
    renderLobby([roomFixture({ schedule: { enabled: false, offMin: 0, onMin: 0 }, createdAt: Timestamp.now() })]);
    expect(await screen.findByText('3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /부대찌개반/ }));
    expect(screen.getByText('ROOM')).toBeInTheDocument();
  });

  test('목록에서 내 재료 문구', () => {
    renderLobby([]);
    expect(screen.getByText('치즈로 참여 중')).toBeInTheDocument();
    expect(screen.getByText(/아직 들어가 있는 냄비가 없어요/)).toBeInTheDocument();
  });
});
