import type {
  DataContext,
  GeometryId,
  HistoricalMapResource,
  HistoricalMapResourceCatalog,
  SourceId,
} from "@infinite-spacetime/contracts";
import type { HistoricalMapResourcePort } from "@infinite-spacetime/ports";

export class HistoricalMapResourceValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new URL(value, "https://local.invalid");
    return true;
  } catch {
    return false;
  }
}

function validateResource(
  value: unknown,
  sourceIds: ReadonlySet<string>,
  geometryIds: ReadonlySet<string>,
): asserts value is HistoricalMapResource {
  if (!isRecord(value))
    throw new HistoricalMapResourceValidationError("资源必须是对象");
  if (
    typeof value.id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.id) ||
    typeof value.title !== "string" ||
    !value.title.trim()
  )
    throw new HistoricalMapResourceValidationError("资源 ID 或标题无效");
  if (
    typeof value.defaultOpacity !== "number" ||
    value.defaultOpacity < 0 ||
    value.defaultOpacity > 1 ||
    typeof value.isDefault !== "boolean"
  )
    throw new HistoricalMapResourceValidationError(
      `资源 ${value.id} 的透明度或默认状态无效`,
    );
  if (
    value.sourceId !== undefined &&
    (typeof value.sourceId !== "string" || !sourceIds.has(value.sourceId))
  )
    throw new HistoricalMapResourceValidationError(
      `资源 ${value.id} 引用了不存在的 SourceRecord`,
    );
  if (value.kind === "raster_map") {
    if (
      !Array.isArray(value.tiles) ||
      !value.tiles.length ||
      !value.tiles.every(validUrl)
    )
      throw new HistoricalMapResourceValidationError(
        `栅格资源 ${value.id} 缺少有效瓦片地址`,
      );
    if (!value.sourceId)
      throw new HistoricalMapResourceValidationError(
        `栅格资源 ${value.id} 必须引用 SourceRecord`,
      );
    return;
  }
  if (
    value.kind === "boundary_geojson" &&
    validUrl(value.dataUrl) &&
    Array.isArray(value.geometryIds) &&
    value.geometryIds.length > 0 &&
    value.geometryIds.every(
      (geometryId) =>
        typeof geometryId === "string" && geometryIds.has(geometryId),
    )
  )
    return;
  throw new HistoricalMapResourceValidationError(
    `资源 ${value.id} 的类型或地址无效`,
  );
}

function parseCatalog(
  value: unknown,
  context: DataContext,
  sourceIds: readonly SourceId[],
  geometryIds: readonly GeometryId[],
): HistoricalMapResourceCatalog {
  if (!isRecord(value))
    throw new HistoricalMapResourceValidationError("地图资源目录必须是对象");
  if (
    value.version !== 1 ||
    value.publicationId !== context.publicationId ||
    value.contentChecksum !== context.contentChecksum
  )
    throw new HistoricalMapResourceValidationError(
      "地图资源目录与当前发布包版本不一致",
    );
  if (
    typeof value.generatedAt !== "string" ||
    typeof value.toolVersion !== "string" ||
    !Array.isArray(value.resources)
  )
    throw new HistoricalMapResourceValidationError("地图资源目录字段不完整");
  const knownSources = new Set<string>(sourceIds);
  const knownGeometries = new Set<string>(geometryIds);
  value.resources.forEach((resource) =>
    validateResource(resource, knownSources, knownGeometries),
  );
  const ids = value.resources.map((resource) => resource.id);
  if (new Set(ids).size !== ids.length)
    throw new HistoricalMapResourceValidationError("地图资源 ID 重复");
  return value as unknown as HistoricalMapResourceCatalog;
}

export function createStaticHistoricalMapResourceAdapter(
  value: unknown,
  context: DataContext,
  sourceIds: readonly SourceId[],
  geometryIds: readonly GeometryId[],
): HistoricalMapResourcePort {
  const catalog = parseCatalog(value, context, sourceIds, geometryIds);
  return {
    catalog,
    list: async () => catalog.resources,
  };
}
