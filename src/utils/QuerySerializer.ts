import type {
  IQuerySerializer,
  QueryParamValue,
  QueryParams,
} from "../types/index.ts";

export type ArrayFormat = "repeat" | "comma" | "bracket";

export interface QuerySerializerOptions {
  arrayFormat?: ArrayFormat;
}

export class QuerySerializer implements IQuerySerializer {
  private readonly arrayFormat: ArrayFormat;

  constructor(options?: QuerySerializerOptions) {
    this.arrayFormat = options?.arrayFormat ?? "repeat";
  }

  serialize(params: QueryParams): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;

      const encodedKey = encodeURIComponent(key);

      if (Array.isArray(value)) {
        const items = value.filter(
          (v): v is NonNullable<QueryParamValue> =>
            v !== null && v !== undefined,
        );
        if (items.length === 0) continue;

        switch (this.arrayFormat) {
          case "comma":
            parts.push(
              `${encodedKey}=${items.map((v) => encodeURIComponent(String(v))).join(",")}`,
            );
            break;
          case "bracket":
            for (const v of items) {
              parts.push(`${encodedKey}[]=${encodeURIComponent(String(v))}`);
            }
            break;
          default:
            for (const v of items) {
              parts.push(`${encodedKey}=${encodeURIComponent(String(v))}`);
            }
        }
      } else {
        parts.push(`${encodedKey}=${encodeURIComponent(String(value))}`);
      }
    }

    return parts.join("&");
  }
}
