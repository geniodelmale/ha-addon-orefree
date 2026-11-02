import { Page } from 'playwright';
import { RETRIES } from './constant';

export type Days = { today: string; tomorrow: string };
export type DailyCard = {
  date: string | null;
  hours: string | null;
  handlers: (string | null)[];
};

const ITALIAN_MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export function getDays(now = new Date()): Days {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((item) => item.type === type)?.value;
    if (!value) throw new Error('Unable to determine Rome calendar date');
    return value;
  };
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { today, tomorrow: next.toISOString().slice(0, 10) };
}

export function normalizeHours(value: string): string {
  const match = /^[ \t]*(\d{1,2}):([0-5]\d)[ \t]*-[ \t]*(\d{1,2}):([0-5]\d)[ \t]*$/.exec(value);
  if (!match || match[0] !== value) throw new Error('Invalid free-hours band');
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (start >= 1440 || end > 1440 || start >= end) {
    throw new Error('Invalid free-hours band');
  }
  return `${match[1].padStart(2, '0')}:${match[2]} - ${match[3].padStart(2, '0')}:${match[4]}`;
}

export function formatDays(days: Days, todayHours: string, tomorrowHours: string): string {
  return `${days.today}: ${normalizeHours(todayHours)}\n${days.tomorrow}: ${normalizeHours(tomorrowHours)}`;
}

export function findTomorrowHours(cards: DailyCard[], tomorrow: string): string | undefined {
  let result: string | undefined;
  for (const card of cards) {
    if (card.handlers.length === 0) throw new Error('Missing daily free-hours date');
    for (const handler of card.handlers) {
      // Read the handler as data only; never execute the modification action.
      const match = handler && /^\s*updatefascia\(\s*(['"])([^'"]*)\1\s*,\s*(['"])(\d{8})\3\s*\)\s*;?\s*$/.exec(handler);
      if (!match) throw new Error('Unrecognized daily free-hours date');
      const key = match[4];
      const date = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
      const parsed = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new Error('Invalid daily free-hours date');
      }
      if (date !== tomorrow) continue;
      // Alpine images may only include English ICU locale data.
      const label = `${parsed.getUTCDate()} ${ITALIAN_MONTHS[parsed.getUTCMonth()]}`;
      if (card.date?.trim().replace(/\s+/g, ' ').toLowerCase() !== label.toLowerCase()) {
        throw new Error('Inconsistent daily free-hours date');
      }
      if (card.hours === null) throw new Error('Missing tomorrow free-hours band');
      const hours = normalizeHours(card.hours);
      if (hours !== normalizeHours(match[2])) throw new Error('Inconsistent tomorrow free-hours band');
      if (result !== undefined && result !== hours) throw new Error('Conflicting tomorrow free-hours bands');
      result = hours;
    }
  }
  return result;
}

export async function readTomorrowHours(page: Page, tomorrow: string): Promise<string> {
  const cards = page.locator('div.single-info-box[data-info-date], div.single-info-box[data-info-orefree]');
  await cards.first().waitFor({ state: 'attached' });
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const values = await cards.evaluateAll((elements) => elements.map((element) => ({
      date: element.getAttribute('data-info-date'),
      hours: element.getAttribute('data-info-orefree'),
      handlers: Array.from(element.querySelectorAll('a.modify-daily')).map((link) => link.getAttribute('onclick')),
    })));
    const hours = findTomorrowHours(values, tomorrow);
    if (hours !== undefined) return hours;
    if (attempt + 1 < RETRIES) await page.waitForTimeout(1000);
  }
  throw new Error(`No published free hours for tomorrow (${tomorrow})`);
}
