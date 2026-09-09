// GENERATED — do not edit. Run `just generate`.
// Source: packages/contracts/openapi/**

export type ClientOptions = {
  baseUrl: 'https://api.ai-stylist.app/v1' | 'http://localhost:3000/v1' | (string & {});
};

/**
 * RFC 9457 problem details (planning/06 §2). `code` is stable and machine-readable.
 */
export type ProblemDetails = {
  /**
   * URI identifying the problem type
   */
  type: string;
  title: string;
  status: number;
  /**
   * Stable machine code from the shared-kernel error registry
   */
  code: string;
  detail?: string;
  instance?: string;
  /**
   * Field-level validation failures with JSON-pointer paths
   */
  errors?: Array<ProblemFieldError>;
};

export type ProblemFieldError = {
  /**
   * RFC 6901 JSON pointer into the request body
   */
  pointer: string;
  message: string;
  code?: string;
};

export type HealthCheckStatus = 'ok' | 'down';

export type HealthReport = {
  status: 'ok';
  checks: {
    db: HealthCheckStatus;
  };
};

export type VersionInfo = {
  /**
   * Semantic version of the deployed API
   */
  version: string;
  /**
   * Git commit SHA the build was produced from
   */
  commit: string;
  /**
   * RFC 3339 UTC build timestamp
   */
  builtAt: string;
};

export type GetHealthData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/health';
};

export type GetHealthErrors = {
  /**
   * One or more dependencies are down
   */
  503: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetHealthError = GetHealthErrors[keyof GetHealthErrors];

export type GetHealthResponses = {
  /**
   * Health report
   */
  200: HealthReport;
};

export type GetHealthResponse = GetHealthResponses[keyof GetHealthResponses];

export type GetVersionData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/version';
};

export type GetVersionErrors = {
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetVersionError = GetVersionErrors[keyof GetVersionErrors];

export type GetVersionResponses = {
  /**
   * Version information
   */
  200: VersionInfo;
};

export type GetVersionResponse = GetVersionResponses[keyof GetVersionResponses];
