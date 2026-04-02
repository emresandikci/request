import { HttpResponse } from "../core/HttpResponse.ts";
import { NetworkError } from "../errors/NetworkError.ts";
import { TimeoutError } from "../errors/TimeoutError.ts";
import type { IHttpAdapter } from "./IHttpAdapter.ts";
import type { HttpRequest } from "../core/HttpRequest.ts";

export class AbstractFetchAdapter implements IHttpAdapter {
  async send<TRes>(request: HttpRequest<unknown>): Promise<HttpResponse<TRes>> {
    const headers: Record<string, string> = { ...request.headers };
    let body: BodyInit | undefined;

    if (request.body !== undefined) {
      if (
        request.body instanceof FormData ||
        request.body instanceof Blob ||
        request.body instanceof ArrayBuffer ||
        typeof request.body === "string"
      ) {
        body = request.body as BodyInit;
      } else {
        body = JSON.stringify(request.body);
        const hasContentType = Object.keys(headers).some(
          (k) => k.toLowerCase() === "content-type",
        );
        if (!hasContentType) {
          headers["content-type"] = "application/json";
        }
      }
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      signal: request.signal,
      body,
    };

    let nativeResponse: Response;
    try {
      nativeResponse = await globalThis.fetch(request.url, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // AbortSignal.timeout() sets reason to a DOMException with name 'TimeoutError'
        const reason = request.signal?.reason;
        if (reason instanceof DOMException && reason.name === "TimeoutError") {
          throw new TimeoutError(request.config);
        }
        throw new NetworkError("Request was aborted", request.config, error);
      }
      throw new NetworkError(
        error instanceof Error ? error.message : "Network request failed",
        request.config,
        error,
      );
    }

    const validateStatus =
      request.config.validateStatus ?? defaultValidateStatus;
    const ok = validateStatus(nativeResponse.status);

    return new HttpResponse<TRes>(nativeResponse, ok);
  }
}

function defaultValidateStatus(status: number): boolean {
  return status >= 200 && status < 300;
}
