import type { FeatureModule } from "./feature-module";

export interface ApplicationKernel {
  readonly features: readonly FeatureModule[];
}

export function createApplicationKernel(
  features: readonly FeatureModule[],
): ApplicationKernel {
  const byId = new Map<string, FeatureModule>();
  const routes = new Set<string>();

  for (const feature of features) {
    if (byId.has(feature.id)) {
      throw new Error(`Duplicate feature id: ${feature.id}`);
    }
    if (routes.has(feature.route)) {
      throw new Error(`Duplicate feature route: ${feature.route}`);
    }
    byId.set(feature.id, feature);
    routes.add(feature.route);
  }

  for (const feature of features) {
    for (const dependency of feature.dependsOn ?? []) {
      if (!byId.has(dependency)) {
        throw new Error(
          `Feature ${feature.id} depends on missing feature ${dependency}`,
        );
      }
    }
  }

  return {
    features: [...features].sort(
      (left, right) => left.navigation.order - right.navigation.order,
    ),
  };
}
