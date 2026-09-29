import { initialState, type ChatState } from 'store/chat.reducer';
import type { Credentials } from 'types';

const CREDS_KEY = 'green-chat:credentials';
const chatKey = (idInstance: string) => `green-chat:state:${idInstance}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadCredentials = () => read<Credentials>(CREDS_KEY);
export const saveCredentials = (creds: Credentials) => write(CREDS_KEY, creds);
export const clearCredentials = () => {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    return;
  }
};

export function loadChatState(idInstance: string): ChatState {
  const saved = read<ChatState>(chatKey(idInstance));
  if (!saved) return initialState;
  const messages = Object.fromEntries(
    Object.entries(saved.messages).map(([id, list]) => [
      id,
      list.map((m) => (m.status === 'sending' ? { ...m, status: 'failed' as const } : m)),
    ])
  );
  return { ...saved, messages };
}

export const saveChatState = (idInstance: string, state: ChatState) =>
  write(chatKey(idInstance), state);
