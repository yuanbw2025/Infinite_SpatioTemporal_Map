import { defineFeature } from "@infinite-spacetime/core";
import PeoplePage from "./PeoplePage.vue";

export const peopleFeature = {
  manifest: defineFeature({
    id: "people",
    route: "/people",
    navigation: { label: "人物行迹", order: 40 },
    capabilities: ["people:explore", "knowledge:explore"],
    dependsOn: ["library", "atlas"],
  }),
  component: PeoplePage,
};
