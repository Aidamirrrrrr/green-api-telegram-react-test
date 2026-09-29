import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LoginForm from './login-form.component';

const respond = (status: number, body?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body ? JSON.stringify(body) : '', { status }))
  );

async function submit(id = '4100000001', token = 'secret', remember = false) {
  const user = userEvent.setup();
  const onLogin = vi.fn();
  render(<LoginForm onLogin={onLogin} />);
  await user.type(screen.getByLabelText('idInstance'), id);
  await user.type(screen.getByLabelText('apiTokenInstance'), token);
  if (remember) await user.click(screen.getByLabelText('Запомнить на этом устройстве'));
  await user.click(screen.getByRole('button', { name: 'Войти' }));
  return onLogin;
}

describe('LoginForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('подставляет адрес API по умолчанию', () => {
    render(<LoginForm onLogin={vi.fn()} />);
    expect(screen.getByLabelText('apiUrl')).toHaveValue('https://api.green-api.com');
  });

  it('отклоняет нечисловой idInstance без запроса к API', async () => {
    respond(200, { stateInstance: 'authorized' });
    const onLogin = await submit('abc');
    expect(await screen.findByRole('alert')).toHaveTextContent('только из цифр');
    expect(fetch).not.toHaveBeenCalled();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('проверяет инстанс и пускает в чат, не запоминая токен по умолчанию', async () => {
    respond(200, { stateInstance: 'authorized' });
    const onLogin = await submit();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.green-api.com/waInstance4100000001/getStateInstance/secret',
      expect.objectContaining({ method: 'GET' })
    );
    expect(onLogin).toHaveBeenCalledWith(
      { apiUrl: 'https://api.green-api.com', idInstance: '4100000001', apiTokenInstance: 'secret' },
      false
    );
  });

  it('передаёт выбор «запомнить на этом устройстве»', async () => {
    respond(200, { stateInstance: 'authorized' });
    const onLogin = await submit('4100000001', 'secret', true);
    expect(onLogin).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('объясняет, что инстанс не авторизован', async () => {
    respond(200, { stateInstance: 'notAuthorized' });
    const onLogin = await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('не авторизован');
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('показывает ошибку при неверных данных инстанса', async () => {
    respond(401);
    const onLogin = await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверные idInstance');
    expect(onLogin).not.toHaveBeenCalled();
  });
});
