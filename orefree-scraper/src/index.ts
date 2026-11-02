import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import Fastify from 'fastify';
import { registerHoursRoute } from './hours-route';
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

registerHoursRoute(fastify, () => getOptions().default_value);

fastify.listen({ host: '0.0.0.0', port: getOptions().port ?? 8000 })
  .catch(err => {
    fastify.log.error(err);
    process.exit(1);
  });
