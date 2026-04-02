import type { IHttpAdapter } from "./IHttpAdapter.ts";
import { BrowserFetchAdapter } from "./BrowserFetchAdapter.ts";
import { NodeFetchAdapter } from "./NodeFetchAdapter.ts";

export class AdapterResolver {
  static resolve(): IHttpAdapter {
    if (
      typeof window !== "undefined" &&
      typeof window.document !== "undefined"
    ) {
      return new BrowserFetchAdapter();
    }
    return new NodeFetchAdapter();
  }

  static resolveWith(adapter: IHttpAdapter): IHttpAdapter {
    return adapter;
  }
}
