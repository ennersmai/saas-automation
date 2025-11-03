import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine status code and message
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: string | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const responseObj = exceptionResponse as { message: string | string[]; error?: string };
        message = Array.isArray(responseObj.message)
          ? responseObj.message.join(', ')
          : responseObj.message;
        error = responseObj.error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Check if it's a database error
      if (
        exception.message.includes('timeout') ||
        exception.message.includes('ECONNREFUSED') ||
        exception.message.includes('ENOTFOUND') ||
        exception.message.includes('database')
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database connection error. Please try again.';
      }
    }

    // Log the error
    const logMessage = `${request.method} ${request.url} - ${status} - ${message}`;
    if (status >= 500) {
      this.logger.error(logMessage, exception instanceof Error ? exception.stack : exception);
    } else if (status === 401) {
      // 401s are expected on auth routes when no token is provided - only log at debug level
      const isAuthRoute = request.url.includes('/auth/');
      if (isAuthRoute && !request.headers.authorization) {
        // No token provided on auth route - expected, don't log
        this.logger.debug(logMessage);
      } else {
        // Token provided but invalid - log as warning
        this.logger.warn(logMessage);
      }
    } else {
      this.logger.warn(logMessage);
    }

    // Send error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(error && { error }),
    });
  }
}
