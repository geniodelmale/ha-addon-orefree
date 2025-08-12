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

// fastify.post(
//   '/login',
//   {
//     schema: {
//       body: {
//         type: 'object',
//         properties: {
//           username: { type: 'string' },
//           password: { type: 'string' },
//           customerNumber: { type: 'string' },
//         },
//         required: ['username', 'password', 'customerNumber'],
//       },
//     },
//   },
//   async (req, res) => {
//     const { username, password, customerNumber } = req.body as { username: string; password: string; customerNumber: string  };

//     const scraper = await OreFreeScraper(username, password, customerNumber, fastify.log);
//     const result = await scraper.verifyCredentials();

//     if (!result) {
//       return res.status(401).send();
//     }

//     return res.status(204).send();
//   }
// )

fastify.get(
  '/fetchHours',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['username', 'password'],
      },
    },
  },
  async (req, res) => {
    const { username, password} = req.query as { username: string; password: string; };

    const scraper = await OreFreeScraper(username, password, fastify.log);
    return scraper.fetchHours();
  },
);

fastify.listen({ host: '0.0.0.0', port: getOptions().port ?? 8000 })
  .catch(err => {
    fastify.log.error(err);
    process.exit(1);
  });
