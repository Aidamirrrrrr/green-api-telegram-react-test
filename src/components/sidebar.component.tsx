import { clsx } from 'clsx';

import { LogoutIcon, PlusIcon } from 'components/ui/icons.component';
import type { ConnectionStatus } from 'hooks/use-notifications.hook';
import type { Chat, Message } from 'types';
import { formatTime, initials } from 'utils/format.utils';

interface Props {
  idInstance: string;
  status: ConnectionStatus;
  chats: Chat[];
  messages: Record<string, Message[]>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onLogout: () => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'подключение…',
  online: 'на связи',
  offline: 'нет связи',
  unauthorized: 'нет доступа',
};

const preview = (message?: Message) => {
  if (!message) return 'Нет сообщений';
  return `${message.direction === 'out' ? 'Вы: ' : ''}${message.text}`;
};

function Sidebar({
  idInstance,
  status,
  chats,
  messages,
  activeId,
  onSelect,
  onNew,
  onLogout,
}: Props) {
  return (
    <aside className="sidebar">
      <header className="sidebar__head">
        <div>
          <strong>Инстанс {idInstance}</strong>
          <div className={`status status--${status}`}>
            <i />
            {STATUS_LABEL[status]}
          </div>
        </div>
        <button className="icon-btn" onClick={onLogout} title="Выйти" aria-label="Выйти">
          <LogoutIcon />
        </button>
      </header>

      <button className="btn sidebar__new" onClick={onNew}>
        <PlusIcon size={18} />
        Новый чат
      </button>

      <ul className="chatlist">
        {chats.length === 0 && (
          <li className="chatlist__empty">Чатов пока нет. Создайте первый по номеру телефона.</li>
        )}
        {chats.map((chat) => {
          const last = messages[chat.id]?.at(-1);

          return (
            <li key={chat.id}>
              <button
                className={clsx('chatitem', chat.id === activeId && 'chatitem--active')}
                onClick={() => onSelect(chat.id)}
              >
                <span className="avatar">{initials(chat.title)}</span>
                <span className="chatitem__body">
                  <span className="chatitem__row">
                    <b>{chat.title}</b>
                    {last && <time>{formatTime(last.timestamp)}</time>}
                  </span>
                  <span className="chatitem__row">
                    <span className="chatitem__last">{preview(last)}</span>
                    {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default Sidebar;
