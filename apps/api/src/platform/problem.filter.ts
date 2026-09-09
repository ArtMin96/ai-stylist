import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Logger } from 'nestjs-pino';

import { type ErrorCode, type ProblemDetails, problem } from '@ai-stylist/shared-kernel';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'ACCOUNT_DELETED',
  429: 'RATE_LIMITED',
};

/** Problem details plus RFC 9457 extension members (e.g. health `checks`). */
export type ProblemBody = ProblemDetails & Record<string, unknown>;

type StatusCarrier = { statusCode?: unknown; status?: unknown };

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (typeof exception === 'object' && exception !== null) {
    const { statusCode, status } = exception as StatusCarrier;
    const candidate = typeof statusCode === 'number' ? statusCode : status;
    if (typeof candidate === 'number' && candidate >= 400 && candidate <= 599) return candidate;
  }
  return 500;
}

/** Map any thrown value to a problem body. 5xx never leak internals (doc 06 §2). */
export function toProblem(exception: unknown, instance: string): ProblemBody {
  const status = statusOf(exception);
  const code: ErrorCode = STATUS_TO_CODE[status] ?? 'INTERNAL';
  const base = problem(code, { instance, status });
  if (status >= 500 && status !== 503) return { ...base };

  let detail: string | undefined;
  let extensions: Record<string, unknown> = {};
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === 'string') detail = response;
    else if (typeof response === 'object' && response !== null) {
      const {
        message,
        detail: d,
        error: _error,
        statusCode: _s,
        ...rest
      } = response as Record<string, unknown>;
      detail = typeof d === 'string' ? d : typeof message === 'string' ? message : undefined;
      extensions = rest;
    }
  } else if (exception instanceof Error) {
    detail = exception.message;
  }
  if (status === 503) {
    return {
      ...base,
      title: 'Service unavailable',
      ...(detail !== undefined ? { detail } : {}),
      ...extensions,
    };
  }
  return { ...base, ...(detail !== undefined ? { detail } : {}), ...extensions };
}

/** Global filter: every error leaves the API as RFC 9457 `application/problem+json`. */
@Catch()
@Injectable()
export class ProblemFilter implements ExceptionFilter {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();
    const body = toProblem(exception, request.url.split('?')[0] ?? request.url);
    if (body.status >= 500) {
      this.logger.error(
        { err: exception, status: body.status, code: body.code },
        'unhandled error',
      );
    }
    void reply.status(body.status).header('content-type', PROBLEM_CONTENT_TYPE).send(body);
  }
}
