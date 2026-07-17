import { describe, expect, it } from "vitest";
import { createApplicationKernel, defineFeature } from "../src";

describe("application kernel", () => {
  it("sorts all features through one registry", () => {
    const kernel = createApplicationKernel([
      defineFeature({
        id: "atlas",
        route: "/atlas",
        navigation: { label: "无限时空", order: 20 },
        capabilities: ["atlas:explore"],
      }),
      defineFeature({
        id: "library",
        route: "/",
        navigation: { label: "方志博览", order: 10 },
        capabilities: ["catalog:browse"],
      }),
    ]);

    expect(kernel.features.map((feature) => feature.id)).toEqual([
      "library",
      "atlas",
    ]);
    expect(kernel.hasCapability("atlas:explore")).toBe(true);
    expect(kernel.hasCapability("research:inspect")).toBe(false);
  });

  it("rejects parallel feature identities", () => {
    expect(() =>
      createApplicationKernel([
        defineFeature({
          id: "reader",
          route: "/reader",
          navigation: { label: "阅读", order: 1 },
          capabilities: ["text:read"],
        }),
        defineFeature({
          id: "reader",
          route: "/reader-2",
          navigation: { label: "另一个阅读器", order: 2 },
          capabilities: ["text:read"],
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
