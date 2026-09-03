import * as Sentry from '@sentry/nextjs';

const isProduction = process.env.NODE_ENV === 'production';

export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

const LOG_PREFIX = '[TransBodanon]';

function formatMessage(level: LogLevel, message: string, meta?: unknown): void {
  if (isProduction && level === 'debug') {
    return;
  }

  const timestamp = new Date().toISOString();
  const formatted = `${LOG_PREFIX} [${timestamp}] [${level.toUpperCase()}] ${message}`;

  switch (level) {
    case 'info':
      console.log(formatted, meta ?? '');
      break;
    case 'warning':
      console.warn(formatted, meta ?? '');
      break;
    case 'error':
      console.error(formatted, meta ?? '');
      break;
    case 'debug':
      console.debug(formatted, meta ?? '');
      break;
  }

  if (isProduction && (level === 'error' || level === 'warning')) {
    Sentry.captureMessage(message, level === 'error' ? 'error' : 'warning');
  }
}

export const AppLogger = {
  info: (message: string, meta?: unknown) => formatMessage('info', message, meta),
  warning: (message: string, meta?: unknown) => formatMessage('warning', message, meta),
  error: (message: string, meta?: unknown) => formatMessage('error', message, meta),
  debug: (message: string, meta?: unknown) => formatMessage('debug', message, meta),
};

export default AppLogger;
