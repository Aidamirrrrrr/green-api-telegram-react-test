import type { Message } from 'types';
import { UNSUPPORTED_MESSAGE_TEXT } from 'utils/message.utils';

export interface IncomingEvent {
  message: Message;
  peer: { title?: string; phone?: string };
}

interface RawBody {
  typeWebhook?: string;
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId?: string;
    chatName?: string;
    senderName?: string;
    senderContactName?: string;
    senderPhoneNumber?: number | string;
  };
  chatData?: { chatId?: string };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: { text?: string };
  };
}

const INCOMING = 'incomingMessageReceived';
const OUTGOING = ['outgoingMessageReceived', 'outgoingAPIMessageReceived'];

export function parseNotification(raw: unknown): IncomingEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as RawBody;
  const type = body.typeWebhook;
  const isIncoming = type === INCOMING;
  if (!isIncoming && !(type && OUTGOING.includes(type))) return null;

  const chatId = body.senderData?.chatId ?? body.chatData?.chatId;
  if (!chatId || !body.idMessage) return null;

  const data = body.messageData;
  const text =
    data?.textMessageData?.textMessage ??
    data?.extendedTextMessageData?.text ??
    UNSUPPORTED_MESSAGE_TEXT;

  const sender = body.senderData;
  const phone = sender?.senderPhoneNumber ? String(sender.senderPhoneNumber) : undefined;

  return {
    message: {
      id: body.idMessage,
      chatId,
      text,
      direction: isIncoming ? 'in' : 'out',
      timestamp: (body.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
      status: 'sent',
    },
    peer: isIncoming
      ? { title: sender?.senderContactName || sender?.senderName || sender?.chatName, phone }
      : {},
  };
}
