import { HttpError } from "../errors/HttpError.ts";
import { NetworkError } from "../errors/NetworkError.ts";
import { TimeoutError } from "../errors/TimeoutError.ts";
import type { IHttpAdapter } from "./IHttpAdapter.ts";
import type { HttpRequest } from "../core/HttpRequest.ts";
import type { HttpResponse } from "../core/HttpResponse.ts";

/**
 * Backoff strategy for retry delays.
 * - `'fixed'`: every retry waits exactly `delay` ms.
 * - `'exponential'`: retry N waits `min(delay × 2^(N-1), maxDelay)` ms.
 */
export const BackoffStrategy = {
  fixed: "fixed",
  exponential: "exponential",
} as const;

export type BackoffStrategy =
  (typeof BackoffStrategy)[keyof typeof BackoffStrategy];

/**
 * Called before each retry to determine whether the error warrants another attempt.
 * @param error   The error thrown by the previous attempt.
 * @param request The original `HttpRequest` (unchanged across retries).
 * @param attempt 1-indexed retry count (1 = first retry, 2 = second, …).
 */
export type RetryCondition = (
  error: unknown,
  request: HttpRequest<unknown>,
  attempt: number,
) => boolean;

export interface RetryAdapterOptions {
  /**
   * Maximum number of retry attempts after the initial failure.
   * A value of 3 means up to 4 total attempts.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay between retries in milliseconds.
   * @default 100
   */
  delay?: number;

  /**
   * Delay growth strategy.
   * @default 'exponential'
   */
  backoff?: BackoffStrategy;

  /**
   * Upper bound for computed delay (relevant for exponential backoff).
   * @default 30_000
   */
  maxDelay?: number;

  /**
   * Custom predicate to decide whether a given error is retryable.
   * Default: retry on {@link NetworkError}, {@link TimeoutError},
   * {@link HttpError} with status 429 or ≥ 500.
   */
  retryOn?: RetryCondition;
}

// Default condition — underscore prefixes satisfy noUnusedParameters
const defaultRetryOn = (
  error: unknown,
  // _request: HttpRequest<unknown>,
  // _attempt: number,
): boolean => {
  if (error instanceof NetworkError) return true;
  if (error instanceof TimeoutError) return true;
  if (error instanceof HttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return false;
};

function computeDelay(
  attempt: number,
  base: number,
  strategy: BackoffStrategy,
  maxDelay: number,
): number {
  if (strategy === BackoffStrategy.fixed) return base;
  return Math.min(base * Math.pow(2, attempt - 1), maxDelay);
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Decorator adapter that wraps any {@link IHttpAdapter} and retries failed
 * requests according to a configurable backoff strategy.
 *
 * @example
 * ```typescript
 * const client = new HttpClient(
 *   { baseURL: 'https://api.example.com' },
 *   new RetryAdapter(AdapterResolver.resolve(), {
 *     maxRetries: 3,
 *     backoff: 'exponential',
 *     delay: 200,
 *   }),
 * );
 * ```
 */
export class RetryAdapter implements IHttpAdapter {
  private readonly inner: IHttpAdapter;
  private readonly maxRetries: number;
  private readonly delay: number;
  private readonly backoff: BackoffStrategy;
  private readonly maxDelay: number;
  private readonly retryOn: RetryCondition;

  constructor(inner: IHttpAdapter, options?: RetryAdapterOptions) {
    this.inner = inner;
    this.maxRetries = options?.maxRetries ?? 3;
    this.delay = options?.delay ?? 100;
    this.backoff = options?.backoff ?? BackoffStrategy.exponential;
    this.maxDelay = options?.maxDelay ?? 30_000;
    this.retryOn = options?.retryOn ?? defaultRetryOn;
  }

  async send<TRes>(request: HttpRequest<unknown>): Promise<HttpResponse<TRes>> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.inner.send<TRes>(request);
      } catch (error) {
        lastError = error;

        const retryNumber = attempt + 1; // 1-indexed for the consumer
        if (
          attempt < this.maxRetries &&
          this.retryOn(error, request, retryNumber)
        ) {
          const ms = computeDelay(
            retryNumber,
            this.delay,
            this.backoff,
            this.maxDelay,
          );
          if (ms > 0) await sleep(ms);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }
}
