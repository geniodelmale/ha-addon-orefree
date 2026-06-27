import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import Fastify from 'fastify';
import { OreFreeScraper } from './orefree-scraper';
import { getOptions } from './config';

dayjs.extend(timezone);
dayjs.tz.setDefault(process.env.TZ ?? 'Asia/Tokyo');

const fastify = Fastify({
  logger: {
    level: getOptions().log_level ?? 'info',
    // pino-pretty: log leggibili (non JSON) nel tab "Log" di Home Assistant.
    // sync: true è necessario perché Node gira come PID 1 nel container
    // dell'addon (init: false): senza, Pino bufferizza e i log non compaiono.
    transport: {
      target: 'pino-pretty',
      options: {
        sync: true,
        colorize: false,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Gestione segnali per flush ordinato quando l'addon viene fermato/riavviato
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    fastify.log.info(`Received ${sig}, shutting down`);
    fastify.close().then(() => process.exit(0));
  });
}

fastify.get('/', async (req, res) => {
  return { message: 'OreFree Scraper is running!' };
});

fastify.get(
  '/fetchHours',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
          type: { type: 'string', enum: ['time', 'timeslot'] },
          input_boolean_entity: { type: 'string' },
          switch_entity: { type: 'string' },
          default_value: { type: 'string' },
        },
        required: ['username', 'password', 'type'],
      },
    },
  },
  async (req, res) => {
    const { username, password, type } = req.query as { username: string; password: string; type: 'time' | 'timeslot'; };

    const { default_value } = req.query as { default_value?: string };

    let inputBooleanEntity = '';
    let switchEntity = '';
    if (type === 'timeslot') {
      const { input_boolean_entity, switch_entity } = req.query as { input_boolean_entity: string; switch_entity: string; };
      inputBooleanEntity = input_boolean_entity;
      switchEntity = switch_entity;
    }

    const scraper = await OreFreeScraper(username, password, fastify.log);
    try {
      return await scraper.fetchHours(type, inputBooleanEntity, switchEntity);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAuthError = message.includes('Login error');
      const isTimeout =
        (error instanceof Error && error.name === 'TimeoutError') ||
        message.toLowerCase().includes('timeout') ||
        message.includes('Failed to retrieve the scraped free hours');

      if (isTimeout && default_value !== undefined && default_value !== '') {
        fastify.log.warn('Timeout occurred, returning default value: ' + default_value);
        return default_value;
      }

      return res
        .status(isAuthError ? 401 : 502)
        .send({ error: message });
    }
  },
);

fastify.listen({ host: '0.0.0.0', port: getOptions().port ?? 8000 })
  .catch(err => {
    fastify.log.error(err);
    process.exit(1);
  });
