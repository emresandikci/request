import type { HttpMethod, HttpHeaders, RequestConfig } from "../types/index.ts";

export class HttpRequest<TBody = unknown> {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: Readonly<HttpHeaders>;
  readonly body: TBody | undefined;
  readonly signal: AbortSignal | undefined;
  readonly config: Readonly<RequestConfig<TBody>>;

  constructor(
    config: RequestConfig<TBody> & { url: string; method: HttpMethod },
  ) {
    this.method = config.method;
    this.url = config.url;
    this.headers = Object.freeze({ ...config.headers });
    this.body = config.body;
    this.signal = config.signal;
    this.config = Object.freeze({ ...config });
  }

  withHeaders(headers: HttpHeaders): HttpRequest<TBody> {
    return new HttpRequest<TBody>({
      ...this.config,
      url: this.url,
      method: this.method,
      headers: { ...this.headers, ...headers },
    });
  }
}
