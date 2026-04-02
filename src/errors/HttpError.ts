import type { HttpResponse } from "../core/HttpResponse.ts";
import type { RequestConfig } from "../types/index.ts";

export class HttpError<TRes = unknown, TReq = unknown> extends Error {
  readonly name = "HttpError";
  readonly response: HttpResponse<TRes>;
  readonly config: RequestConfig<TReq>;
  readonly status: number;

  constructor(
    message: string,
    response: HttpResponse<TRes>,
    config: RequestConfig<TReq>,
  ) {
    super(message);
    this.response = response;
    this.config = config;
    this.status = response.status;
  }
}
