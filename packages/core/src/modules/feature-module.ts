export interface FeatureNavigation {
  readonly label: string;
  readonly order: number;
}

export interface FeatureModule {
  readonly id: string;
  readonly route: string;
  readonly navigation: FeatureNavigation;
  readonly dependsOn?: readonly string[];
}

export function defineFeature<const T extends FeatureModule>(feature: T): T {
  return feature;
}
