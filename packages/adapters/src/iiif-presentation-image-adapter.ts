import type { FacsimileImageResource } from "@infinite-spacetime/contracts";
import type { FacsimileImagePort } from "@infinite-spacetime/ports";

interface JsonResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type IiifFetch = (
  input: string,
  init: { readonly headers: Readonly<Record<string, string>> },
) => Promise<JsonResponse>;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function firstRecord(value: unknown): JsonRecord | undefined {
  return Array.isArray(value) ? record(value[0]) : record(value);
}

function identifier(value: JsonRecord | undefined): string | undefined {
  const id = value?.id ?? value?.["@id"];
  return typeof id === "string" ? id : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function webUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function imageService(service: JsonRecord | undefined):
  | {
      readonly id: string;
      readonly infoUrl: string;
      readonly imageUrl: string;
    }
  | undefined {
  const id = identifier(service);
  if (!id) return undefined;
  const base = webUrl(id)?.replace(/\/$/, "");
  return base
    ? {
        id: base,
        infoUrl: `${base}/info.json`,
        imageUrl: `${base}/full/max/0/default.jpg`,
      }
    : undefined;
}

export function resolveIiifCanvas(
  value: unknown,
  canvasUrl: string,
): FacsimileImageResource | undefined {
  const canvas = record(value);
  if (!canvas) return undefined;

  const annotationPage = firstRecord(canvas.items);
  const annotation = firstRecord(annotationPage?.items);
  const v3Body = firstRecord(annotation?.body);
  const v2Image = firstRecord(canvas.images);
  const v2Body = record(v2Image?.resource);
  const body = v3Body ?? v2Body;
  const direct = identifier(body);
  const service = firstRecord(body?.service);
  const resolvedService = imageService(service);
  const imageUrl =
    (direct ? webUrl(direct) : undefined) ?? resolvedService?.imageUrl;
  if (!imageUrl) return undefined;

  const width = positiveNumber(body?.width) ?? positiveNumber(canvas.width);
  const height = positiveNumber(body?.height) ?? positiveNumber(canvas.height);
  return {
    imageUrl,
    canvasUrl,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(resolvedService
      ? {
          imageService: {
            id: resolvedService.id,
            infoUrl: resolvedService.infoUrl,
          },
        }
      : {}),
    source: "iiif",
  };
}

export function createIiifPresentationImageAdapter(
  fetcher: IiifFetch,
): FacsimileImagePort {
  const requests = new Map<
    string,
    Promise<FacsimileImageResource | undefined>
  >();

  return {
    resolveCanvas(canvasUrl) {
      const safeCanvasUrl = webUrl(canvasUrl);
      if (!safeCanvasUrl) return Promise.resolve(undefined);

      const pending = requests.get(safeCanvasUrl);
      if (pending) return pending;

      const request = (async () => {
        try {
          const response = await fetcher(safeCanvasUrl, {
            headers: {
              accept:
                'application/ld+json;profile="http://iiif.io/api/presentation/3/context.json", application/json',
            },
          });
          if (!response.ok)
            throw new Error(`IIIF canvas request failed (${response.status})`);
          return resolveIiifCanvas(await response.json(), safeCanvasUrl);
        } catch (error) {
          requests.delete(safeCanvasUrl);
          throw error;
        }
      })();
      requests.set(safeCanvasUrl, request);
      return request;
    },
  };
}
