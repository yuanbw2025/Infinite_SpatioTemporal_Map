import { createRouter, createWebHistory } from "vue-router";
import { featureRegistry, kernel } from "./features";

const routes = kernel.features.map((manifest) => {
  const feature = featureRegistry.get(manifest.id);
  if (!feature)
    throw new Error(`Missing UI adapter for feature ${manifest.id}`);

  return {
    path: manifest.route,
    name: manifest.id,
    component: feature.component,
  };
});

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
