import { useState, type FormEvent } from 'react';

import { PlaneIcon } from 'components/ui/icons.component';
import { ApiError, createClient } from 'services/green-api.service';
import type { Credentials } from 'types';

interface Props {
  initial?: Credentials | null;
  onLogin: (creds: Credentials, remember: boolean) => void;
}

const DEFAULT_URL = import.meta.env.VITE_GREEN_API_URL || 'https://api.green-api.com';

function LoginForm({ initial, onLogin }: Props) {
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? DEFAULT_URL);
  const [idInstance, setIdInstance] = useState(initial?.idInstance ?? '');
  const [apiTokenInstance, setApiTokenInstance] = useState(initial?.apiTokenInstance ?? '');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const creds = {
      apiUrl: apiUrl.trim(),
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    };
    if (!/^\d+$/.test(creds.idInstance)) {
      setError('idInstance состоит только из цифр.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { stateInstance } = await createClient(creds).getStateInstance();
      if (stateInstance !== 'authorized') {
        setError(
          'Инстанс не авторизован. Отсканируйте QR-код Telegram в личном кабинете GREEN-API.'
        );
        return;
      }
      onLogin(creds, remember);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось проверить инстанс.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="login__logo">
          <PlaneIcon size={36} />
        </div>
        <h1>Вход в чат</h1>
        <p className="login__hint">
          Введите данные инстанса из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
          .
        </p>

        <label>
          apiUrl
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.green-api.com"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label>
          idInstance
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label>
          apiTokenInstance
          <input
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>

        <label className="login__remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Запомнить на этом устройстве
        </label>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="btn" disabled={busy}>
          {busy ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </main>
  );
}

export default LoginForm;
