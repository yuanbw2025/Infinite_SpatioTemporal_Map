export interface FeatureNavigation {
  readonly label: string;
  readonly order: number;
}

export type FeatureCapability =
  | "catalog:browse"
  | "text:read"
  | "knowledge:explore"
  | "atlas:explore"
  | "people:explore"
  | "heritage:explore"
  | "search:global"
  | "metadata:inspect";

export interface FeatureModule {
  readonly id: string;
  readonly route: string;
  readonly navigation: FeatureNavigation;
  readonly capabilities: readonly FeatureCapability[];
  readonly dependsOn?: readonly string[];
}

export function defineFeature<const T extends FeatureModule>(feature: T): T {
  return feature;
}
