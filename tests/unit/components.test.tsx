import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble } from '../../src/components/MessageBubble';
import { Composer } from '../../src/components/Composer';
import { TodayPot } from '../../src/components/TodayPot';
import { PotHeader } from '../../src/components/PotHeader';
import { Sheet } from '../../src/components/Sheet';
import { msg } from './fixtures';

describe('MessageBubble', () => {
  test('삭제된 메시지 문구', () => {
    render(<MessageBubble msg={msg({ deleted: true, text: '' })} mine={false} />);
    expect(screen.getByText('주방장이 건져낸 메시지예요')).toBeInTheDocument();
  });

  test('학생 화면은 가려진 문장만 보인다', () => {
    render(<MessageBubble msg={msg({ text: '아 ＊＊', flagged: true })} mine={false} />);
    expect(screen.getByText('＊＊')).toHaveClass('mask');
    expect(screen.queryByText('가려짐')).not.toBeInTheDocument();
  });

  test('선생님 화면은 원래 문장을 보이고 걸린 부분을 강조한다', () => {
    render(<MessageBubble msg={msg({ text: '아 ＊＊', flagged: true })} mine={false} teacherView original="아 씨발" />);
    expect(screen.getByText('씨발')).toHaveClass('hit');
    expect(screen.getByText('가려짐')).toBeInTheDocument();
  });

  test('선생님 메시지에는 주방장 배지', () => {
    render(<MessageBubble msg={msg({ authorId: 'teacher', authorName: '담임선생님', ingredient: null })} mine={false} />);
    expect(screen.getByText('주방장')).toBeInTheDocument();
  });

  test('입장·불 안내는 가운데 한 줄', () => {
    const { rerender } = render(<MessageBubble msg={msg({ kind: 'joined', text: '', ingredient: 'watermelon' })} mine={false} />);
    expect(screen.getByText('🍉 김가은(수박) 님이 냄비에 들어왔어요… 괜찮을까?')).toBeInTheDocument();
    rerender(<MessageBubble msg={msg({ kind: 'fire', text: 'off', authorId: 'teacher' })} mine={false} />);
    expect(screen.getByText(/냄비 불이 꺼졌어요/)).toBeInTheDocument();
  });

  test('삭제 버튼', async () => {
    const onDelete = vi.fn();
    render(<MessageBubble msg={msg()} mine={false} teacherView onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /삭제/ }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

describe('Composer', () => {
  test('공백만 있으면 보내기 비활성', async () => {
    render(<Composer disabled={false} onSend={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), '   ');
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  });

  test('불 꺼짐이면 입력 잠김', () => {
    render(<Composer disabled disabledText="💤 불이 꺼져 있어서 쓸 수 없어요" onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByPlaceholderText('💤 불이 꺼져 있어서 쓸 수 없어요')).toBeInTheDocument();
  });

  test('Enter로 보내고 입력창을 비운다', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer disabled={false} onSend={onSend} />);
    await userEvent.type(screen.getByRole('textbox'), '안녕{Enter}');
    expect(onSend).toHaveBeenCalledWith('안녕');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  test('Shift+Enter는 줄바꿈', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer disabled={false} onSend={onSend} />);
    await userEvent.type(screen.getByRole('textbox'), '가{Shift>}{Enter}{/Shift}나');
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('가\n나');
  });

  test('한글 조합 중 Enter는 보내지 않는다', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer disabled={false} onSend={onSend} />);
    const box = screen.getByRole('textbox');
    await userEvent.type(box, '안녕');
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  test('보내기에 실패하면 글자를 남긴다', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('x'));
    render(<Composer disabled={false} onSend={onSend} />);
    await userEvent.type(screen.getByRole('textbox'), '남아라{Enter}');
    expect(screen.getByRole('textbox')).toHaveValue('남아라');
  });

  test('500자까지만 입력된다', () => {
    render(<Composer disabled={false} onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '500');
  });
});

describe('TodayPot와 PotHeader', () => {
  test('재료 칩과 맛 평가', () => {
    render(<TodayPot ingredientKeys={['sausage', 'sausage', 'choco', 'watermelon']} />);
    expect(screen.getByText('🌭×2')).toBeInTheDocument();
    expect(screen.getByText('맛: 🤢 위험')).toBeInTheDocument();
  });

  test('재료가 없으면 줄을 숨긴다', () => {
    const { container } = render(<TodayPot ingredientKeys={[null]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('불 꺼진 냄비 띠', () => {
    render(<PotHeader title="부대찌개반" logo="🍲" fireOn={false} />);
    expect(screen.getByRole('banner')).toHaveClass('off');
  });
});

describe('Sheet', () => {
  test('바깥을 누르거나 Esc로 닫힌다', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="메뉴"><p>안</p></Sheet>);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
