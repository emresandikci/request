import type { RequestConfig } from "../types/index.ts";
import { sanitizeRequestConfig } from "./sanitizeRequestConfig.ts";

export class TimeoutError extends Error {
  readonly name = "TimeoutError";
  readonly config: RequestConfig;
  readonly timeout: number;

  constructor(config: RequestConfig) {
    const ms = config.timeout ?? 0;
    super(`Request timed out after ${ms}ms`);
    this.config = sanitizeRequestConfig(config);
    this.timeout = ms;
  }
}
