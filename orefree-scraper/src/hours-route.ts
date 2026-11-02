import { FastifyInstance } from 'fastify';
import { OreFreeScraper } from './orefree-scraper';
import { HoursType } from './types';
import { formatHours } from './hours';

type HoursQuery = {
  username: string;
  password: string;
  type: HoursType;
  input_boolean_entity?: string;
  switch_entity?: string;
  default_value?: string;
};

export function registerHoursRoute(
  fastify: FastifyInstance,
  getDefaultValue: () => string | undefined,
  createScraper: typeof OreFreeScraper = OreFreeScraper,
): void {
  fastify.get<{ Querystring: HoursQuery }>(
    '/fetchHours',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            type: { type: 'string', enum: ['time', 'timeslot', 'timetomorrow'] },
            input_boolean_entity: { type: 'string' },
            switch_entity: { type: 'string' },
            default_value: { type: 'string' },
          },
          required: ['username', 'password', 'type'],
        },
      },
    },
    async (req, res) => {
      const { username, password, type, default_value, input_boolean_entity, switch_entity } = req.query;
      const scraper = await createScraper(username, password, fastify.log);
      try {
        const result = await scraper.fetchHours(
          type,
          type === 'timeslot' ? input_boolean_entity : '',
          type === 'timeslot' ? switch_entity : '',
        );
        if (type === 'timetomorrow') res.type('text/plain');
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isAuthError = message.includes('Login error') ||
          (type === 'timetomorrow' && message.includes('Login did not complete'));
        const isTimeout =
          (error instanceof Error && error.name === 'TimeoutError') ||
          message.toLowerCase().includes('timeout') ||
          message.includes('Failed to retrieve the scraped free hours');
        const fallbackValue = default_value ?? getDefaultValue();
        if (isTimeout && fallbackValue !== undefined && fallbackValue !== '' &&
            (type !== 'timetomorrow' || !isAuthError)) {
          if (type === 'timetomorrow') {
            let fallback: string;
            try {
              fallback = formatHours(fallbackValue, fallbackValue);
            } catch (fallbackError) {
              const detail = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
              fastify.log.error('Invalid timetomorrow default_value: ' + detail);
              return res.status(502).send({ error: 'Invalid timetomorrow default_value: ' + detail });
            }
            fastify.log.warn('Using fallback for both days after scraping failure: ' + message);
            return res.type('text/plain').send(fallback);
          }
          fastify.log.warn('Timeout occurred, returning default value: ' + fallbackValue);
          return fallbackValue;
        }
        return res.status(isAuthError ? 401 : 502).send({ error: message });
      }
    },
  );
}
