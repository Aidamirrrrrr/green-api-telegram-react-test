import type { Credentials } from 'types';

const QUOTA_EXCEEDED_STATUS = 466;
const AUTH_STATUSES = [400, 401, 403];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuth(): boolean {
    return this.status !== undefined && AUTH_STATUSES.includes(this.status);
  }
}

export interface CheckAccountResult {
  exist: boolean;
  chatId?: string;
  username?: string;
  phoneNumber?: number;
}

export interface InstanceSettings {
  webhookUrl?: string;
  incomingWebhook?: 'yes' | 'no';
}

export interface HistoryItem {
  type: 'incoming' | 'outgoing';
  idMessage: string;
  timestamp: number;
  typeMessage: string;
  chatId: string;
  textMessage?: string;
}

export interface ReceivedNotification {
  receiptId: number;
  body: unknown;
}

type Fetch = typeof fetch;

export function createClient(creds: Credentials, fetchImpl: Fetch = (...args) => fetch(...args)) {
  const base = `${creds.apiUrl.trim().replace(/\/+$/, '')}/waInstance${creds.idInstance.trim()}`;
  const token = creds.apiTokenInstance.trim();

  async function request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    name: string,
    options: { body?: unknown; query?: string; tail?: string; signal?: AbortSignal } = {}
  ): Promise<T> {
    const url = `${base}/${name}/${token}${options.tail ?? ''}${options.query ?? ''}`;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method,
        signal: options.signal,
        headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      throw new ApiError('Нет связи с GREEN-API. Проверьте интернет и apiUrl.');
    }
    if (!res.ok) throw new ApiError(describeStatus(res.status), res.status);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  return {
    getStateInstance: (signal?: AbortSignal) =>
      request<{ stateInstance: string }>('GET', 'getStateInstance', { signal }),

    getSettings: (signal?: AbortSignal) =>
      request<InstanceSettings>('GET', 'getSettings', { signal }),

    checkAccount: (phoneNumber: number) =>
      request<CheckAccountResult>('POST', 'checkAccount', { body: { phoneNumber } }),

    sendMessage: (chatId: string, message: string) =>
      request<{ idMessage: string }>('POST', 'sendMessage', { body: { chatId, message } }),

    getChatHistory: (chatId: string, count: number, signal?: AbortSignal) =>
      request<HistoryItem[]>('POST', 'getChatHistory', { body: { chatId, count }, signal }),

    receiveNotification: (signal: AbortSignal, receiveTimeout = 20) =>
      request<ReceivedNotification | null>('GET', 'receiveNotification', {
        signal,
        query: `?receiveTimeout=${receiveTimeout}`,
      }),

    deleteNotification: (receiptId: number) =>
      request<{ result: boolean }>('DELETE', 'deleteNotification', { tail: `/${receiptId}` }),
  };
}

export type GreenApiClient = ReturnType<typeof createClient>;

function describeStatus(status: number): string {
  switch (status) {
    case 400:
    case 401:
    case 403:
      return 'Неверные idInstance или apiTokenInstance.';
    case 429:
      return 'Слишком много запросов, попробуйте чуть позже.';
    case QUOTA_EXCEEDED_STATUS:
      return 'Исчерпана квота тарифа GREEN-API: на бесплатном тарифе 3 чата и 100 проверок номеров.';
    default:
      return `GREEN-API вернул ошибку ${status}.`;
  }
}
