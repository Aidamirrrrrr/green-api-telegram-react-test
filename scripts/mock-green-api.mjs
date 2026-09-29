import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const REPLY_DELAY_MS = Number(process.env.REPLY_DELAY_MS ?? 1500);
const CHAT_LIMIT = 3;
const MAX_POLL_MS = 8000;
const NO_ACCOUNT_SUFFIX = '000';
const INVALID_TOKEN = 'wrong';

const queue = [];
const waiters = [];
const knownChats = new Set();
const phones = new Map();
const history = new Map();
const NAMES = [
  'Анна Каренина',
  'Иван Царевич',
  'Василиса Премудрая',
  'Елена Прекрасная',
  'Кощей Бессмертный',
];
let receiptSeq = 1000;
let messageSeq = 1;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const chatIdOf = (phone) => String(phone).slice(-8);
const nameOf = (chatId) => NAMES[Number(chatId) % NAMES.length];

function record(body) {
  const chatId = body.senderData.chatId;
  const item = {
    type: body.typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing',
    idMessage: body.idMessage,
    timestamp: body.timestamp,
    typeMessage: 'textMessage',
    chatId,
    chatType: 'user',
    textMessage: body.messageData.textMessageData.textMessage,
  };
  history.set(chatId, [item, ...(history.get(chatId) ?? [])]);
}

function push(body) {
  record(body);
  const item = { receiptId: ++receiptSeq, body };
  queue.push(item);
  waiters.splice(0).forEach((wake) => wake());
}

function notification(type, chatId, text, phone) {
  const name = nameOf(chatId);
  return {
    typeWebhook: type,
    instanceData: { idInstance: 4100000001, wid: '79000000000@c.us', typeInstance: 'telegram' },
    timestamp: nowSeconds(),
    idMessage: `MOCK${++messageSeq}${Date.now()}`,
    senderData: {
      chatId,
      chatName: name,
      sender: chatId,
      senderName: name,
      senderContactName: name,
      senderPhoneNumber: Number(phone),
    },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  };
}

function scheduleReply(chatId, text) {
  setTimeout(() => {
    push(
      notification('incomingMessageReceived', chatId, `Получила: «${text}»`, phones.get(chatId))
    );
  }, REPLY_DELAY_MS);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
  });
}

function send(res, status, payload) {
  const text = payload === undefined ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(text);
}

function waitForNotification(seconds) {
  const timeout = Math.min(seconds * 1000, MAX_POLL_MS);
  return new Promise((resolve) => {
    if (queue.length) return resolve(queue[0]);
    const timer = setTimeout(() => resolve(null), timeout);
    waiters.push(() => {
      clearTimeout(timer);
      resolve(queue[0] ?? null);
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return send(res, 204);

  const [, instance, method, token, tail] = url.pathname.split('/');
  if (!instance?.startsWith('waInstance') || !method) return send(res, 404);
  if (token === INVALID_TOKEN) return send(res, 401);

  switch (method) {
    case 'getStateInstance':
      return send(res, 200, { stateInstance: 'authorized' });

    case 'getSettings':
      return send(res, 200, { webhookUrl: '', incomingWebhook: 'yes' });

    case 'checkAccount': {
      const { phoneNumber } = await readBody(req);
      const exist = !String(phoneNumber).endsWith(NO_ACCOUNT_SUFFIX);
      if (exist) phones.set(chatIdOf(phoneNumber), phoneNumber);
      return send(
        res,
        200,
        exist ? { exist, chatId: chatIdOf(phoneNumber), phoneNumber } : { exist }
      );
    }

    case 'sendMessage': {
      const { chatId, message } = await readBody(req);
      if (!knownChats.has(chatId) && knownChats.size >= CHAT_LIMIT) return send(res, 466);
      knownChats.add(chatId);
      const outgoing = notification('outgoingAPIMessageReceived', chatId, message, '79000000000');
      push(outgoing);
      scheduleReply(chatId, message);
      return send(res, 200, { idMessage: outgoing.idMessage });
    }

    case 'getChatHistory': {
      const { chatId, count = 100 } = await readBody(req);
      return send(res, 200, (history.get(chatId) ?? []).slice(0, count));
    }

    case 'receiveNotification': {
      const seconds = Number(url.searchParams.get('receiveTimeout') ?? 5);
      const item = await waitForNotification(seconds);
      return send(res, 200, item);
    }

    case 'deleteNotification': {
      const index = queue.findIndex((item) => String(item.receiptId) === tail);
      if (index >= 0) queue.splice(index, 1);
      return send(res, 200, { result: index >= 0, reason: '' });
    }

    default:
      return send(res, 404);
  }
});

server.listen(PORT, () => {
  console.log(`Mock GREEN-API: http://localhost:${PORT}`);
  console.log(`  idInstance: любые цифры, apiTokenInstance: любой, кроме "${INVALID_TOKEN}"`);
  console.log(
    `  номера на "${NO_ACCOUNT_SUFFIX}" не имеют аккаунта, после ${CHAT_LIMIT} чатов приходит 466`
  );
});
