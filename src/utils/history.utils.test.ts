import { describe, expect, it } from 'vitest';

import { parseHistory } from './history.utils';
import type { HistoryItem } from 'services/green-api.service';

const item = (over: Partial<HistoryItem>): HistoryItem => ({
  type: 'incoming',
  idMessage: 'm1',
  timestamp: 1763115112,
  typeMessage: 'textMessage',
  chatId: '10',
  textMessage: 'Привет',
  ...over,
});

describe('parseHistory', () => {
  it('превращает записи журнала в сообщения чата', () => {
    const messages = parseHistory(
      [item({}), item({ idMessage: 'm2', type: 'outgoing', textMessage: 'Ответ' })],
      '10'
    );
    const incoming = messages.find((m) => m.id === 'm1');
    const outgoing = messages.find((m) => m.id === 'm2');
    expect(incoming).toEqual({
      id: 'm1',
      chatId: '10',
      text: 'Привет',
      direction: 'in',
      timestamp: 1763115112000,
      status: 'sent',
    });
    expect(outgoing).toMatchObject({ id: 'm2', direction: 'out', text: 'Ответ' });
  });

  it('заменяет нетекстовые сообщения заглушкой', () => {
    const [message] = parseHistory(
      [item({ typeMessage: 'imageMessage', textMessage: undefined })],
      '10'
    );
    expect(message.text).toMatch(/неподдерживаемого/);
  });

  it('отбрасывает записи чужих чатов и пустой ответ', () => {
    expect(parseHistory([item({ chatId: '99' })], '10')).toEqual([]);
    expect(parseHistory(null, '10')).toEqual([]);
  });

  it('сохраняет порядок сообщений одной секунды, когда журнал идёт от новых к старым', () => {
    const newestFirst = [
      item({ idMessage: 'in2', type: 'incoming' }),
      item({ idMessage: 'out2', type: 'outgoing' }),
      item({ idMessage: 'in1', type: 'incoming' }),
      item({ idMessage: 'out1', type: 'outgoing' }),
    ];
    expect(parseHistory(newestFirst, '10').map((m) => m.id)).toEqual([
      'out1',
      'in1',
      'out2',
      'in2',
    ]);
  });

  it('не переворачивает журнал, который уже идёт от старых к новым', () => {
    const oldestFirst = [
      item({ idMessage: 'a', timestamp: 100 }),
      item({ idMessage: 'b', timestamp: 200 }),
    ];
    expect(parseHistory(oldestFirst, '10').map((m) => m.id)).toEqual(['a', 'b']);
  });
});
