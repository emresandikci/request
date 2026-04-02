import type { RequestConfig } from "../types/index.ts";

export class NetworkError extends Error {
  readonly name = "NetworkError";
  readonly config: RequestConfig;

  constructor(message: string, config: RequestConfig, cause?: unknown) {
    super(message, { cause });
    this.config = config;
  }
}
