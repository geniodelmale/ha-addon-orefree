const { test } = require('node:test');
const assert = require('node:assert/strict');
const playwright = require('playwright');
const Fastify = require('fastify');
const { getDays } = require('../src/hours');
const { registerHoursRoute } = require('../src/hours-route');

test('real browser fixture verifies full scraper/API, fallback and browser cleanup', async (t) => {
  assert.ok(process.env.OREFREE_TEST_BROWSER, 'Set OREFREE_TEST_BROWSER to an installed Chromium executable');
  const launch = playwright.chromium.launch.bind(playwright.chromium);
  for (const scenario of ['timetomorrow', 'time', 'timeslot', 'timeout', 'missing', 'midnight']) {
    const browser = await launch({ executablePath: process.env.OREFREE_TEST_BROWSER });
    const days = getDays();
    const tomorrowDate = new Date(`${days.tomorrow}T00:00:00Z`);
    const label = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(tomorrowDate);
    const key = days.tomorrow.replace(/-/g, '');
    let modifications = -1;
    let closes = 0;
    const newContext = browser.newContext.bind(browser);
    const close = browser.close.bind(browser);
    t.after(close);
    let page;
    t.mock.method(browser, 'newContext', async () => {
      const context = await newContext();
      const newPage = context.newPage.bind(context);
      t.mock.method(context, 'newPage', async () => {
        page = await newPage();
        await page.route('**/*', (route) => route.fulfill({
          contentType: 'text/html',
          body: `<script>window.modifications=0; function updatefascia(){window.modifications++}</script>
            <button id="truste-consent-required">Cookies</button>
            <input id="txtLoginUsername"><input id="txtLoginPassword"><button id="login-btn">Login</button>
            <button aria-label="chiudi modale">Close</button><a>Gestisci le ore free</a>
            <div id="fasciaGiornalieraImpostata" class="info-value">00:00 - 24:00</div>
            <div class="single-info-box">Unrelated information</div>
            ${scenario === 'timeout' ? '' : `<div class="single-info-box" data-info-date="${label}" data-info-orefree="10:00 - 13:00">
              <a class="forniture-link modify-daily" onclick="updatefascia('10:00 - 13:00','${scenario === 'missing' ? '19991103' : key}')">MODIFICA</a>
            </div>`}`,
        }));
        const wait = page.waitForTimeout.bind(page);
        t.mock.method(page, 'waitForTimeout', () => wait(10));
        t.mock.method(page, 'screenshot', async () => Buffer.alloc(0));
        page.setDefaultTimeout(5000);
        return page;
      });
      return context;
    });
    t.mock.method(browser, 'close', async () => {
      closes++;
      modifications = await page.evaluate(() => window.modifications);
      return close();
    });
    const launchMock = t.mock.method(playwright.chromium, 'launch', async () => browser);
    const app = Fastify();
    const diagnostics = [];
    app.log.error = (message) => diagnostics.push(String(message));
    app.log.warn = (message) => diagnostics.push(String(message));
    registerHoursRoute(app, () => undefined);
    const type = ['timeout', 'missing', 'midnight'].includes(scenario) ? 'timetomorrow' : scenario;
    if (scenario === 'midnight') {
      const hours = require('../src/hours');
      let calls = 0;
      const realGetDays = hours.getDays;
      t.mock.method(hours, 'getDays', () => ++calls === 1 ? days : getNextDays(realGetDays, days));
    }
    try {
      const address = await app.listen({ host: '127.0.0.1', port: 0 });
      const query = new URLSearchParams({
        username: 'fixture-user', password: 'fixture-password', type,
        input_boolean_entity: 'input_boolean.free', switch_entity: 'switch.schedule',
        default_value: '04:00 - 07:00',
      });
      const http = await fetch(`${address}/fetchHours?${query}`);
      const body = await http.text();
      const response = { statusCode: http.status, body, json: () => JSON.parse(body) };
      assert.equal(response.statusCode, ['missing', 'midnight'].includes(scenario) ? 502 : 200);
      if (type === 'timetomorrow' && response.statusCode === 200) {
        assert.match(http.headers.get('content-type'), /^text\/plain/);
      }
      if (scenario === 'timetomorrow') {
        assert.equal(response.body, '00:00 - 24:00\n10:00 - 13:00', diagnostics.join('\n'));
      } else if (scenario === 'timeout') {
        assert.equal(response.body, '04:00 - 07:00\n04:00 - 07:00');
      } else if (scenario === 'time') {
        assert.equal(response.body, '00:01 - 23:59');
      } else if (scenario === 'timeslot') {
        const value = JSON.parse(response.body);
        assert.deepEqual(value.timeslots.map((slot) => slot.start), ['00:00', '23:59']);
        assert.equal(value.entity_id, 'switch.schedule');
      } else {
        assert.match(response.json().error, scenario === 'missing' ? /No published/ : /Calendar day changed/);
      }
      assert.equal(modifications, 0);
      assert.equal(closes, 1);
      assert.equal(browser.isConnected(), false);
    } finally {
      await app.close();
      launchMock.mock.restore();
      if (scenario === 'midnight') t.mock.restoreAll();
      await close();
    }
  }
});

function getNextDays(getDays, days) {
  return getDays(new Date(`${days.tomorrow}T12:00:00Z`));
}
