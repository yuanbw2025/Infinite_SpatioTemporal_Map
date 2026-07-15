import { defineFeature } from "@infinite-spacetime/core";
import AtlasPage from "./AtlasPage.vue";

export const atlasFeature = {
  manifest: defineFeature({
    id: "atlas",
    route: "/atlas",
    navigation: { label: "无限时空", order: 30 },
    capabilities: ["atlas:explore"],
    dependsOn: ["library"],
  }),
  component: AtlasPage,
};
