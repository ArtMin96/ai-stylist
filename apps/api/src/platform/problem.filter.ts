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

import { stripQuery } from './logger.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'ACCOUNT_DELETED',
  // A request body in a media type the route does not accept: the request fails validation.
  415: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
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
  return { ...base, ...(detail !== undefined ? { detail } : {}), ...extensions };
}

/**
 * `body` with the raw request URL in its `detail` replaced by `path`: Nest's unknown-route 404
 * quotes the URL (`Cannot GET /v1/x?sig=…`), query string included.
 */
function withoutQueryInDetail(body: ProblemBody, url: string, path: string): ProblemBody {
  if (body.detail === undefined || url === path) return body;
  return { ...body, detail: body.detail.replaceAll(url, () => path) };
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
    // `instance` and any URL `detail` quotes are the path only: the same cut as a logged request
    // url (no query, no fragment).
    const path = stripQuery(request.url);
    const body = withoutQueryInDetail(toProblem(exception, path), request.url, path);
    if (body.status >= 500) {
      // nestjs-pino reads the last string as the Nest context. Without it 'unhandled error' would
      // be that context and the line would carry only the logger's generic `error logged`.
      this.logger.error(
        { err: exception, status: body.status, code: body.code },
        'unhandled error',
        ProblemFilter.name,
      );
    }
    void reply.status(body.status).header('content-type', PROBLEM_CONTENT_TYPE).send(body);
  }
}
