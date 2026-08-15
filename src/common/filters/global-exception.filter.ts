import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    // Raw exception details (name/message/stack) are only useful for local
    // debugging — never expose them outside dev/test, since they can leak
    // internals (query text, file paths, library versions) to a client.
    const includeErrorDetails = process.env.NODE_ENV !== 'production';

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      const body: Record<string, unknown> = {
        status: false,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse.message ?? exception.message),
      };

      if (exceptionResponse.fields) {
        body.fields = exceptionResponse.fields;
      }

      if (includeErrorDetails) {
        body.error = { name: exception.name, message: exception.message, stack: exception.stack };
      }

      return response.status(httpStatus).json(body);
    }

    const body: Record<string, unknown> = {
      status: false,
      message: 'Internal server error',
    };

    if (includeErrorDetails && exception instanceof Error) {
      body.error = { name: exception.name, message: exception.message, stack: exception.stack };
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
