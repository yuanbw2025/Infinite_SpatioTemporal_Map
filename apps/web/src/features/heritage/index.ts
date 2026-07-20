import { defineFeature } from "@infinite-spacetime/application";
import HeritagePage from "./HeritagePage.vue";

export const heritageFeature = {
  manifest: defineFeature({
    id: "heritage",
    route: "/heritage",
    navigation: { label: "文博遗产", order: 50 },
    capabilities: ["heritage:explore", "knowledge:explore"],
    dependsOn: ["library"],
  }),
  component: HeritagePage,
};
