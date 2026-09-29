import { describe, expect, it, vi } from 'vitest';

import { ApiError, createClient } from './green-api.service';

const creds = {
  apiUrl: 'https://example.api.green-api.com/',
  idInstance: '4100',
  apiTokenInstance: 'tok',
};

const reply = (body: string, status = 200) =>
  vi.fn().mockResolvedValue(new Response(body, { status }));

describe('createClient', () => {
  it('отправляет sendMessage на правильный адрес с JSON', async () => {
    const f = reply('{"idMessage":"1"}');
    const res = await createClient(creds, f).sendMessage('123', 'привет');
    expect(res.idMessage).toBe('1');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://example.api.green-api.com/waInstance4100/sendMessage/tok');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ chatId: '123', message: 'привет' });
  });

  it('передаёт receiveTimeout и возвращает null на пустую очередь', async () => {
    const f = reply('null');
    const res = await createClient(creds, f).receiveNotification(new AbortController().signal, 30);
    expect(res).toBeNull();
    expect(f.mock.calls[0][0]).toContain('/receiveNotification/tok?receiveTimeout=30');
  });

  it('удаляет уведомление по receiptId методом DELETE', async () => {
    const f = reply('{"result":true}');
    await createClient(creds, f).deleteNotification(77);
    expect(f.mock.calls[0][0]).toMatch(/\/deleteNotification\/tok\/77$/);
    expect(f.mock.calls[0][1].method).toBe('DELETE');
  });

  it('различает ошибки авторизации и прочие', async () => {
    const auth = await createClient(creds, reply('', 401))
      .getStateInstance()
      .catch((e) => e);
    expect(auth).toBeInstanceOf(ApiError);
    expect(auth.isAuth).toBe(true);
    const other = await createClient(creds, reply('', 500))
      .getStateInstance()
      .catch((e) => e);
    expect(other.isAuth).toBe(false);
  });

  it('сообщает об исчерпанной квоте тарифа (466)', async () => {
    const err = await createClient(creds, reply('', 466))
      .checkAccount(79001234567)
      .catch((e) => e);
    expect(err.message).toMatch(/квота/);
    expect(err.isAuth).toBe(false);
  });

  it('превращает сетевой сбой в понятную ошибку', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(createClient(creds, f).getStateInstance()).rejects.toThrow(/Нет связи/);
  });
});
