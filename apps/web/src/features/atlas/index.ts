import { defineFeature } from "@infinite-spacetime/core";
import AtlasPage from "./AtlasPage.vue";

export const atlasFeature = {
  manifest: defineFeature({
    id: "atlas",
    route: "/atlas",
    navigation: { label: "无限时空", order: 30 },
    dependsOn: ["library"],
  }),
  component: AtlasPage,
};
