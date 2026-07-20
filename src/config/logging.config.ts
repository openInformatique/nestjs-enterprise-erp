import { registerAs } from '@nestjs/config';
import { LogLevel } from './environment.validation';

/** Configuration des logs Pino. */
export interface LoggingConfig {
  level: LogLevel;
}

export const loggingConfig = registerAs('logging', (): LoggingConfig => ({
  level: process.env.LOG_LEVEL as LogLevel,
}));
