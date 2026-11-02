import { FastifyBaseLogger } from 'fastify';

export type Logger = FastifyBaseLogger;
export type HoursType = 'time' | 'timeslot' | 'timetomorrow';

export type Usage = {
  date: string;
  usage: number;
};
