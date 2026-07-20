import {
  createApplicationKernel,
  type FeatureModule,
} from "@infinite-spacetime/application";
import type { Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import { atlasFeature } from "./atlas";
import { dataFeature } from "./data";
import { heritageFeature } from "./heritage";
import { graphFeature } from "./graph";
import { libraryFeature } from "./library";
import { peopleFeature } from "./people";
import { readerFeature } from "./reader";
import { researchFeature } from "./research";
import { searchFeature } from "./search";
import { timelineFeature } from "./timeline";

interface RegisteredFeature {
  readonly manifest: FeatureModule;
  readonly component: Component;
  readonly additionalRoutes?: readonly RouteRecordRaw[];
}

const features: readonly RegisteredFeature[] = [
  libraryFeature,
  readerFeature,
  atlasFeature,
  peopleFeature,
  heritageFeature,
  graphFeature,
  timelineFeature,
  researchFeature,
  searchFeature,
  dataFeature,
];

export const kernel = createApplicationKernel(
  features.map((feature) => feature.manifest),
);

export const featureRegistry = new Map(
  features.map((feature) => [feature.manifest.id, feature]),
);
