import type { HistoryItem } from 'services/green-api.service';
import type { Message } from 'types';
import { UNSUPPORTED_MESSAGE_TEXT } from 'utils/message.utils';

function chronological(items: HistoryItem[]): HistoryItem[] {
  const isAscending = items.length > 1 && items[0].timestamp < items[items.length - 1].timestamp;
  return isAscending ? items : [...items].reverse();
}

export function parseHistory(items: HistoryItem[] | null, chatId: string): Message[] {
  return chronological(items ?? [])
    .filter((item) => item.idMessage && item.chatId === chatId)
    .map((item) => ({
      id: item.idMessage,
      chatId,
      text:
        item.typeMessage === 'textMessage' && item.textMessage
          ? item.textMessage
          : UNSUPPORTED_MESSAGE_TEXT,
      direction: item.type === 'incoming' ? 'in' : 'out',
      timestamp: item.timestamp * 1000,
      status: 'sent',
    }));
}
