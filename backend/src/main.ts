/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';

import { AppModule } from './app/app.module';

const isPgShutdownError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  if (code && ['57P01', '57P02', '57P03', '53300'].includes(code)) {
    return true;
  }

  const message = (error as { message?: string }).message ?? '';
  return /db_termination|terminating connection|server closed the connection|connection reset/i.test(
    message,
  );
};

process.on('uncaughtException', (error) => {
  if (isPgShutdownError(error)) {
    // Silently ignore database pool shutdown errors - they're handled by DatabaseService
    return;
  }

  Logger.error('Uncaught exception', error as Error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  if (isPgShutdownError(reason)) {
    // Silently ignore database pool shutdown errors - they're handled by DatabaseService
    return;
  }

  Logger.error('Unhandled promise rejection', reason as Error);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS - allow localhost and Vercel deployments
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:3000',
  ];

  // Add Vercel domain if provided
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    allowedOrigins.push(`https://${vercelUrl}`);
  }

  // Add custom frontend URL if provided
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    allowedOrigins.push(frontendUrl);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || origin.includes('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 8080;
  await app.listen(port);
  Logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
