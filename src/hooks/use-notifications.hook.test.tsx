import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useNotifications } from './use-notifications.hook';
import {
  ApiError,
  type GreenApiClient,
  type ReceivedNotification,
} from 'services/green-api.service';

const incoming = (receiptId: number, idMessage: string): ReceivedNotification => ({
  receiptId,
  body: {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 1763115112,
    idMessage,
    senderData: { chatId: '10', senderName: 'Вася' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
  },
});

type Step = ReceivedNotification | null | Error;

function createFakeClient(steps: Step[]) {
  const calls: string[] = [];
  const queue = [...steps];
  const client = {
    receiveNotification: vi.fn((signal: AbortSignal) => {
      const step = queue.shift();
      if (step === undefined) {
        return new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        );
      }
      if (step instanceof Error) return Promise.reject(step);
      return Promise.resolve(step);
    }),
    deleteNotification: vi.fn(async (receiptId: number) => {
      calls.push(`delete:${receiptId}`);
      return { result: true };
    }),
  };
  return { client: client as unknown as GreenApiClient, calls, mock: client };
}

describe('useNotifications', () => {
  it('отдаёт событие и удаляет уведомление только после обработки', async () => {
    const { client, calls } = createFakeClient([incoming(7, 'A')]);
    const onEvent = vi.fn(() => calls.push('event'));

    const { result } = renderHook(() => useNotifications(client, onEvent));

    await waitFor(() => expect(calls).toEqual(['event', 'delete:7']));
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.objectContaining({ id: 'A', text: 'Привет' }) })
    );
    expect(result.current).toBe('online');
  });

  it('удаляет служебные уведомления, не создавая событий', async () => {
    const status = { receiptId: 8, body: { typeWebhook: 'outgoingMessageStatus' } };
    const { client, calls } = createFakeClient([status]);
    const onEvent = vi.fn();

    renderHook(() => useNotifications(client, onEvent));

    await waitFor(() => expect(calls).toEqual(['delete:8']));
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('не удаляет ничего при пустой очереди и остаётся на связи', async () => {
    const { client, calls, mock } = createFakeClient([null, null]);

    const { result } = renderHook(() => useNotifications(client, vi.fn()));

    await waitFor(() => expect(mock.receiveNotification).toHaveBeenCalledTimes(3));
    expect(calls).toEqual([]);
    expect(result.current).toBe('online');
  });

  it('останавливается при неверных данных инстанса', async () => {
    const { client, mock } = createFakeClient([new ApiError('нет доступа', 401)]);

    const { result } = renderHook(() => useNotifications(client, vi.fn()));

    await waitFor(() => expect(result.current).toBe('unauthorized'));
    expect(mock.receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('уходит в офлайн при сбое сети и восстанавливается', async () => {
    const { client, calls } = createFakeClient([new ApiError('нет связи'), incoming(9, 'B')]);

    const { result } = renderHook(() => useNotifications(client, vi.fn()));

    await waitFor(() => expect(result.current).toBe('offline'));
    await waitFor(() => expect(calls).toEqual(['delete:9']), { timeout: 3000 });
    expect(result.current).toBe('online');
  });

  it('прекращает опрос после размонтирования', async () => {
    const { client, mock } = createFakeClient([null]);

    const { unmount } = renderHook(() => useNotifications(client, vi.fn()));
    await waitFor(() => expect(mock.receiveNotification).toHaveBeenCalledTimes(2));
    unmount();
    const callsAtUnmount = mock.receiveNotification.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mock.receiveNotification.mock.calls.length).toBe(callsAtUnmount);
  });
});
