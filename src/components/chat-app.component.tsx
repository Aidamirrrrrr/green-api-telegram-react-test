import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import ChatView from 'components/chat-view.component';
import NewChatForm from 'components/forms/new-chat-form.component';
import Sidebar from 'components/sidebar.component';
import { useNotifications } from 'hooks/use-notifications.hook';
import { ApiError, createClient } from 'services/green-api.service';
import { chatReducer, sortedChats } from 'store/chat.reducer';
import { loadChatState, saveChatState } from 'store/storage.utils';
import type { Credentials, Message } from 'types';
import { parseHistory } from 'utils/history.utils';
import type { IncomingEvent } from 'utils/notification.utils';

const APP_TITLE = 'Telegram-чат на GREEN-API';
const HISTORY_LIMIT = 50;
const WEBHOOK_WARNING =
  'В настройках инстанса задан webhookUrl, поэтому ответы не попадут в очередь. Очистите его в личном кабинете.';
const INCOMING_DISABLED_WARNING =
  'В настройках инстанса выключены входящие уведомления. Включите их в личном кабинете GREEN-API.';

interface Props {
  creds: Credentials;
  onLogout: () => void;
}

function ChatApp({ creds, onLogout }: Props) {
  const client = useMemo(() => createClient(creds), [creds]);
  const [state, dispatch] = useReducer(chatReducer, creds.idInstance, loadChatState);
  const [creating, setCreating] = useState(false);
  const [warning, setWarning] = useState('');
  const [loadedHistory, setLoadedHistory] = useState<string[]>([]);

  useEffect(() => {
    saveChatState(creds.idInstance, state);
  }, [creds.idInstance, state]);

  useEffect(() => {
    const abort = new AbortController();
    client
      .getSettings(abort.signal)
      .then((settings) => {
        if (settings.webhookUrl) setWarning(WEBHOOK_WARNING);
        else if (settings.incomingWebhook === 'no') setWarning(INCOMING_DISABLED_WARNING);
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [client]);

  useEffect(() => {
    const chatId = state.activeId;
    if (!chatId || loadedHistory.includes(chatId)) return;

    const abort = new AbortController();
    client
      .getChatHistory(chatId, HISTORY_LIMIT, abort.signal)
      .then((items) => dispatch({ type: 'history', chatId, messages: parseHistory(items, chatId) }))
      .catch(() => undefined)
      .finally(() => {
        if (!abort.signal.aborted) setLoadedHistory((ids) => [...ids, chatId]);
      });
    return () => abort.abort();
  }, [client, state.activeId, loadedHistory]);

  const unreadTotal = Object.values(state.chats).reduce((sum, chat) => sum + chat.unread, 0);

  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${APP_TITLE}` : APP_TITLE;
  }, [unreadTotal]);

  const onEvent = useCallback(
    (event: IncomingEvent) => dispatch({ type: 'receive', ...event }),
    []
  );
  const status = useNotifications(client, onEvent);

  const deliver = useCallback(
    async (chatId: string, tempId: string, text: string) => {
      try {
        const { idMessage } = await client.sendMessage(chatId, text);
        dispatch({ type: 'sent', chatId, tempId, id: idMessage });
      } catch (e) {
        const error = e instanceof ApiError ? e.message : 'Не удалось отправить сообщение.';
        dispatch({ type: 'failed', chatId, tempId, error });
      }
    },
    [client]
  );

  const send = (text: string) => {
    const chatId = state.activeId;
    if (!chatId) return;
    const tempId = `tmp-${crypto.randomUUID()}`;
    dispatch({
      type: 'sending',
      message: {
        id: tempId,
        chatId,
        text,
        direction: 'out',
        timestamp: Date.now(),
        status: 'sending',
      },
    });
    void deliver(chatId, tempId, text);
  };

  const retry = (m: Message) => {
    dispatch({ type: 'retry', chatId: m.chatId, tempId: m.id });
    void deliver(m.chatId, m.id, m.text);
  };

  const active = state.activeId ? state.chats[state.activeId] : null;

  return (
    <div className={`app${active || creating ? ' app--chat-open' : ''}`}>
      <Sidebar
        idInstance={creds.idInstance}
        status={status}
        chats={sortedChats(state)}
        messages={state.messages}
        activeId={state.activeId}
        onSelect={(id) => {
          setCreating(false);
          dispatch({ type: 'select', id });
        }}
        onNew={() => setCreating(true)}
        onLogout={onLogout}
      />

      <div className="main">
        {warning && (
          <div className="banner" role="status">
            {warning}
          </div>
        )}
        {status === 'unauthorized' && (
          <div className="banner banner--error" role="alert">
            GREEN-API отклонил запрос. Проверьте данные инстанса и войдите заново.
          </div>
        )}
        {creating ? (
          <NewChatForm
            client={client}
            onCancel={() => setCreating(false)}
            onCreate={(chat) => {
              dispatch({ type: 'open', chat });
              setCreating(false);
            }}
          />
        ) : active ? (
          <ChatView
            key={active.id}
            chat={active}
            messages={state.messages[active.id] ?? []}
            loading={!loadedHistory.includes(active.id)}
            onSend={send}
            onRetry={retry}
            onBack={() => dispatch({ type: 'select', id: null })}
          />
        ) : (
          <div className="placeholder">Выберите чат или создайте новый</div>
        )}
      </div>
    </div>
  );
}

export default ChatApp;
