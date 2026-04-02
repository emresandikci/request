import type { HttpResponse } from "../core/HttpResponse.ts";

export const HttpMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
  HEAD: "HEAD",
  OPTIONS: "OPTIONS",
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;
export type HttpHeaders = Record<string, string>;

export interface IQuerySerializer {
  serialize(params: QueryParams): string;
}

export interface RequestConfig<TBody = unknown> {
  url?: string;
  method?: HttpMethod;
  headers?: HttpHeaders;
  params?: QueryParams;
  body?: TBody;
  timeout?: number;
  signal?: AbortSignal;
  validateStatus?: (status: number) => boolean;
  querySerializer?: IQuerySerializer;
}

/**
 * Lifecycle hooks that run at fixed points in the request pipeline.
 * Unlike interceptors, hooks are set at instance creation time and cannot be ejected.
 * `void` return means the original value is preserved; returning a value replaces it.
 */
export interface HttpClientHooks {
  /**
   * Runs after config merge, before the request interceptor chain.
   * Return a modified config to replace it, or `void` to leave it unchanged.
   */
  beforeRequest?: Array<
    (
      config: RequestConfig,
    ) => RequestConfig | void | Promise<RequestConfig | void>
  >;
  /**
   * Runs after status validation passes, before the response interceptor chain.
   * Return a modified response to replace it, or `void` to leave it unchanged.
   */
  afterResponse?: Array<
    (
      response: HttpResponse<unknown>,
      config: RequestConfig,
    ) => HttpResponse<unknown> | void | Promise<HttpResponse<unknown> | void>
  >;
  /**
   * Runs for any error thrown during the pipeline (network, timeout, HTTP status).
   * Return a replacement `Error` to throw instead, or `void` to re-throw the original.
   */
  beforeError?: Array<(error: Error, config: RequestConfig) => Error | void>;
}

export interface HttpClientConfig extends Omit<RequestConfig, "body"> {
  baseURL?: string;
  hooks?: HttpClientHooks;
}
