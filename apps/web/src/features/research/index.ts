import { defineFeature } from "@infinite-spacetime/application";
import { defineAsyncComponent } from "vue";

const ResearchPage = defineAsyncComponent(() => import("./ResearchPage.vue"));

export const researchFeature = {
  manifest: defineFeature({
    id: "research",
    route: "/research",
    navigation: { label: "研究工具", order: 80 },
    capabilities: ["research:inspect", "knowledge:explore"],
    dependsOn: ["library"],
  }),
  component: ResearchPage,
};
