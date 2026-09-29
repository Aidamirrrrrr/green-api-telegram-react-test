import { describe, expect, it } from 'vitest';

import {
  clearCredentials,
  loadChatState,
  loadCredentials,
  saveChatState,
  saveCredentials,
} from './storage.utils';
import { initialState, type ChatState } from 'store/chat.reducer';
import type { Credentials } from 'types';

const creds: Credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '4100000001',
  apiTokenInstance: 'secret',
};

describe('credentials', () => {
  it('по умолчанию держит токен только до закрытия вкладки', () => {
    saveCredentials(creds, false);
    expect(sessionStorage.getItem('green-chat:credentials')).toContain('secret');
    expect(localStorage.getItem('green-chat:credentials')).toBeNull();
    expect(loadCredentials()).toEqual(creds);
  });

  it('сохраняет токен надолго, если попросили запомнить', () => {
    saveCredentials(creds, true);
    expect(localStorage.getItem('green-chat:credentials')).toContain('secret');
    expect(sessionStorage.getItem('green-chat:credentials')).toBeNull();
    expect(loadCredentials()).toEqual(creds);
  });

  it('не оставляет старый токен при смене режима и удаляет всё при выходе', () => {
    saveCredentials(creds, true);
    saveCredentials(creds, false);
    expect(localStorage.getItem('green-chat:credentials')).toBeNull();
    clearCredentials();
    expect(loadCredentials()).toBeNull();
  });
});

describe('chat state', () => {
  it('возвращает пустое состояние, если ничего не сохранено или данные повреждены', () => {
    expect(loadChatState('1')).toBe(initialState);
    localStorage.setItem('green-chat:state:1', '{oops');
    expect(loadChatState('1')).toBe(initialState);
  });

  it('помечает недоотправленные сообщения как неудачные после перезагрузки', () => {
    const state: ChatState = {
      chats: {},
      activeId: null,
      messages: {
        c1: [
          { id: 'a', chatId: 'c1', text: 'x', direction: 'out', timestamp: 1, status: 'sending' },
          { id: 'b', chatId: 'c1', text: 'y', direction: 'out', timestamp: 2, status: 'sent' },
        ],
      },
    };
    saveChatState('1', state);
    expect(loadChatState('1').messages.c1.map((m) => m.status)).toEqual(['failed', 'sent']);
  });

  it('хранит историю каждого инстанса отдельно', () => {
    saveChatState('1', { ...initialState, activeId: 'one' });
    saveChatState('2', { ...initialState, activeId: 'two' });
    expect(loadChatState('1').activeId).toBe('one');
    expect(loadChatState('2').activeId).toBe('two');
  });
});
