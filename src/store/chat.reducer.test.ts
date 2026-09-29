import { describe, expect, it } from 'vitest';

import { chatReducer, initialState, type ChatState } from './chat.reducer';
import type { Message } from 'types';

const msg = (over: Partial<Message>): Message => ({
  id: 'm1',
  chatId: 'c1',
  text: 'hi',
  direction: 'in',
  timestamp: 1000,
  status: 'sent',
  ...over,
});

const withChat = (): ChatState =>
  chatReducer(initialState, {
    type: 'open',
    chat: { id: 'c1', title: '+79001234567', phone: '79001234567' },
  });

describe('chatReducer', () => {
  it('не дублирует чат при повторном создании', () => {
    const s = chatReducer(withChat(), { type: 'open', chat: { id: 'c1', title: 'x' } });
    expect(Object.keys(s.chats)).toEqual(['c1']);
    expect(s.chats.c1.title).toBe('+79001234567');
  });

  it('считает непрочитанные только в неактивных чатах', () => {
    let s = chatReducer(withChat(), { type: 'select', id: null });
    s = chatReducer(s, { type: 'receive', message: msg({}), peer: { title: 'Вася' } });
    expect(s.chats.c1.unread).toBe(1);
    expect(s.chats.c1.title).toBe('Вася');
    s = chatReducer(s, { type: 'select', id: 'c1' });
    expect(s.chats.c1.unread).toBe(0);
    s = chatReducer(s, { type: 'receive', message: msg({ id: 'm2' }), peer: {} });
    expect(s.chats.c1.unread).toBe(0);
  });

  it('отбрасывает повторную доставку уведомления', () => {
    let s = chatReducer(withChat(), { type: 'receive', message: msg({}), peer: {} });
    s = chatReducer(s, { type: 'receive', message: msg({}), peer: {} });
    expect(s.messages.c1).toHaveLength(1);
  });

  it('заменяет временный id настоящим после отправки', () => {
    let s = chatReducer(withChat(), {
      type: 'sending',
      message: msg({ id: 'tmp', direction: 'out', status: 'sending' }),
    });
    s = chatReducer(s, { type: 'sent', chatId: 'c1', tempId: 'tmp', id: 'real' });
    expect(s.messages.c1).toEqual([expect.objectContaining({ id: 'real', status: 'sent' })]);
  });

  it('не показывает сообщение дважды, если эхо пришло раньше ответа sendMessage', () => {
    let s = chatReducer(withChat(), {
      type: 'sending',
      message: msg({ id: 'tmp', direction: 'out', status: 'sending' }),
    });
    s = chatReducer(s, {
      type: 'receive',
      message: msg({ id: 'real', direction: 'out' }),
      peer: {},
    });
    s = chatReducer(s, { type: 'sent', chatId: 'c1', tempId: 'tmp', id: 'real' });
    expect(s.messages.c1.map((m) => m.id)).toEqual(['real']);
  });

  it('помечает неудачную отправку и позволяет повторить', () => {
    let s = chatReducer(withChat(), {
      type: 'sending',
      message: msg({ id: 'tmp', direction: 'out', status: 'sending' }),
    });
    s = chatReducer(s, { type: 'failed', chatId: 'c1', tempId: 'tmp', error: 'квота' });
    expect(s.messages.c1[0]).toMatchObject({ status: 'failed', error: 'квота' });
    s = chatReducer(s, { type: 'retry', chatId: 'c1', tempId: 'tmp' });
    expect(s.messages.c1[0].status).toBe('sending');
  });
});
