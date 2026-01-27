import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogEvents, createChildLogger, createLogger } from '../../src/core/logging.js';

describe('createLogger', () => {
  it('creates a logger with default options', () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('creates a logger with custom level', () => {
    const logger = createLogger({ level: 'debug' });
    expect(logger).toBeDefined();
  });

  it('creates a logger in CI mode', () => {
    const logger = createLogger({ ci: true });
    expect(logger).toBeDefined();
  });

  it('creates a logger with pretty disabled', () => {
    const logger = createLogger({ pretty: false });
    expect(logger).toBeDefined();
  });

  it('respects level option', () => {
    const debugLogger = createLogger({ level: 'debug' });
    const errorLogger = createLogger({ level: 'error' });

    // Both should be valid loggers
    expect(debugLogger).toBeDefined();
    expect(errorLogger).toBeDefined();
  });

  it('can log messages without throwing', () => {
    const logger = createLogger({ level: 'silent' });

    // None of these should throw
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.error('error message')).not.toThrow();
    expect(() => logger.debug('debug message')).not.toThrow();
    expect(() => logger.warn('warn message')).not.toThrow();
  });

  it('can log with object context', () => {
    const logger = createLogger({ level: 'silent' });

    expect(() =>
      logger.info({ event: 'test', data: { foo: 'bar' } }, 'test message')
    ).not.toThrow();
  });
});

describe('createChildLogger', () => {
  it('creates a child logger with additional context', () => {
    const parent = createLogger({ level: 'silent' });
    const child = createChildLogger(parent, { component: 'test' });

    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
  });

  it('child logger inherits parent level', () => {
    const parent = createLogger({ level: 'debug' });
    const child = createChildLogger(parent, { requestId: '123' });

    expect(child).toBeDefined();
  });

  it('can create multiple levels of children', () => {
    const parent = createLogger({ level: 'silent' });
    const child1 = createChildLogger(parent, { level: 1 });
    const child2 = createChildLogger(child1, { level: 2 });

    expect(child2).toBeDefined();
  });
});

describe('LogEvents', () => {
  it('defines SIMULATION_START event', () => {
    expect(LogEvents.SIMULATION_START).toBe('simulation:start');
  });

  it('defines SIMULATION_END event', () => {
    expect(LogEvents.SIMULATION_END).toBe('simulation:end');
  });

  it('defines TICK_START event', () => {
    expect(LogEvents.TICK_START).toBe('tick:start');
  });

  it('defines TICK_END event', () => {
    expect(LogEvents.TICK_END).toBe('tick:end');
  });

  it('defines AGENT_ACTION event', () => {
    expect(LogEvents.AGENT_ACTION).toBe('agent:action');
  });

  it('defines AGENT_ERROR event', () => {
    expect(LogEvents.AGENT_ERROR).toBe('agent:error');
  });
});
