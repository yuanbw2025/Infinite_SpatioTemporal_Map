import { defineFeature } from "@infinite-spacetime/core";
import { defineAsyncComponent } from "vue";

const GraphPage = defineAsyncComponent(() => import("./GraphPage.vue"));

export const graphFeature = {
  manifest: defineFeature({
    id: "graph",
    route: "/graph",
    navigation: { label: "知识图谱", order: 60 },
    capabilities: ["graph:explore", "knowledge:explore"],
    dependsOn: ["library"],
  }),
  component: GraphPage,
};
