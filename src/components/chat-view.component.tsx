import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { clsx } from 'clsx';

import { AlertIcon, BackIcon, CheckIcon, ClockIcon, SendIcon } from 'components/ui/icons.component';
import type { Chat, Message, MessageStatus } from 'types';
import { formatDay, formatTime, initials, isSameDay } from 'utils/format.utils';

interface Props {
  chat: Chat;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onRetry: (message: Message) => void;
  onBack: () => void;
}

const MAX_MESSAGE_LENGTH = 4096;
const HAS_FINE_POINTER = window.matchMedia?.('(pointer: fine)').matches ?? true;

const STATUS_ICON: Record<MessageStatus, typeof CheckIcon> = {
  sending: ClockIcon,
  sent: CheckIcon,
  failed: AlertIcon,
};

function ChatView({ chat, messages, loading, onSend, onRetry, onBack }: Props) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, chat.id]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const showPhone = chat.phone && chat.title !== `+${chat.phone}`;

  return (
    <section className="chat">
      <header className="chat__head">
        <button className="icon-btn chat__back" onClick={onBack} aria-label="К списку чатов">
          <BackIcon />
        </button>
        <span className="avatar">{initials(chat.title)}</span>
        <div>
          <strong>{chat.title}</strong>
          {showPhone && <div className="chat__sub">+{chat.phone}</div>}
        </div>
      </header>

      <div className="chat__messages" role="log" aria-live="polite" aria-label="Сообщения">
        {messages.length === 0 && (
          <div className="chat__empty">
            {loading ? 'Загружаем историю…' : 'Напишите первое сообщение'}
          </div>
        )}
        {messages.map((message, index) => {
          const StatusIcon = STATUS_ICON[message.status];
          const isNewDay =
            index === 0 || !isSameDay(message.timestamp, messages[index - 1].timestamp);

          return (
            <Fragment key={message.id}>
              {isNewDay && (
                <div className="daymark">
                  <span>{formatDay(message.timestamp)}</span>
                </div>
              )}
              <div
                className={clsx(
                  'bubble',
                  `bubble--${message.direction}`,
                  message.status === 'failed' && 'bubble--failed'
                )}
              >
                <span className="bubble__text">{message.text}</span>
                <span className="bubble__meta">
                  {formatTime(message.timestamp)}
                  {message.direction === 'out' && (
                    <StatusIcon size={14} className={`mark mark--${message.status}`} />
                  )}
                </span>
                {message.status === 'failed' && (
                  <div className="bubble__error">
                    <span>{message.error ?? 'Не отправлено.'}</span>
                    <button className="bubble__retry" onClick={() => onRetry(message)}>
                      Повторить
                    </button>
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      <footer className="composer">
        <textarea
          ref={inputRef}
          autoFocus={HAS_FINE_POINTER}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          value={text}
          placeholder="Сообщение"
          aria-label="Сообщение"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="send" onClick={send} disabled={!text.trim()} aria-label="Отправить">
          <SendIcon size={22} />
        </button>
      </footer>
    </section>
  );
}

export default ChatView;
