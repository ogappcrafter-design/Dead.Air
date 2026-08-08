import { SeededRNG } from './SeededRNG';
import { getTodayUTC } from './DailyCallGenerator';
import type { CallData } from './types';

export interface CallOfTheDayOptions {
  dateStr?: string;
  calls?: CallData[];
}

export interface CallOfTheDayResult {
  callId: number;
  date: string;
  callerName: string;
  band: number;
  lines: string[];
}

const DEFAULT_CALLS: CallData[] = [];

export class CallOfTheDayGenerator {
  private calls: CallData[];

  constructor(calls: CallData[] = DEFAULT_CALLS) {
    this.calls = calls.length > 0 ? calls : DEFAULT_CALLS;
  }

  generate(options: CallOfTheDayOptions = {}): CallOfTheDayResult {
    const dateStr = options.dateStr ?? getTodayUTC();
    const calls = options.calls ?? this.calls;

    if (calls.length === 0) {
      return {
        callId: 0,
        date: dateStr,
        callerName: 'UNKNOWN',
        band: 0,
        lines: [],
      };
    }

    const seed = `callOfTheDay:${dateStr}`;
    const rng = new SeededRNG(seed);
    const call = rng.pick(calls);

    return {
      callId: call.id,
      date: dateStr,
      callerName: call.callerName,
      band: call.band,
      lines: call.lines ?? [],
    };
  }
}

export function getCallOfTheDay(calls: CallData[], dateStr?: string): CallOfTheDayResult {
  const generator = new CallOfTheDayGenerator(calls);
  return generator.generate({ dateStr });
}
