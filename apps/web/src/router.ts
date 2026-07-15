import { createRouter, createWebHistory } from "vue-router";
import EntityPage from "./features/entity/EntityPage.vue";
import NotFoundPage from "./features/error/NotFoundPage.vue";
import { featureRegistry, kernel } from "./features";

const featureRoutes = kernel.features.map((manifest) => {
  const feature = featureRegistry.get(manifest.id);
  if (!feature)
    throw new Error(`Missing UI adapter for feature ${manifest.id}`);

  return {
    path: manifest.route,
    name: manifest.id,
    component: feature.component,
  };
});

const additionalRoutes = [...featureRegistry.values()].flatMap(
  (feature) => feature.additionalRoutes ?? [],
);
additionalRoutes.push({
  path: "/entities/:entityId",
  name: "entity",
  component: EntityPage,
});
additionalRoutes.push({
  path: "/:pathMatch(.*)*",
  name: "not-found",
  component: NotFoundPage,
});

export const router = createRouter({
  history: createWebHistory(),
  routes: [...featureRoutes, ...additionalRoutes],
  scrollBehavior: () => ({ top: 0 }),
});
