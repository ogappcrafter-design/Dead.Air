import { captureException } from './errorTracking';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel = __DEV__ ? 'debug' : 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatMessage(level: LogLevel, context: string, message: string): string {
  return `[${level.toUpperCase()}] [${context}] ${message}`;
}

export const logger = {
  debug(context: string, message: string, ...args: unknown[]): void {
    if (!shouldLog('debug')) return;
    if (__DEV__) console.debug(formatMessage('debug', context, message), ...args);
  },

  info(context: string, message: string, ...args: unknown[]): void {
    if (!shouldLog('info')) return;
    if (__DEV__) console.info(formatMessage('info', context, message), ...args);
  },

  warn(context: string, message: string, ...args: unknown[]): void {
    if (!shouldLog('warn')) return;
    if (__DEV__) console.warn(formatMessage('warn', context, message), ...args);
  },

  error(context: string, message: string, error?: unknown, ...args: unknown[]): void {
    if (!shouldLog('error')) return;
    if (__DEV__) console.error(formatMessage('error', context, message), error, ...args);
    // Forward to Sentry in production
    captureException(error ?? new Error(formatMessage('error', context, message)), {
      context,
      message,
    });
  },
};

/**
 * Structured logger compatible with pino/bunyan logging interfaces.
 */
export const structuredLogger = {
  level: MIN_LEVEL,
  info(obj: Record<string, unknown>, msg?: string) {
    logger.info((obj.context as string) || 'structured', msg || JSON.stringify(obj));
  },
  error(obj: Record<string, unknown>, msg?: string) {
    logger.error((obj.context as string) || 'structured', msg || '', obj.err);
  },
};

/**
 * Lightweight metrics telemetry recorder (opentelemetry compatible interface).
 */
export const metrics = {
  record(name: string, value: number, attributes?: Record<string, string | number>) {
    if (__DEV__) {
      logger.debug('opentelemetry:metrics', `${name}=${value}`, attributes);
    }
  },
};
