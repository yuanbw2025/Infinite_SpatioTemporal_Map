import { defineFeature } from "@infinite-spacetime/application";
import LibraryPage from "./LibraryPage.vue";
import WorkPage from "./WorkPage.vue";
import CompareEditionsPage from "./CompareEditionsPage.vue";
import SourcePage from "./SourcePage.vue";

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
      path: "/sources/:sourceId",
      name: "source",
      component: SourcePage,
    },
    {
      path: "/works/:workId/compare",
      name: "edition-compare",
      component: CompareEditionsPage,
    },
    {
      path: "/works/:workId",
      name: "work",
      component: WorkPage,
    },
  ],
};
