import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ChatView from './chat-view.component';
import type { Chat, Message } from 'types';

const chat: Chat = {
  id: '10',
  title: 'Василиса',
  phone: '79001234567',
  lastActivity: 1,
  unread: 0,
};

const message = (over: Partial<Message>): Message => ({
  id: 'm1',
  chatId: '10',
  text: 'Привет',
  direction: 'in',
  timestamp: new Date(2026, 8, 29, 12, 30).getTime(),
  status: 'sent',
  ...over,
});

function setup(messages: Message[] = [], loading = false) {
  const handlers = { onSend: vi.fn(), onRetry: vi.fn(), onBack: vi.fn() };
  render(<ChatView chat={chat} messages={messages} loading={loading} {...handlers} />);
  return { user: userEvent.setup(), ...handlers };
}

describe('ChatView', () => {
  it('показывает имя и номер собеседника', () => {
    setup();
    expect(screen.getByText('Василиса')).toBeInTheDocument();
    expect(screen.getByText('+79001234567')).toBeInTheDocument();
  });

  it('подсказывает написать первое сообщение или сообщает о загрузке истории', () => {
    const { unmount } = render(
      <ChatView
        chat={chat}
        messages={[]}
        loading={false}
        onSend={vi.fn()}
        onRetry={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText('Напишите первое сообщение')).toBeInTheDocument();
    unmount();
    setup([], true);
    expect(screen.getByText('Загружаем историю…')).toBeInTheDocument();
  });

  it('оформляет ленту как живую область для скринридеров', () => {
    setup([message({})]);
    expect(screen.getByRole('log', { name: 'Сообщения' })).toHaveAttribute('aria-live', 'polite');
  });

  it('отправляет обрезанный текст по Enter и очищает поле', async () => {
    const { user, onSend } = setup();
    const input = screen.getByLabelText('Сообщение');
    await user.type(input, '  Привет  {Enter}');
    expect(onSend).toHaveBeenCalledWith('Привет');
    expect(input).toHaveValue('');
  });

  it('переносит строку по Shift+Enter и не отправляет пустой текст', async () => {
    const { user, onSend } = setup();
    const input = screen.getByLabelText('Сообщение');
    await user.type(input, '{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    await user.type(input, 'a{Shift>}{Enter}{/Shift}b');
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('a\nb');
  });

  it('блокирует кнопку отправки, пока поле пустое', async () => {
    const { user } = setup();
    const button = screen.getByRole('button', { name: 'Отправить' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Сообщение'), 'x');
    expect(button).toBeEnabled();
  });

  it('показывает причину сбоя и даёт повторить отправку', async () => {
    const failed = message({
      id: 'tmp-1',
      direction: 'out',
      status: 'failed',
      error: 'Нет связи.',
    });
    const { user, onRetry } = setup([failed]);
    expect(screen.getByText('Нет связи.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledWith(failed);
  });

  it('ставит разделитель дня один раз на день', () => {
    const day = new Date(2026, 8, 28, 10, 0).getTime();
    setup([
      message({ id: 'a', timestamp: day }),
      message({ id: 'b', timestamp: day + 60_000 }),
      message({ id: 'c', timestamp: day + 24 * 3_600_000 }),
    ]);
    expect(document.querySelectorAll('.daymark')).toHaveLength(2);
  });

  it('возвращает к списку чатов', async () => {
    const { user, onBack } = setup();
    await user.click(screen.getByRole('button', { name: 'К списку чатов' }));
    expect(onBack).toHaveBeenCalled();
  });
});
