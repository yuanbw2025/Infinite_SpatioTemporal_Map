import {
  createApplicationKernel,
  type FeatureModule,
} from "@infinite-spacetime/core";
import type { Component } from "vue";
import { atlasFeature } from "./atlas";
import { heritageFeature } from "./heritage";
import { libraryFeature } from "./library";
import { peopleFeature } from "./people";
import { readerFeature } from "./reader";
import { searchFeature } from "./search";

interface RegisteredFeature {
  readonly manifest: FeatureModule;
  readonly component: Component;
}

const features: readonly RegisteredFeature[] = [
  libraryFeature,
  readerFeature,
  atlasFeature,
  peopleFeature,
  heritageFeature,
  searchFeature,
];

export const kernel = createApplicationKernel(
  features.map((feature) => feature.manifest),
);

export const featureRegistry = new Map(
  features.map((feature) => [feature.manifest.id, feature]),
);
