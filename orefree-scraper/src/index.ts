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
    timestamp: () => `,"time":"${dayjs().format('YYYY-MM-DD HH:mm:ss')}"`,
    formatters: {
      level: (level) => ({ level }),
    },
  },
});

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
        },
        required: ['username', 'password', 'type'],
      },
    },
  },
  async (req, res) => {
    const { username, password, type } = req.query as { username: string; password: string; type: 'time' | 'timeslot'; };

    const scraper = await OreFreeScraper(username, password, fastify.log);
    return scraper.fetchHours(type);
  },
);

fastify.listen({ host: '0.0.0.0', port: getOptions().port ?? 8000 })
  .catch(err => {
    fastify.log.error(err);
    process.exit(1);
  });
