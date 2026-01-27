import type { Logger } from 'pino';

/**
 * Create a silent mock logger for testing
 * All log calls are no-ops but maintain the interface
 */
export function createMockLogger(): Logger {
  const noop = () => mockLogger;

  const mockLogger = {
    level: 'silent',
    fatal: noop,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    trace: noop,
    silent: noop,
    child: () => createMockLogger(),
    bindings: () => ({}),
    flush: () => {},
    isLevelEnabled: () => false,
    levels: {
      labels: {},
      values: {},
    },
  } as unknown as Logger;

  return mockLogger;
}

/**
 * Create a mock logger that records all log calls
 */
export interface LogEntry {
  level: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface RecordingLogger extends Logger {
  logs: LogEntry[];
  clear: () => void;
}

export function createRecordingLogger(): RecordingLogger {
  const logs: LogEntry[] = [];

  const createLogFn = (level: string) => {
    return (objOrMsg: unknown, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        logs.push({ level, message: objOrMsg });
      } else {
        logs.push({
          level,
          message: msg ?? '',
          data: objOrMsg as Record<string, unknown>,
        });
      }
      return recordingLogger;
    };
  };

  const recordingLogger = {
    level: 'trace',
    logs,
    clear: () => {
      logs.length = 0;
    },
    fatal: createLogFn('fatal'),
    error: createLogFn('error'),
    warn: createLogFn('warn'),
    info: createLogFn('info'),
    debug: createLogFn('debug'),
    trace: createLogFn('trace'),
    silent: createLogFn('silent'),
    child: () => createRecordingLogger(),
    bindings: () => ({}),
    flush: () => {},
    isLevelEnabled: () => true,
    levels: {
      labels: {},
      values: {},
    },
  } as unknown as RecordingLogger;

  return recordingLogger;
}
