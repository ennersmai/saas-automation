import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as fs from 'fs';

@Injectable()
export class LoggingService implements LoggerService {
  private readonly webhookLogger: winston.Logger;
  private readonly conversationLogger: winston.Logger;
  private readonly generalLogger: winston.Logger;
  private readonly useFileLogging: boolean;

  constructor(private readonly configService: ConfigService) {
    // Use file logging in development, stdout/stderr in production
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    this.useFileLogging = nodeEnv === 'development';

    // Create logs directory if it doesn't exist (only in development)
    const logDir = 'logs';
    if (this.useFileLogging) {
      [logDir, `${logDir}/webhooks`, `${logDir}/conversations`, `${logDir}/general`].forEach(
        (dir) => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        },
      );
    }

    // Common format for all loggers
    const commonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    // Console format for production (more readable)
    const consoleFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
      }),
    );

    // Webhook logger - for Hostaway webhook payloads
    const webhookTransports: winston.transport[] = this.useFileLogging
      ? [
          new winston.transports.DailyRotateFile({
            filename: `${logDir}/webhooks/webhook-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'debug',
          }),
        ]
      : [
          new winston.transports.Console({
            format: consoleFormat,
            level: 'debug',
          }),
        ];

    this.webhookLogger = winston.createLogger({
      level: 'debug',
      format: commonFormat,
      transports: webhookTransports,
    });

    // Conversation logger - for message processing and conversations
    const conversationTransports: winston.transport[] = this.useFileLogging
      ? [
          new winston.transports.DailyRotateFile({
            filename: `${logDir}/conversations/conversation-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'debug',
          }),
        ]
      : [
          new winston.transports.Console({
            format: consoleFormat,
            level: 'debug',
          }),
        ];

    this.conversationLogger = winston.createLogger({
      level: 'debug',
      format: commonFormat,
      transports: conversationTransports,
    });

    // General logger - for other application logs
    const generalTransports: winston.transport[] = this.useFileLogging
      ? [
          new winston.transports.DailyRotateFile({
            filename: `${logDir}/general/app-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '7d',
            level: 'info',
          }),
        ]
      : [
          new winston.transports.Console({
            format: consoleFormat,
            level: 'info',
          }),
        ];

    this.generalLogger = winston.createLogger({
      level: 'info',
      format: commonFormat,
      transports: generalTransports,
    });
  }

  // Webhook logging methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logWebhook(payload: any, event: string, tenantId?: string) {
    this.webhookLogger.info('Webhook received', {
      event,
      tenantId,
      payload: JSON.stringify(payload, null, 2),
      timestamp: new Date().toISOString(),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logWebhookError(error: any, payload?: any, event?: string, tenantId?: string) {
    this.webhookLogger.error('Webhook error', {
      event,
      tenantId,
      error: error.message || error,
      stack: error.stack,
      payload: payload ? JSON.stringify(payload, null, 2) : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  // Conversation logging methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logConversation(message: string, data: any, tenantId?: string, conversationId?: string) {
    this.conversationLogger.info('Conversation event', {
      message,
      tenantId,
      conversationId,
      data: JSON.stringify(data, null, 2),
      timestamp: new Date().toISOString(),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logMessageProcessing(messageId: string, tenantId: string, messageType: string, data: any) {
    this.conversationLogger.info('Message processing', {
      messageId,
      tenantId,
      messageType,
      data: JSON.stringify(data, null, 2),
      timestamp: new Date().toISOString(),
    });
  }

  logMessageSent(
    messageId: string,
    tenantId: string,
    channel: string,
    recipient: string,
    content: string,
  ) {
    this.conversationLogger.info('Message sent', {
      messageId,
      tenantId,
      channel,
      recipient,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logApiResponse(service: string, endpoint: string, data: any, metadata?: Record<string, unknown>) {
    // Use a replacer function to handle circular references
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeStringify = (obj: any): string => {
      const seen = new WeakSet();
      return JSON.stringify(
        obj,
        (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          // Skip functions and undefined
          if (typeof value === 'function' || value === undefined) {
            return '[Function]';
          }
          return value;
        },
        2,
      );
    };

    this.generalLogger.info('API response', {
      service,
      endpoint,
      metadata: metadata ? safeStringify(metadata) : undefined,
      data: safeStringify(data),
      timestamp: new Date().toISOString(),
    });
  }

  // General logging methods (implementing LoggerService interface)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(message: any, context?: string) {
    this.generalLogger.info(message, { context });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: any, trace?: string, context?: string) {
    this.generalLogger.error(message, { trace, context });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: any, context?: string) {
    this.generalLogger.warn(message, { context });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: any, context?: string) {
    this.generalLogger.debug(message, { context });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verbose(message: any, context?: string) {
    this.generalLogger.verbose(message, { context });
  }
}
