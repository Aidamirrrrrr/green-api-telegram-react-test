import { initialState, type ChatState } from 'store/chat.reducer';
import type { Credentials } from 'types';

const CREDS_KEY = 'green-chat:credentials';
const chatKey = (idInstance: string) => `green-chat:state:${idInstance}`;

type StorageKind = 'local' | 'session';

function getStorage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read<T>(kind: StorageKind, key: string): T | null {
  try {
    const raw = getStorage(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(kind: StorageKind, key: string, value: unknown): boolean {
  try {
    getStorage(kind)?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(kind: StorageKind, key: string) {
  try {
    getStorage(kind)?.removeItem(key);
  } catch {
    return;
  }
}

export const loadCredentials = () =>
  read<Credentials>('session', CREDS_KEY) ?? read<Credentials>('local', CREDS_KEY);

export function saveCredentials(creds: Credentials, remember: boolean) {
  clearCredentials();
  write(remember ? 'local' : 'session', CREDS_KEY, creds);
}

export function clearCredentials() {
  remove('session', CREDS_KEY);
  remove('local', CREDS_KEY);
}

export function loadChatState(idInstance: string): ChatState {
  const saved = read<ChatState>('local', chatKey(idInstance));
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
  write('local', chatKey(idInstance), state);
