import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import * as flags from '../../src/data/flags';
import * as messages from '../../src/data/messages';
import * as rooms from '../../src/data/rooms';
import * as settings from '../../src/data/settings';
import type { Flag, Message, Room, Student, WithId } from '../../src/data/types';
import { FilterSettings } from '../../src/teacher/FilterSettings';
import { FlagLog } from '../../src/teacher/FlagLog';
import { TeacherRoom, fromHHMM, toHHMM } from '../../src/teacher/TeacherRoom';
import { TeacherContext, type TeacherShell } from '../../src/teacher/shell';
import { msg, room as roomFixture } from './fixtures';

vi.mock('../../src/data/rooms', () => ({
  watchRoom: vi.fn(), ban: vi.fn(), unban: vi.fn(), setFire: vi.fn(), setSchedule: vi.fn(),
  updateRoomMembers: vi.fn(), updateRoom: vi.fn(), deleteRoom: vi.fn(),
}));
vi.mock('../../src/data/messages', () => ({ watchMessages: vi.fn(), sendMessage: vi.fn(), deleteMessage: vi.fn(async () => {}) }));
vi.mock('../../src/data/flags', () => ({ watchFlagsForRoom: vi.fn(), watchFlags: vi.fn() }));
vi.mock('../../src/data/presence', () => ({ watchOnlineIds: vi.fn((_r, cb) => { cb(new Set(['a'])); return () => {}; }) }));
vi.mock('../../src/data/settings', () => ({ setExtraWords: vi.fn(async () => {}), setTeacherName: vi.fn(async () => {}) }));

const s = (id: string, name: string): WithId<Student> => ({ id, name, order: 1, gen: 1, claimedGen: 1, ingredient: 'kimchi' });
const ROSTER = [s('a', '최유나'), s('b', '이시우')];
const ts = Timestamp.fromMillis(Date.parse('2026-10-21T09:14:00+09:00'));
const flag = (id: string, studentId: string, original: string, masked: string): WithId<Flag> =>
  ({ id, roomId: 'R', studentId, original, masked, hits: [], createdAt: ts });

let shell: TeacherShell;
let pushRoom: (r: WithId<Room>) => void;
let pushMessages: (m: WithId<Message>[]) => void;
let pushFlags: (m: Map<string, Flag>) => void;

beforeEach(() => {
  vi.clearAllMocks();
  shell = { roster: ROSTER, rooms: [roomFixture({ members: ['a', 'b'] })], settings: { teacherName: '담임선생님', extraWords: ['멍청이'] } };
  vi.mocked(rooms.watchRoom).mockImplementation((_id, cb) => { pushRoom = cb; return () => {}; });
  vi.mocked(messages.watchMessages).mockImplementation((_id, cb) => { pushMessages = cb; return () => {}; });
  vi.mocked(flags.watchFlagsForRoom).mockImplementation((_id, cb) => { pushFlags = cb; return () => {}; });
});
afterEach(() => vi.useRealTimers());

function openRoom(over: Partial<WithId<Room>> = {}) {
  render(
    <TeacherContext.Provider value={shell}>
      <MemoryRouter initialEntries={['/teacher/room/R']}>
        <Routes>
          <Route path="/teacher/room/:roomId" element={<TeacherRoom />} />
          <Route path="/teacher" element={<p>HOME</p>} />
        </Routes>
      </MemoryRouter>
    </TeacherContext.Provider>,
  );
  act(() => {
    pushRoom(roomFixture({ members: ['a', 'b'], schedule: { enabled: false, offMin: 1320, onMin: 420 }, ...over }));
    pushMessages([
      msg({ id: 'm1', authorId: 'a', authorName: '최유나', text: '아 진짜 ＊＊ 일찍이네', flagged: true }),
      msg({ id: 'm2', authorId: 'b', authorName: '이시우', text: '몇 시까지?' }),
    ]);
    pushFlags(new Map([['m1', flag('m1', 'a', '아 진짜 씨발 일찍이네', '아 진짜 ＊＊ 일찍이네')]]));
  });
}

const side = () => within(screen.getByRole('complementary', { name: '냄비 관리' }));

describe('TeacherRoom', () => {
  test('가려진 메시지는 원래 문장을 보인다', () => {
    openRoom();
    expect(screen.getByText('씨발')).toHaveClass('hit');
    expect(screen.getByText('가려짐')).toBeInTheDocument();
  });

  test('🗑 삭제는 확인 후 deleteMessage', async () => {
    openRoom();
    await userEvent.click(screen.getByRole('button', { name: '이시우의 메시지 삭제' }));
    expect(messages.deleteMessage).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '🗑 삭제' }));
    expect(messages.deleteMessage).toHaveBeenCalledWith('R', 'm2');
  });

  test('불 스위치를 끄면 setFire off', async () => {
    openRoom();
    expect(side().getByText(/냄비 불 켜짐/)).toBeInTheDocument();
    await userEvent.click(side().getByRole('switch', { name: '냄비 불' }));
    expect(rooms.setFire).toHaveBeenCalledWith('R', 'off');
  });

  test('자동 시간 창 안에서는 꺼짐으로 보인다', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-10-21T23:00:00+09:00'));
    openRoom({ schedule: { enabled: true, offMin: 1320, onMin: 420 } });
    expect(side().getByText('💤 냄비 불 꺼짐')).toBeInTheDocument();
    expect(side().getByRole('switch', { name: '냄비 불' })).toHaveAttribute('aria-checked', 'false');
  });

  test('자동 시간을 22:30~06:30으로 바꾼다', () => {
    openRoom({ schedule: { enabled: true, offMin: 1320, onMin: 420 } });
    fireEvent.change(side().getByLabelText('끄는 시각'), { target: { value: '22:30' } });
    fireEvent.change(side().getByLabelText('켜는 시각'), { target: { value: '06:30' } });
    expect(rooms.setSchedule).toHaveBeenLastCalledWith('R', { enabled: true, offMin: 1350, onMin: 390 });
  });

  test('추방과 풀기', async () => {
    openRoom();
    await userEvent.click(side().getByRole('button', { name: '이시우 메뉴' }));
    await userEvent.click(side().getByRole('button', { name: '🚫 추방하기' }));
    expect(rooms.ban).toHaveBeenCalledWith('R', 'b');

    act(() => pushRoom(roomFixture({ members: ['a', 'b'], banned: ['b'], schedule: { enabled: false, offMin: 0, onMin: 0 } })));
    await userEvent.click(side().getByRole('button', { name: '추방됨 · 풀기' }));
    expect(rooms.unban).toHaveBeenCalledWith('R', 'b');
  });

  test('접속한 학생에게 초록 점', () => {
    openRoom();
    const row = side().getByText('최유나').closest('.p')!;
    expect(within(row as HTMLElement).getByLabelText('접속 중')).toBeInTheDocument();
  });

  test('시각 변환', () => {
    expect(toHHMM(1350)).toBe('22:30');
    expect(toHHMM(7)).toBe('00:07');
    expect(fromHHMM('06:30')).toBe(390);
    expect(fromHHMM('')).toBeNull();
  });
});

describe('FlagLog와 FilterSettings', () => {
  function renderWith(ui: React.ReactNode) {
    return render(<TeacherContext.Provider value={shell}>{ui}</TeacherContext.Provider>);
  }

  test('학생을 고르면 그 학생 기록만 남는다', async () => {
    vi.mocked(flags.watchFlags).mockImplementation((cb) => {
      cb([flag('m1', 'a', '씨발', '＊＊'), flag('m2', 'b', '병신', '＊＊')]);
      return () => {};
    });
    renderWith(<FlagLog />);
    expect(screen.getAllByTestId('flag-row')).toHaveLength(2);
    await userEvent.selectOptions(screen.getByLabelText('학생 고르기'), 'b');
    expect(screen.getAllByTestId('flag-row')).toHaveLength(1);
    expect(screen.getByTestId('flag-row')).toHaveTextContent('이시우');
    expect(screen.getByTestId('flag-row')).toHaveTextContent('병신');
  });

  test('금지어 추가, 중복은 넣지 않는다', async () => {
    renderWith(<FilterSettings />);
    await userEvent.type(screen.getByLabelText('금지어'), '바보{Enter}');
    expect(settings.setExtraWords).toHaveBeenCalledWith(['멍청이', '바보']);
    vi.mocked(settings.setExtraWords).mockClear();
    await userEvent.type(screen.getByLabelText('금지어'), '멍청이{Enter}');
    expect(settings.setExtraWords).not.toHaveBeenCalled();
    expect(screen.getByText('"멍청이"는 이미 들어 있어요.')).toBeInTheDocument();
  });
});
