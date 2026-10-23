import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NameTakenError, SessionExpiredError, TooManyTriesError, WrongPinError } from '../../src/data/errors';
import * as students from '../../src/data/students';
import { JoinScreen } from '../../src/student/JoinScreen';
import { StudentApp } from '../../src/student/StudentApp';
import type { Student, WithId } from '../../src/data/types';

vi.mock('../../src/data/students', () => ({
  claimStudent: vi.fn(),
  loginStudent: vi.fn(),
  watchRoster: vi.fn(() => () => {}),
  watchCurrentStudent: vi.fn(() => () => {}),
  watchSession: vi.fn(() => () => {}),
  logout: vi.fn(async () => {}),
  setIngredient: vi.fn(),
}));
vi.mock('../../src/data/rooms', () => ({ watchMyRooms: vi.fn(() => () => {}) }));
vi.mock('../../src/data/messages', () => ({ unreadCount: vi.fn(async () => 0) }));
vi.mock('../../src/data/presence', () => ({}));

const s = (id: string, name: string, claimed: boolean, order: number): WithId<Student> =>
  ({ id, name, order, gen: 1, claimedGen: claimed ? 1 : null, ingredient: claimed ? 'cheese' : null });
const ROSTER = [s('aaaaaaaaaaaa', '김가은', true, 1), s('bbbbbbbbbbbb', '박서준', false, 2)];

const enter = () => screen.getByRole('button', { name: '냄비에 퐁당! 입장하기' });

beforeEach(() => {
  vi.mocked(students.claimStudent).mockReset().mockResolvedValue(undefined);
  vi.mocked(students.loginStudent).mockReset().mockResolvedValue(undefined);
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});
afterEach(() => vi.restoreAllMocks());

describe('JoinScreen', () => {
  test('미가입 이름을 고르면 재료 30칸, 재료를 안 고르면 입장 버튼 비활성', async () => {
    render(<JoinScreen roster={ROSTER} />);
    await userEvent.click(screen.getByRole('button', { name: '박서준' }));
    expect(within(screen.getByRole('group', { name: '재료 고르기' })).getAllByRole('button')).toHaveLength(30);
    await userEvent.type(screen.getByLabelText('암호'), '1234');
    expect(enter()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '치즈' }));
    expect(enter()).toBeEnabled();
  });

  test('암호 3자리면 안내', async () => {
    render(<JoinScreen roster={ROSTER} />);
    await userEvent.click(screen.getByRole('button', { name: '박서준' }));
    await userEvent.click(screen.getByRole('button', { name: '치즈' }));
    await userEvent.type(screen.getByLabelText('암호'), '123');
    await userEvent.click(enter());
    expect(screen.getByText('암호는 4자리 이상이에요')).toBeInTheDocument();
    expect(students.claimStudent).not.toHaveBeenCalled();
  });

  test('가입 성공 시 claimStudent와 이름 기억', async () => {
    render(<JoinScreen roster={ROSTER} />);
    await userEvent.click(screen.getByRole('button', { name: '박서준' }));
    await userEvent.click(screen.getByRole('button', { name: '수박' }));
    await userEvent.type(screen.getByLabelText('암호'), '5678');
    expect(screen.getByText('대화방에서 이렇게 보여요')).toBeInTheDocument();
    await userEvent.click(enter());
    expect(students.claimStudent).toHaveBeenCalledWith('bbbbbbbbbbbb', '5678', 'watermelon');
    expect(localStorage.getItem('budae.lastStudentId')).toBe('bbbbbbbbbbbb');
  });

  test('가입한 이름은 재료 없이 암호만 묻고 loginStudent', async () => {
    render(<JoinScreen roster={ROSTER} />);
    await userEvent.click(screen.getByRole('button', { name: '김가은' }));
    expect(screen.queryByRole('group', { name: '재료 고르기' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('암호'), '1234');
    await userEvent.click(screen.getByRole('button', { name: '들어가기' }));
    expect(students.loginStudent).toHaveBeenCalledWith('aaaaaaaaaaaa', '1234');
  });

  test('NameTakenError면 안내하고 로그인 모드로 바뀐다', async () => {
    vi.mocked(students.claimStudent).mockRejectedValue(new NameTakenError());
    render(<JoinScreen roster={ROSTER} />);
    await userEvent.click(screen.getByRole('button', { name: '박서준' }));
    await userEvent.click(screen.getByRole('button', { name: '치즈' }));
    await userEvent.type(screen.getByLabelText('암호'), '1234');
    await userEvent.click(enter());
    expect(screen.getByText('방금 다른 사람이 이 이름으로 들어갔어요. 선생님께 말해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '들어가기' })).toBeInTheDocument();
  });

  test.each([
    [new WrongPinError(), '암호가 맞지 않아요'],
    [new TooManyTriesError(), '너무 많이 틀렸어요. 잠시 후 다시 해 보세요.'],
  ])('로그인 오류 %#', async (err, text) => {
    vi.mocked(students.loginStudent).mockRejectedValue(err);
    render(<JoinScreen roster={ROSTER} />);
    await userEvent.click(screen.getByRole('button', { name: '김가은' }));
    await userEvent.type(screen.getByLabelText('암호'), '0000');
    await userEvent.click(screen.getByRole('button', { name: '들어가기' }));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test('같은 기기에서 다시 오면 이름이 미리 선택된다', () => {
    localStorage.setItem('budae.lastStudentId', 'aaaaaaaaaaaa');
    render(<JoinScreen roster={ROSTER} />);
    expect(screen.getByRole('button', { name: '김가은' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('localStorage가 예외를 던져도 화면이 뜬다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<JoinScreen roster={ROSTER} />);
    expect(screen.getByRole('button', { name: '김가은' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('StudentApp', () => {
  test('접속 중 암호가 초기화되면 로그아웃하고 안내한다', async () => {
    let setMe: (m: students.Me | null) => void = () => {};
    let expire: (e: SessionExpiredError) => void = () => {};
    vi.mocked(students.watchCurrentStudent).mockImplementation((cb) => {
      setMe = cb;
      cb({ id: 'aaaaaaaaaaaa', gen: 1 });
      return () => {};
    });
    vi.mocked(students.watchRoster).mockImplementation((cb) => {
      cb(ROSTER);
      return () => {};
    });
    vi.mocked(students.watchSession).mockImplementation((cb) => {
      expire = cb;
      return () => {};
    });

    render(<MemoryRouter><StudentApp /></MemoryRouter>);
    expect(await screen.findByText('내가 들어가 있는 냄비')).toBeInTheDocument();

    act(() => expire(new SessionExpiredError('reset')));
    expect(students.logout).toHaveBeenCalled();
    act(() => setMe(null));
    expect(screen.getByText('선생님이 암호를 초기화했어요. 다시 들어와 주세요.')).toBeInTheDocument();
    expect(screen.getByText('1. 내 이름 고르기')).toBeInTheDocument();
  });
});
