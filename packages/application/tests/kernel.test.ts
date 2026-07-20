import { describe, expect, it } from "vitest";
import { createApplicationKernel, defineFeature } from "../src";

describe("application kernel", () => {
  it("sorts one feature registry and rejects parallel identities", () => {
    const kernel = createApplicationKernel([
      defineFeature({
        id: "atlas",
        route: "/atlas",
        navigation: { label: "地图", order: 20 },
        capabilities: ["atlas:explore"],
      }),
      defineFeature({
        id: "library",
        route: "/",
        navigation: { label: "书库", order: 10 },
        capabilities: ["catalog:browse"],
      }),
    ]);
    expect(kernel.features.map((feature) => feature.id)).toEqual([
      "library",
      "atlas",
    ]);
    expect(kernel.hasCapability("atlas:explore")).toBe(true);
    expect(() =>
      createApplicationKernel([
        defineFeature({
          id: "same",
          route: "/a",
          navigation: { label: "一", order: 1 },
          capabilities: [],
        }),
        defineFeature({
          id: "same",
          route: "/b",
          navigation: { label: "二", order: 2 },
          capabilities: [],
        }),
      ]),
    ).toThrow("Duplicate feature id");
  });

  it("rejects duplicate routes and missing dependencies", () => {
    expect(() =>
      createApplicationKernel([
        defineFeature({
          id: "one",
          route: "/same",
          navigation: { label: "一", order: 1 },
          capabilities: [],
        }),
        defineFeature({
          id: "two",
          route: "/same",
          navigation: { label: "二", order: 2 },
          capabilities: [],
        }),
      ]),
    ).toThrow("Duplicate feature route");
    expect(() =>
      createApplicationKernel([
        defineFeature({
          id: "dependent",
          route: "/dependent",
          navigation: { label: "依赖", order: 1 },
          capabilities: [],
          dependsOn: ["missing"],
        }),
      ]),
    ).toThrow("depends on missing feature");
  });
});
