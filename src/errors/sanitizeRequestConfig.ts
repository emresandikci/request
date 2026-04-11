import type { HttpHeaders, RequestConfig } from "../types/index.ts";

const REDACTED = "[REDACTED]";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);

function sanitizeHeaders(headers?: HttpHeaders): HttpHeaders | undefined {
  if (!headers) return headers;

  const sanitized: HttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = SENSITIVE_HEADERS.has(key.toLowerCase())
      ? REDACTED
      : value;
  }

  return sanitized;
}

export function sanitizeRequestConfig<TBody = unknown>(
  config: RequestConfig<TBody>,
): RequestConfig<TBody> {
  return {
    ...config,
    headers: sanitizeHeaders(config.headers),
  };
}
