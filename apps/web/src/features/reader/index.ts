import { defineFeature } from "@infinite-spacetime/core";
import ReaderPage from "./ReaderPage.vue";

export const readerFeature = {
  manifest: defineFeature({
    id: "reader",
    route: "/reader",
    navigation: { label: "方志精读", order: 20 },
    capabilities: ["text:read", "knowledge:explore"],
    dependsOn: ["library"],
  }),
  component: ReaderPage,
};
