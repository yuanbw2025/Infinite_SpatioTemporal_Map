import { defineFeature } from "@infinite-spacetime/application";
import SocietyPage from "./SocietyPage.vue";

export const societyFeature = {
  manifest: defineFeature({
    id: "society",
    route: "/society",
    navigation: { label: "地方社会", order: 45 },
    capabilities: ["society:explore", "knowledge:explore"],
    dependsOn: ["library", "atlas"],
  }),
  component: SocietyPage,
};
