export class HttpResponse<TData = unknown> {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly ok: boolean;
  readonly url: string;
  readonly raw: Response;

  constructor(raw: Response, ok: boolean) {
    this.raw = raw;
    this.status = raw.status;
    this.statusText = raw.statusText;
    this.ok = ok;
    this.url = raw.url;

    const headers: Record<string, string> = {};
    raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    this.headers = Object.freeze(headers);
  }

  json(): Promise<TData> {
    return this.raw.json() as Promise<TData>;
  }

  text(): Promise<string> {
    return this.raw.text();
  }

  blob(): Promise<Blob> {
    return this.raw.blob();
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return this.raw.arrayBuffer();
  }
}
