const { test } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { registerHoursRoute } = require('../src/hours-route');

const expectedFallback = '04:00 - 07:00\n04:00 - 07:00';

async function request(t, query, { result, error, configured } = {}) {
  const app = Fastify();
  let calls = 0;
  const warnings = [];
  const errors = [];
  app.log.warn = (message) => warnings.push(message);
  app.log.error = (message) => errors.push(message);
  registerHoursRoute(app, () => configured, async () => ({
    fetchHours: async (type, boolean, entity) => {
      calls++;
      if (error) throw error;
      return result ?? `${type}|${boolean}|${entity}`;
    },
  }));
  t.after(() => app.close());
  const response = await app.inject({
    method: 'GET', url: '/fetchHours',
    query: { username: 'test-user', password: 'test-password', ...query },
  });
  return { response, calls, warnings, errors };
}

test('timetomorrow returns two text lines without Home Assistant entities', async (t) => {
  const text = '04:00 - 07:00\n10:00 - 13:00';
  const { response, calls } = await request(t, { type: 'timetomorrow' }, { result: text });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^text\/plain/);
  assert.equal(response.body, text);
  assert.equal(calls, 1);
});

test('validates type before scraping and preserves legacy entity arguments', async (t) => {
  for (const query of [{}, { type: 'unknown' }]) {
    const { response, calls } = await request(t, query);
    assert.equal(response.statusCode, 400);
    assert.equal(calls, 0);
  }
  for (const type of ['time', 'timeslot']) {
    const { response } = await request(t, {
      type, input_boolean_entity: 'input_boolean.free', switch_entity: 'switch.schedule',
    });
    assert.equal(response.body, type === 'time' ? 'time||' : 'timeslot|input_boolean.free|switch.schedule');
  }
});

test('all existing timeout categories use one band on both lines without dates with a warning', async (t) => {
  for (const error of [
    Object.assign(new Error('waiting for page'), { name: 'TimeoutError' }),
    new Error('operation timeout'),
    new Error('Failed to retrieve the scraped free hours after multiple attempts'),
  ]) {
    const { response, warnings } = await request(t, {
      type: 'timetomorrow', default_value: '4:00 - 7:00',
    }, { error });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'], /^text\/plain/);
    assert.equal(response.body, expectedFallback);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /fallback.*both days/i);
  }
});

test('fallback query/config precedence and disabling match time', async (t) => {
  const error = new Error('timeout');
  const config = await request(t, { type: 'timetomorrow' }, { error, configured: '04:00 - 07:00' });
  assert.equal(config.response.body, expectedFallback);
  const query = await request(t, { type: 'timetomorrow', default_value: '04:00 - 07:00' },
    { error, configured: '10:00 - 13:00' });
  assert.equal(query.response.body, expectedFallback);
  for (const options of [{ error }, { error, configured: '04:00 - 07:00' }]) {
    const { response } = await request(t, { type: 'timetomorrow', default_value: '' }, options);
    assert.equal(response.statusCode, 502);
  }
  assert.equal((await request(t, { type: 'timetomorrow' }, { error })).response.statusCode, 502);
});

test('invalid fallback and non-timeout errors remain explicit', async (t) => {
  for (const value of ['invalid', '04:00 - 07:00\n04:00 - 07:00']) {
    const { response, warnings, errors } = await request(t, {
      type: 'timetomorrow', default_value: value,
    }, { error: new Error('timeout') });
    assert.equal(response.statusCode, 502);
    assert.match(response.json().error, /Invalid.*default_value/);
    assert.equal(warnings.length, 0);
    assert.equal(errors.length, 1);
  }
  for (const message of ['Login error: timeout', 'Login did not complete (still on SSO login page)',
    'No published free hours for tomorrow',
    'Inconsistent free hours', 'unexpected error']) {
    const { response, warnings } = await request(t, {
      type: 'timetomorrow', default_value: '04:00 - 07:00',
    }, { error: new Error(message) });
    assert.equal(response.statusCode, message.startsWith('Login ') ? 401 : 502);
    assert.equal(warnings.length, 0);
  }
});

test('legacy timeout fallback remains the exact supplied string', async (t) => {
  for (const type of ['time', 'timeslot']) {
    const { response } = await request(t, { type, default_value: 'legacy arbitrary value' },
      { error: new Error('timeout') });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'legacy arbitrary value');
  }
});
