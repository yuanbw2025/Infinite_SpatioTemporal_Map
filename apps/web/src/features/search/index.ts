import { defineFeature } from "@infinite-spacetime/application";
import SearchPage from "./SearchPage.vue";

export const searchFeature = {
  manifest: defineFeature({
    id: "search",
    route: "/search",
    navigation: { label: "全库检索", order: 90 },
    capabilities: ["search:global"],
    dependsOn: ["library"],
  }),
  component: SearchPage,
};
