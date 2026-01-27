import pino, { type Logger, type LoggerOptions } from 'pino';

/**
 * Logger configuration options
 */
export interface LoggingOptions {
  /** Log level (default: 'info') */
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
  /** Whether to pretty print (default: true in non-CI) */
  pretty?: boolean;
  /** CI mode - no colors, machine-readable output */
  ci?: boolean;
  /** Custom destination (e.g., file stream) */
  destination?: pino.DestinationStream;
}

/**
 * Create a structured logger for the simulation
 */
export function createLogger(options: LoggingOptions = {}): Logger {
  const { level = 'info', pretty = !options.ci, ci = false, destination } = options;

  const loggerOptions: LoggerOptions = {
    level,
    base: {
      pid: undefined, // Don't include PID in logs
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // In CI mode or when pretty is disabled, use standard JSON output
  if (ci || !pretty) {
    return destination ? pino(loggerOptions, destination) : pino(loggerOptions);
  }

  // In development, use pretty printing
  const transport = pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  });

  return pino(loggerOptions, transport);
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(parent: Logger, context: Record<string, unknown>): Logger {
  return parent.child(context);
}

/**
 * Create a file destination for logging
 */
export function createFileDestination(path: string): pino.DestinationStream {
  return pino.destination({
    dest: path,
    sync: false,
  });
}

/**
 * Create a multi-destination logger (e.g., console + file)
 */
export function createMultiLogger(options: LoggingOptions, filePath?: string): Logger {
  const level = options.level === 'silent' ? 'info' : (options.level ?? 'info');
  const streams: pino.StreamEntry[] = [{ level, stream: process.stdout }];

  if (filePath) {
    streams.push({
      level: 'trace', // Log everything to file
      stream: pino.destination({
        dest: filePath,
        sync: false,
      }),
    });
  }

  return pino(
    {
      level: 'trace', // Set to trace so streams can filter
      base: { pid: undefined },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams)
  );
}

/**
 * Standard log event types for simulations
 */
export const LogEvents = {
  SIMULATION_START: 'simulation:start',
  SIMULATION_END: 'simulation:end',
  TICK_START: 'tick:start',
  TICK_END: 'tick:end',
  AGENT_STEP: 'agent:step',
  AGENT_ACTION: 'agent:action',
  AGENT_ERROR: 'agent:error',
  METRICS_SAMPLE: 'metrics:sample',
  ARTIFACT_WRITE: 'artifact:write',
} as const;

export type LogEvent = (typeof LogEvents)[keyof typeof LogEvents];
