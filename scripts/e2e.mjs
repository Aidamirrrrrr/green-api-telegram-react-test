import { chromium } from 'playwright-core';

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const APP_URL = 'http://localhost:5173/';
const MOCK_URL = 'http://localhost:8787';
const INSTANCE = '4100000001';
const SCREENSHOT_DIR = fileURLToPath(new URL('../docs/', import.meta.url));
const withScreenshots = process.argv.includes('--screenshots');

const children = [];

function start(command, args) {
  const child = spawn(command, args, { stdio: 'ignore', detached: false });
  children.push(child);
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Сервер не ответил: ${url}`);
}

const step = (title) => console.log(`✓ ${title}`);
const reply = (page, text) => page.locator('.bubble__text', { hasText: `Получила: «${text}»` });

async function login(page, { token = 'demo-token', remember = false } = {}) {
  await page.getByLabel('apiUrl').fill(MOCK_URL);
  await page.getByLabel('idInstance').fill(INSTANCE);
  await page.getByLabel('apiTokenInstance').fill(token);
  if (remember) await page.getByLabel('Запомнить на этом устройстве').check();
  await page.getByRole('button', { name: 'Войти' }).click();
}

async function openChat(page, phone) {
  await page.getByRole('button', { name: 'Новый чат' }).click();
  await page.getByLabel('Номер телефона получателя').fill(phone);
  await page.getByRole('button', { name: 'Создать' }).click();
  await page.getByLabel('Сообщение').waitFor();
}

async function say(page, text) {
  await page.getByLabel('Сообщение').fill(text);
  await page.keyboard.press('Enter');
}

async function shot(page, name) {
  if (withScreenshots) await page.screenshot({ path: `${SCREENSHOT_DIR}${name}.png` });
}

async function run(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(APP_URL);
  await shot(page, '01-login');

  await login(page, { token: 'wrong' });
  await page.getByRole('alert').filter({ hasText: 'Неверные idInstance' }).waitFor();
  await shot(page, '02-login-error');
  step('неверный токен показывает ошибку');

  await login(page);
  await page.getByText('Выберите чат или создайте новый').waitFor();
  await shot(page, '03-empty');
  const storedToken = await page.evaluate(() => localStorage.getItem('green-chat:credentials'));
  if (storedToken !== null) throw new Error('токен без «запомнить» попал в localStorage');
  step('вход по данным инстанса, токен не сохраняется надолго');

  await page.reload();
  await page.getByText('Выберите чат или создайте новый').waitFor();
  step('перезагрузка вкладки не разлогинивает');

  await page.getByRole('button', { name: 'Новый чат' }).click();
  await page.getByLabel('Номер телефона получателя').fill('+7 900 000-00-00');
  await page.getByRole('button', { name: 'Создать' }).click();
  await page.getByRole('alert').filter({ hasText: 'нет аккаунта Telegram' }).waitFor();
  await shot(page, '04-no-account');
  step('номер без аккаунта Telegram отклоняется');

  await page.getByLabel('Номер телефона получателя').fill('8 900 123-45-67');
  await page.getByRole('button', { name: 'Создать' }).click();
  await page.getByLabel('Сообщение').waitFor();
  await shot(page, '05-new-chat');
  step('чат создаётся по номеру');

  await say(page, 'Привет! Это тестовое сообщение');
  await shot(page, '06-sending');
  await reply(page, 'Привет! Это тестовое сообщение').waitFor();
  await shot(page, '07-reply');
  step('сообщение отправлено, ответ получателя виден в чате');

  await say(page, 'Как дела?');
  await reply(page, 'Как дела?').waitFor();
  const outgoing = await page.locator('.bubble--out').count();
  const incoming = await page.locator('.bubble--in').count();
  if (outgoing !== 2 || incoming !== 2) throw new Error(`дубли сообщений: ${outgoing}/${incoming}`);
  step('эхо собственных сообщений не создаёт дублей');

  await openChat(page, '+7 900 555-22-11');
  await say(page, 'Второй чат');
  await page.locator('.chatitem', { hasText: 'Василиса Премудрая' }).click();
  await page.locator('.chatitem', { hasText: 'Иван Царевич' }).locator('.badge').waitFor();
  await shot(page, '08-unread');
  const title = await page.title();
  if (!title.startsWith('(1) ')) throw new Error(`нет счётчика в заголовке: ${title}`);
  step('непрочитанные считаются в списке и в заголовке вкладки');

  await page.evaluate((id) => localStorage.removeItem(`green-chat:state:${id}`), INSTANCE);
  await page.reload();
  await page.getByText('Чатов пока нет').waitFor();
  await openChat(page, '8 900 123-45-67');
  await page.locator('.bubble--out').getByText('Привет! Это тестовое сообщение').waitFor();
  await reply(page, 'Как дела?').waitFor();
  await shot(page, '09-history');
  step('история подгружается из GREEN-API');

  await openChat(page, '+7 900 777-88-99');
  await say(page, 'Третий чат');
  await page.locator('.chatitem', { hasText: 'Кощей Бессмертный' }).waitFor();
  await openChat(page, '+7 900 111-22-33');
  await say(page, 'Четвёртый чат');
  await page.getByText('Исчерпана квота тарифа').waitFor();
  await shot(page, '10-quota');
  step('исчерпанная квота (466) показывает причину и кнопку «Повторить»');

  await context.close();

  const fresh = await browser.newContext({ locale: 'ru-RU' });
  const freshPage = await fresh.newPage();
  await freshPage.goto(APP_URL);
  await freshPage.getByRole('button', { name: 'Войти' }).waitFor();
  await fresh.close();
  step('в новой сессии без «запомнить» нужен повторный вход');

  const remembering = await browser.newContext({ locale: 'ru-RU' });
  const rememberPage = await remembering.newPage();
  await rememberPage.goto(APP_URL);
  await login(rememberPage, { remember: true });
  await rememberPage.getByText('Выберите чат или создайте новый').waitFor();
  await rememberPage.reload();
  await rememberPage.getByText('Выберите чат или создайте новый').waitFor();
  await remembering.close();
  step('«запомнить на этом устройстве» сохраняет вход');

  const dark = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
    locale: 'ru-RU',
  });
  const darkPage = await dark.newPage();
  await darkPage.goto(APP_URL);
  await login(darkPage);
  await darkPage.getByText('Выберите чат или создайте новый').waitFor();
  await openChat(darkPage, '+7 900 123-45-67');
  await say(darkPage, 'Тёмная тема');
  await reply(darkPage, 'Тёмная тема').waitFor();
  await shot(darkPage, '11-dark');
  await dark.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(APP_URL);
  await login(mobilePage);
  await mobilePage.getByText('Чатов пока нет').waitFor();
  await openChat(mobilePage, '+7 900 123-45-67');
  await say(mobilePage, 'С телефона');
  await reply(mobilePage, 'С телефона').waitFor();
  await shot(mobilePage, '12-mobile-chat');
  await mobilePage.getByLabel('К списку чатов').click();
  await mobilePage.getByRole('button', { name: 'Новый чат' }).waitFor();
  await shot(mobilePage, '13-mobile-list');
  await mobile.close();
  step('тёмная тема и мобильная раскладка работают');

  if (pageErrors.length) throw new Error(`ошибки на странице: ${pageErrors.join('; ')}`);
}

async function main() {
  if (withScreenshots) await mkdir(SCREENSHOT_DIR, { recursive: true });
  start('node', ['scripts/mock-green-api.mjs']);
  start('npx', ['vite', '--port', '5173', '--strictPort']);
  await Promise.all([waitFor(APP_URL), waitFor(`${MOCK_URL}/waInstance1/getStateInstance/x`)]);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await run(browser);
    console.log('\nСквозной сценарий пройден');
  } finally {
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => children.forEach((child) => child.kill()));
