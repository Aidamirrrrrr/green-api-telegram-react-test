import { useEffect, useState } from 'react';

import { ApiError, type GreenApiClient } from 'services/green-api.service';
import { parseNotification, type IncomingEvent } from 'utils/notification.utils';

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'unauthorized';

const MAX_BACKOFF_MS = 30_000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export function useNotifications(
  client: GreenApiClient,
  onEvent: (event: IncomingEvent) => void
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const abort = new AbortController();
    const { signal } = abort;

    (async () => {
      let backoff = 1000;
      while (!signal.aborted) {
        try {
          const notification = await client.receiveNotification(signal);
          if (signal.aborted) return;
          setStatus('online');
          backoff = 1000;
          if (!notification) continue;

          const event = parseNotification(notification.body);
          if (event) onEvent(event);
          await client.deleteNotification(notification.receiptId);
        } catch (e) {
          if (signal.aborted) return;
          if (e instanceof ApiError && e.isAuth) {
            setStatus('unauthorized');
            return;
          }
          setStatus('offline');
          await sleep(backoff, signal);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      }
    })();

    return () => abort.abort();
  }, [client, onEvent]);

  return status;
}
