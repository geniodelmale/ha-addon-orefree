const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getDays, normalizeHours, formatDays, findTomorrowHours, readTomorrowHours } = require('../src/hours');

const card = {
  date: '3 Novembre',
  hours: '10:00 - 13:00',
  handlers: ["updatefascia('10:00 - 13:00','20261103')"],
};

test('reads tomorrow by complete date, accepts identical copies and formats two lines', () => {
  const other = { ...card, date: '4 Novembre', handlers: ["updatefascia('10:00 - 13:00','20261104')"] };
  const days = getDays(new Date('2026-11-02T12:00:00Z'));
  assert.equal(findTomorrowHours([other, card, card], days.tomorrow), '10:00 - 13:00');
  assert.equal(formatDays(days, '4:00 - 7:00', findTomorrowHours([card], days.tomorrow)),
    '2026-11-02: 04:00 - 07:00\n2026-11-03: 10:00 - 13:00');
  assert.equal(findTomorrowHours([card], '2027-11-03'), undefined);
});

test('rejects inconsistent, missing or conflicting card data without executing onclick', () => {
  const different = { ...card, hours: '11:00 - 14:00', handlers: ["updatefascia('11:00 - 14:00','20261103')"] };
  assert.throws(() => findTomorrowHours([card, different], '2026-11-03'), /Conflicting/);
  for (const invalid of [
    { ...card, hours: '' }, { ...card, hours: null }, { ...card, date: '4 Novembre' },
    { ...card, hours: '11:00 - 14:00' }, { ...card, handlers: [] },
    { ...card, handlers: ["updatefascia('10:00 - 13:00','20260230')"] },
    { ...card, handlers: ["updatefascia('10:00 - 13:00','20261103'); dangerous()"] },
  ]) assert.throws(() => findTomorrowHours([invalid], '2026-11-03'));
});

test('uses Rome calendar dates across year, leap day and daylight-saving boundaries', () => {
  for (const [instant, today, tomorrow] of [
    ['2026-11-02T23:30:00Z', '2026-11-03', '2026-11-04'],
    ['2026-12-31T12:00:00Z', '2026-12-31', '2027-01-01'],
    ['2028-02-28T12:00:00Z', '2028-02-28', '2028-02-29'],
    ['2026-03-28T23:30:00Z', '2026-03-29', '2026-03-30'],
    ['2026-10-24T22:30:00Z', '2026-10-25', '2026-10-26'],
  ]) assert.deepEqual(getDays(new Date(instant)), { today, tomorrow });
});

test('validates a single band while preserving 00:00 and 24:00', () => {
  assert.equal(normalizeHours('4:00  -  7:00'), '04:00 - 07:00');
  assert.equal(normalizeHours('00:00 - 24:00'), '00:00 - 24:00');
  for (const value of ['', '25:00 - 26:00', '24:01 - 24:02', '4:60 - 7:00',
    '24:00 - 07:00', '07:00 - 04:00', '04:00 - 04:00', '04:00 - 07:00\n',
    '04:00 - 07:00\n04:00 - 07:00']) {
    assert.throws(() => normalizeHours(value), /Invalid/);
  }
});

test('waits and retries delayed cards without clicking modify', async () => {
  let reads = 0;
  const page = {
    locator: () => ({
      first: () => ({ waitFor: async () => {} }),
      evaluateAll: async () => ++reads === 1 ? [] : [card],
    }),
    waitForTimeout: async () => {},
  };
  assert.equal(await readTomorrowHours(page, '2026-11-03'), '10:00 - 13:00');
  assert.equal(reads, 2);
  await assert.rejects(readTomorrowHours(page, '2026-11-04'), /No published free hours/);
});
