import { defineFeature } from "@infinite-spacetime/application";
import { defineAsyncComponent } from "vue";

const AtlasPage = defineAsyncComponent(() => import("./AtlasPage.vue"));

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
