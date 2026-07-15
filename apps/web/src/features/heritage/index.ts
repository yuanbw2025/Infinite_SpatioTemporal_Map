import { defineFeature } from "@infinite-spacetime/core";
import HeritagePage from "./HeritagePage.vue";

export const heritageFeature = {
  manifest: defineFeature({
    id: "heritage",
    route: "/heritage",
    navigation: { label: "文博遗产", order: 40 },
    dependsOn: ["library"],
  }),
  component: HeritagePage,
};
