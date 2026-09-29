const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayYearFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const DAY_MS = 24 * 60 * 60 * 1000;

export const isSameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

export const formatTime = (timestamp: number) => timeFormat.format(timestamp);

export function formatDay(timestamp: number, now = Date.now()): string {
  if (isSameDay(timestamp, now)) return 'Сегодня';
  if (isSameDay(timestamp, now - DAY_MS)) return 'Вчера';
  const sameYear = new Date(timestamp).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayFormat : dayYearFormat).format(timestamp);
}

export const initials = (title: string) =>
  title.replace(/^\+/, '').trim().slice(0, 2).toUpperCase() || '?';
