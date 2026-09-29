import { useState, type FormEvent } from 'react';

import { ApiError, type GreenApiClient } from 'services/green-api.service';
import { normalizePhone } from 'utils/phone.utils';

interface Props {
  client: GreenApiClient;
  onCreate: (chat: { id: string; title: string; phone: string }) => void;
  onCancel: () => void;
}

function NewChatForm({ client, onCreate, onCancel }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const phone = normalizePhone(value);
    if (!phone) {
      setError('Введите номер в международном формате, например +7 900 123-45-67.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const account = await client.checkAccount(Number(phone));
      if (!account.exist || !account.chatId) {
        setError('На этом номере нет аккаунта Telegram.');
        return;
      }
      onCreate({ id: account.chatId, title: `+${phone}`, phone });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось проверить номер.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="newchat" onSubmit={submit}>
      <h2>Новый чат</h2>
      <input
        autoFocus
        type="tel"
        placeholder="Номер телефона получателя"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Номер телефона получателя"
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="newchat__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn" disabled={busy || !value.trim()}>
          {busy ? 'Проверяем…' : 'Создать'}
        </button>
      </div>
    </form>
  );
}

export default NewChatForm;
