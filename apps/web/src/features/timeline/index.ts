import { defineFeature } from "@infinite-spacetime/application";
import { defineAsyncComponent } from "vue";

const TimelinePage = defineAsyncComponent(() => import("./TimelinePage.vue"));

export const timelineFeature = {
  manifest: defineFeature({
    id: "timeline",
    route: "/timeline",
    navigation: { label: "历史时间线", order: 70 },
    capabilities: ["timeline:explore", "knowledge:explore"],
    dependsOn: ["library"],
  }),
  component: TimelinePage,
};
