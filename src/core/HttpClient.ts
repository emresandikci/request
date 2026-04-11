import type {
  HttpClientConfig,
  HttpClientHooks,
  HttpHeaders,
  HttpMethod,
  RequestConfig,
} from "../types/index.ts";
import { HttpRequest } from "./HttpRequest.ts";
import type { HttpResponse } from "./HttpResponse.ts";
import { InterceptorManager } from "../interceptors/InterceptorManager.ts";
import { HttpError } from "../errors/HttpError.ts";
import { QuerySerializer } from "../utils/QuerySerializer.ts";
import { AdapterResolver } from "../adapters/AdapterResolver.ts";
import type { IHttpAdapter } from "../adapters/IHttpAdapter.ts";

const DEFAULT_VALIDATE_STATUS = (status: number): boolean =>
  status >= 200 && status < 300;
const DEFAULT_QUERY_SERIALIZER = new QuerySerializer();
const ABSOLUTE_SCHEME_RE = /^[a-z][a-z\d+.-]*:/i;
const FORBIDDEN_SCHEME_RE = /^(javascript|data|file|ftp|gopher|blob|mailto):/i;

export class HttpClient {
  private readonly config: HttpClientConfig;
  private readonly adapter: IHttpAdapter;

  readonly interceptors: {
    request: InterceptorManager<RequestConfig>;
    response: InterceptorManager<HttpResponse<unknown>>;
  };

  constructor(config?: HttpClientConfig, adapter?: IHttpAdapter) {
    this.config = config ?? {};
    this.adapter = adapter ?? AdapterResolver.resolve();
    this.interceptors = {
      request: new InterceptorManager<RequestConfig>(),
      response: new InterceptorManager<HttpResponse<unknown>>(),
    };
  }

  create(config?: HttpClientConfig): HttpClient {
    return new HttpClient(
      {
        ...this.config,
        ...config,
        headers: mergeHeaders(this.config.headers, config?.headers),
        hooks: mergeHooks(this.config.hooks, config?.hooks),
      },
      this.adapter,
    );
  }

  async request<TRes = unknown, TBody = unknown>(
    requestConfig: RequestConfig<TBody> & { url: string },
  ): Promise<HttpResponse<TRes>> {
    const hooks = this.config.hooks;

    // --- Phase 1: merge instance config + request config ---
    let merged: RequestConfig<TBody> & { url: string } = {
      validateStatus: DEFAULT_VALIDATE_STATUS,
      ...this.config,
      ...requestConfig,
      headers: mergeHeaders(this.config.headers, requestConfig.headers),
      url: resolveUrl(this.config.baseURL, requestConfig.url),
    };

    try {
      // --- Phase 2: beforeRequest hooks ---
      if (hooks?.beforeRequest) {
        for (const hook of hooks.beforeRequest) {
          const result = await hook(merged);
          if (result !== undefined) {
            merged = {
              ...merged,
              ...(result as RequestConfig<TBody>),
              url: (result as typeof merged).url ?? merged.url,
            };
          }
        }
      }

      // --- Phase 3: request interceptor chain (LIFO) ---
      const requestInterceptors: Array<{
        onFulfilled?: (
          c: RequestConfig,
        ) => RequestConfig | Promise<RequestConfig>;
        onRejected?: (error: unknown) => unknown;
      }> = [];
      this.interceptors.request.forEach((h) => requestInterceptors.unshift(h));

      let configPromise: Promise<RequestConfig<TBody> & { url: string }> =
        Promise.resolve(merged);

      for (const { onFulfilled, onRejected } of requestInterceptors) {
        configPromise = configPromise.then(
          onFulfilled as
            | ((
                c: RequestConfig<TBody> & { url: string },
              ) =>
                | (RequestConfig<TBody> & { url: string })
                | Promise<RequestConfig<TBody> & { url: string }>)
            | undefined,
          onRejected,
        ) as Promise<RequestConfig<TBody> & { url: string }>;
      }

      const finalConfig = await configPromise;

      // --- Phase 4: build URL with query params ---
      const serializer =
        finalConfig.querySerializer ?? DEFAULT_QUERY_SERIALIZER;
      let url = finalConfig.url;
      if (finalConfig.params && hasAnyParam(finalConfig.params)) {
        const qs = serializer.serialize(finalConfig.params);
        if (qs) {
          url = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
        }
      }

      // --- Phase 5: build abort signal (timeout + user signal) ---
      const signals: AbortSignal[] = [];
      if (finalConfig.timeout && finalConfig.timeout > 0) {
        signals.push(AbortSignal.timeout(finalConfig.timeout));
      }
      if (finalConfig.signal) {
        signals.push(finalConfig.signal);
      }
      const signal: AbortSignal | undefined =
        signals.length === 0
          ? undefined
          : signals.length === 1
            ? signals[0]
            : AbortSignal.any(signals);

      // --- Phase 6: build immutable HttpRequest ---
      const httpRequest = new HttpRequest<TBody>({
        ...finalConfig,
        url,
        method: finalConfig.method ?? ("GET" as HttpMethod),
        signal,
      });

      // --- Phase 7: adapter dispatch ---
      const rawResponse = await this.adapter.send<TRes>(httpRequest);

      // --- Phase 8: status validation (feeds into promise chain so response
      //     interceptor onRejected can catch HttpError, e.g. for 401 refresh) ---
      let responsePromise: Promise<HttpResponse<TRes>> = Promise.resolve(
        rawResponse,
      ).then((res) => {
        if (!res.ok) {
          throw new HttpError(
            `Request failed with status ${res.status}`,
            res,
            finalConfig,
          );
        }
        return res;
      });

      // --- Phase 9: afterResponse hooks (FIFO, runs after status passes) ---
      if (hooks?.afterResponse) {
        for (const hook of hooks.afterResponse) {
          responsePromise = responsePromise.then(async (res) => {
            const result = await hook(res, finalConfig);
            return (result as HttpResponse<TRes> | undefined) ?? res;
          });
        }
      }

      // --- Phase 10: response interceptor chain (FIFO) ---
      this.interceptors.response.forEach(({ onFulfilled, onRejected }) => {
        responsePromise = responsePromise.then(
          onFulfilled as
            | ((
                r: HttpResponse<TRes>,
              ) => HttpResponse<TRes> | Promise<HttpResponse<TRes>>)
            | undefined,
          onRejected,
        ) as Promise<HttpResponse<TRes>>;
      });

      // `await` here (not just `return`) ensures the outer try/catch catches
      // any rejection from the response promise chain (HttpError, interceptor errors).
      return await responsePromise;
    } catch (error) {
      // --- beforeError hooks ---
      if (hooks?.beforeError && hooks.beforeError.length > 0) {
        const e = error instanceof Error ? error : new Error(String(error));
        let current: Error = e;
        for (const hook of hooks.beforeError) {
          const result = hook(current, merged);
          if (result instanceof Error) current = result;
        }
        throw current;
      }
      throw error;
    }
  }

  get<TRes = unknown>(
    url: string,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<HttpResponse<TRes>> {
    return this.request<TRes>({ ...config, url, method: "GET" });
  }

  post<TRes = unknown, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: Omit<RequestConfig<TBody>, "method">,
  ): Promise<HttpResponse<TRes>> {
    return this.request<TRes, TBody>({ ...config, url, method: "POST", body });
  }

  put<TRes = unknown, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: Omit<RequestConfig<TBody>, "method">,
  ): Promise<HttpResponse<TRes>> {
    return this.request<TRes, TBody>({ ...config, url, method: "PUT", body });
  }

  patch<TRes = unknown, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: Omit<RequestConfig<TBody>, "method">,
  ): Promise<HttpResponse<TRes>> {
    return this.request<TRes, TBody>({ ...config, url, method: "PATCH", body });
  }

  delete<TRes = unknown>(
    url: string,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<HttpResponse<TRes>> {
    return this.request<TRes>({ ...config, url, method: "DELETE" });
  }

  head(
    url: string,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<HttpResponse<never>> {
    return this.request<never>({ ...config, url, method: "HEAD" });
  }

  options<TRes = unknown>(
    url: string,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<HttpResponse<TRes>> {
    return this.request<TRes>({ ...config, url, method: "OPTIONS" });
  }
}

function mergeHeaders(
  base?: HttpHeaders,
  override?: HttpHeaders,
): HttpHeaders | undefined {
  if (!base && !override) return undefined;
  return { ...base, ...override };
}

function mergeHooks(
  base?: HttpClientHooks,
  override?: HttpClientHooks,
): HttpClientHooks | undefined {
  if (!base && !override) return undefined;

  const beforeRequest = mergeHookList(
    base?.beforeRequest,
    override?.beforeRequest,
  );
  const afterResponse = mergeHookList(
    base?.afterResponse,
    override?.afterResponse,
  );
  const beforeError = mergeHookList(base?.beforeError, override?.beforeError);

  return {
    ...(beforeRequest ? { beforeRequest } : {}),
    ...(afterResponse ? { afterResponse } : {}),
    ...(beforeError ? { beforeError } : {}),
  };
}

function resolveUrl(baseURL?: string, path?: string): string {
  if (!path) return baseURL ?? "";
  if (FORBIDDEN_SCHEME_RE.test(path)) {
    throw new TypeError(`Forbidden URL scheme in path: ${path}`);
  }
  if (ABSOLUTE_SCHEME_RE.test(path)) {
    if (/^https?:\/\//i.test(path)) return path;
    throw new TypeError(`Unsupported URL scheme in path: ${path}`);
  }
  if (!baseURL) return path;
  return `${baseURL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function hasAnyParam(params: Record<string, unknown>): boolean {
  for (const _key in params) {
    return true;
  }
  return false;
}

function mergeHookList<T>(base?: T[], override?: T[]): T[] | undefined {
  if (!base?.length && !override?.length) return undefined;
  return [...(base ?? []), ...(override ?? [])];
}
