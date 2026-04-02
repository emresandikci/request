import type { RequestConfig } from "../types/index.ts";

export class TimeoutError extends Error {
  readonly name = "TimeoutError";
  readonly config: RequestConfig;
  readonly timeout: number;

  constructor(config: RequestConfig) {
    const ms = config.timeout ?? 0;
    super(`Request timed out after ${ms}ms`);
    this.config = config;
    this.timeout = ms;
  }
}
