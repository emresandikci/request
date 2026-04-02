// Core
export { HttpClient } from "./core/HttpClient.ts";
export { HttpRequest } from "./core/HttpRequest.ts";
export { HttpResponse } from "./core/HttpResponse.ts";

// Adapters
export type { IHttpAdapter } from "./adapters/IHttpAdapter.ts";
export { AbstractFetchAdapter } from "./adapters/AbstractFetchAdapter.ts";
export { BrowserFetchAdapter } from "./adapters/BrowserFetchAdapter.ts";
export { NodeFetchAdapter } from "./adapters/NodeFetchAdapter.ts";
export { AdapterResolver } from "./adapters/AdapterResolver.ts";
export { RetryAdapter, BackoffStrategy } from "./adapters/RetryAdapter.ts";
export { DedupeAdapter } from "./adapters/DedupeAdapter.ts";
export type { DedupeAdapterOptions } from "./adapters/DedupeAdapter.ts";
export type {
  RetryAdapterOptions,
  RetryCondition,
} from "./adapters/RetryAdapter.ts";
export { CacheAdapter } from "./adapters/CacheAdapter.ts";
export type { CacheAdapterOptions } from "./adapters/CacheAdapter.ts";
export { MemoryCacheStore } from "./adapters/MemoryCacheStore.ts";
export type { MemoryCacheStoreOptions } from "./adapters/MemoryCacheStore.ts";
export type { ICacheStore, CacheEntry } from "./adapters/ICacheStore.ts";

// Interceptors
export { InterceptorManager } from "./interceptors/InterceptorManager.ts";
export type { InterceptorHandler } from "./interceptors/InterceptorManager.ts";

// Utils
export { QuerySerializer } from "./utils/QuerySerializer.ts";
export type {
  QuerySerializerOptions,
  ArrayFormat,
} from "./utils/QuerySerializer.ts";

// Errors
export { HttpError } from "./errors/HttpError.ts";
export { NetworkError } from "./errors/NetworkError.ts";
export { TimeoutError } from "./errors/TimeoutError.ts";

// Types
export { HttpMethod } from "./types/index.ts";
export type {
  HttpMethod as HttpMethodType,
  QueryParamValue,
  QueryParams,
  HttpHeaders,
  RequestConfig,
  HttpClientConfig,
  HttpClientHooks,
  IQuerySerializer,
} from "./types/index.ts";
