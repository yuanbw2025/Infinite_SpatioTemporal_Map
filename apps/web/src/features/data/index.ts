import { defineFeature } from "@infinite-spacetime/application";
import DataPage from "./DataPage.vue";

export const dataFeature = {
  manifest: defineFeature({
    id: "data",
    route: "/data",
    navigation: { label: "数据说明", order: 100 },
    capabilities: ["metadata:inspect"],
  }),
  component: DataPage,
};
