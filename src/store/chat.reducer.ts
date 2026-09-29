import type { Chat, Message } from 'types';

export interface ChatState {
  chats: Record<string, Chat>;
  messages: Record<string, Message[]>;
  activeId: string | null;
}

export const initialState: ChatState = { chats: {}, messages: {}, activeId: null };

export type Action =
  | { type: 'open'; chat: { id: string; title: string; phone?: string } }
  | { type: 'select'; id: string | null }
  | { type: 'sending'; message: Message }
  | { type: 'sent'; chatId: string; tempId: string; id: string }
  | { type: 'failed'; chatId: string; tempId: string; error: string }
  | { type: 'retry'; chatId: string; tempId: string }
  | { type: 'receive'; message: Message; peer: { title?: string; phone?: string } };

function upsertChat(
  state: ChatState,
  id: string,
  patch: Partial<Chat> & { title?: string }
): Record<string, Chat> {
  const prev = state.chats[id];
  const chat: Chat = {
    id,
    title: patch.title ?? prev?.title ?? id,
    phone: patch.phone ?? prev?.phone,
    lastActivity: patch.lastActivity ?? prev?.lastActivity ?? Date.now(),
    unread: patch.unread ?? prev?.unread ?? 0,
  };
  return { ...state.chats, [id]: chat };
}

function updateMessage(list: Message[], id: string, patch: Partial<Message>): Message[] {
  return list.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

export function chatReducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'open': {
      const { id, title, phone } = action.chat;
      const known = state.chats[id];
      return {
        ...state,
        activeId: id,
        chats: known ? state.chats : upsertChat(state, id, { title, phone }),
        messages: state.messages[id] ? state.messages : { ...state.messages, [id]: [] },
      };
    }

    case 'select': {
      if (action.id === null) return { ...state, activeId: null };
      const chat = state.chats[action.id];
      if (!chat) return state;
      return {
        ...state,
        activeId: action.id,
        chats: { ...state.chats, [action.id]: { ...chat, unread: 0 } },
      };
    }

    case 'sending': {
      const { message } = action;
      return {
        ...state,
        chats: upsertChat(state, message.chatId, { lastActivity: message.timestamp }),
        messages: {
          ...state.messages,
          [message.chatId]: [...(state.messages[message.chatId] ?? []), message],
        },
      };
    }

    case 'sent': {
      const list = state.messages[action.chatId] ?? [];
      const echoed = list.some((m) => m.id === action.id);
      const next = echoed
        ? list.filter((m) => m.id !== action.tempId)
        : updateMessage(list, action.tempId, { id: action.id, status: 'sent' });
      return { ...state, messages: { ...state.messages, [action.chatId]: next } };
    }

    case 'failed':
    case 'retry': {
      const patch: Partial<Message> =
        action.type === 'failed'
          ? { status: 'failed', error: action.error }
          : { status: 'sending', error: undefined };
      const list = state.messages[action.chatId] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.chatId]: updateMessage(list, action.tempId, patch),
        },
      };
    }

    case 'receive': {
      const { message, peer } = action;
      const list = state.messages[message.chatId] ?? [];
      if (list.some((m) => m.id === message.id)) return state;

      const isActive = state.activeId === message.chatId;
      const prev = state.chats[message.chatId];
      const unread =
        message.direction === 'in' && !isActive ? (prev?.unread ?? 0) + 1 : (prev?.unread ?? 0);
      return {
        ...state,
        chats: upsertChat(state, message.chatId, {
          title: peer.title ?? prev?.title,
          phone: peer.phone ?? prev?.phone,
          lastActivity: message.timestamp,
          unread,
        }),
        messages: {
          ...state.messages,
          [message.chatId]: [...list, message].sort((a, b) => a.timestamp - b.timestamp),
        },
      };
    }
  }
}

export function sortedChats(state: ChatState): Chat[] {
  return Object.values(state.chats).sort((a, b) => b.lastActivity - a.lastActivity);
}
