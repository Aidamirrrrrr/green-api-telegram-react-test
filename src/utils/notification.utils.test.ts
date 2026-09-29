import { describe, expect, it } from 'vitest';

import { parseNotification } from './notification.utils';

const incoming = {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1763115112,
  idMessage: 'ABC',
  senderData: { chatId: '10000000', senderName: 'Василиса', senderPhoneNumber: 79876543210 },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
};

describe('parseNotification', () => {
  it('разбирает входящее текстовое сообщение', () => {
    const e = parseNotification(incoming)!;
    expect(e.message).toMatchObject({
      id: 'ABC',
      chatId: '10000000',
      text: 'Привет',
      direction: 'in',
      timestamp: 1763115112000,
    });
    expect(e.peer).toEqual({ title: 'Василиса', phone: '79876543210' });
  });

  it('разбирает исходящее сообщение, отправленное через API', () => {
    const e = parseNotification({ ...incoming, typeWebhook: 'outgoingAPIMessageReceived' })!;
    expect(e.message.direction).toBe('out');
    expect(e.peer).toEqual({});
  });

  it('читает extendedTextMessage', () => {
    const e = parseNotification({
      ...incoming,
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'ссылка' },
      },
    })!;
    expect(e.message.text).toBe('ссылка');
  });

  it('показывает заглушку для нетекстовых сообщений', () => {
    const e = parseNotification({ ...incoming, messageData: { typeMessage: 'imageMessage' } })!;
    expect(e.message.text).toMatch(/неподдерживаемого/);
  });

  it('игнорирует статусы и мусор', () => {
    expect(parseNotification({ typeWebhook: 'outgoingMessageStatus' })).toBeNull();
    expect(parseNotification(null)).toBeNull();
    expect(parseNotification({ typeWebhook: 'incomingMessageReceived' })).toBeNull();
  });
});
