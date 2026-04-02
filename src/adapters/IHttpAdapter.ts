import type { HttpRequest } from "../core/HttpRequest.ts";
import type { HttpResponse } from "../core/HttpResponse.ts";

export interface IHttpAdapter {
  send<TRes>(request: HttpRequest<unknown>): Promise<HttpResponse<TRes>>;
}
