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
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : 'INTERNAL_SERVER_ERROR';

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : Array.isArray((exceptionResponse as { message?: unknown }).message)
          ? (exceptionResponse as { message: string[] }).message[0]
          : ((exceptionResponse as { message?: string }).message ?? 'INTERNAL_SERVER_ERROR');

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      error: isHttpException ? 'HttpException' : 'InternalServerError',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId ?? null,
    });
  }
}
