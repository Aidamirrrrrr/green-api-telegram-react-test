import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import NewChatForm from './new-chat-form.component';
import { ApiError, type GreenApiClient } from 'services/green-api.service';

function setup(checkAccount: ReturnType<typeof vi.fn>) {
  const onCreate = vi.fn();
  const onCancel = vi.fn();
  const client = { checkAccount } as unknown as GreenApiClient;
  render(<NewChatForm client={client} onCreate={onCreate} onCancel={onCancel} />);
  return { user: userEvent.setup(), onCreate, onCancel };
}

const fill = async (user: ReturnType<typeof userEvent.setup>, phone: string) => {
  await user.type(screen.getByLabelText('Номер телефона получателя'), phone);
  await user.click(screen.getByRole('button', { name: 'Создать' }));
};

describe('NewChatForm', () => {
  it('не даёт создать чат с пустым номером', () => {
    setup(vi.fn());
    expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled();
  });

  it('просит корректный номер и не обращается к API', async () => {
    const checkAccount = vi.fn();
    const { user } = setup(checkAccount);
    await fill(user, '12345');
    expect(await screen.findByRole('alert')).toHaveTextContent('международном формате');
    expect(checkAccount).not.toHaveBeenCalled();
  });

  it('создаёт чат с chatId, который вернул checkAccount', async () => {
    const checkAccount = vi.fn().mockResolvedValue({ exist: true, chatId: '01234567' });
    const { user, onCreate } = setup(checkAccount);
    await fill(user, '8 900 123-45-67');
    expect(checkAccount).toHaveBeenCalledWith(79001234567);
    expect(onCreate).toHaveBeenCalledWith({
      id: '01234567',
      title: '+79001234567',
      phone: '79001234567',
    });
  });

  it('сообщает, что аккаунта на номере нет', async () => {
    const { user, onCreate } = setup(vi.fn().mockResolvedValue({ exist: false }));
    await fill(user, '+7 900 123-45-67');
    expect(await screen.findByRole('alert')).toHaveTextContent('нет аккаунта Telegram');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('показывает сообщение об исчерпанной квоте', async () => {
    const quota = new ApiError('Исчерпана квота тарифа GREEN-API.', 466);
    const { user, onCreate } = setup(vi.fn().mockRejectedValue(quota));
    await fill(user, '+7 900 123-45-67');
    expect(await screen.findByRole('alert')).toHaveTextContent('Исчерпана квота');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('закрывается по кнопке отмены', async () => {
    const { user, onCancel } = setup(vi.fn());
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
