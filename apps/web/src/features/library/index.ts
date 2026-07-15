import { defineFeature } from "@infinite-spacetime/core";
import LibraryPage from "./LibraryPage.vue";
import WorkPage from "./WorkPage.vue";

export const libraryFeature = {
  manifest: defineFeature({
    id: "library",
    route: "/",
    navigation: { label: "方志博览", order: 10 },
    capabilities: ["catalog:browse"],
  }),
  component: LibraryPage,
  additionalRoutes: [
    {
      path: "/works/:workId",
      name: "work",
      component: WorkPage,
    },
  ],
};
