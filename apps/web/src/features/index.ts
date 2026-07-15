import {
  createApplicationKernel,
  type FeatureModule,
} from "@infinite-spacetime/core";
import type { Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import { atlasFeature } from "./atlas";
import { dataFeature } from "./data";
import { heritageFeature } from "./heritage";
import { libraryFeature } from "./library";
import { peopleFeature } from "./people";
import { readerFeature } from "./reader";
import { searchFeature } from "./search";

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
  searchFeature,
  dataFeature,
];

export const kernel = createApplicationKernel(
  features.map((feature) => feature.manifest),
);

export const featureRegistry = new Map(
  features.map((feature) => [feature.manifest.id, feature]),
);
