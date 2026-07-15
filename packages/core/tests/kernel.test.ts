import { describe, expect, it } from "vitest";
import { createApplicationKernel, defineFeature } from "../src";

describe("application kernel", () => {
  it("sorts all features through one registry", () => {
    const kernel = createApplicationKernel([
      defineFeature({
        id: "atlas",
        route: "/atlas",
        navigation: { label: "无限时空", order: 20 },
      }),
      defineFeature({
        id: "library",
        route: "/",
        navigation: { label: "方志博览", order: 10 },
      }),
    ]);

    expect(kernel.features.map((feature) => feature.id)).toEqual([
      "library",
      "atlas",
    ]);
  });

  it("rejects parallel feature identities", () => {
    expect(() =>
      createApplicationKernel([
        defineFeature({
          id: "reader",
          route: "/reader",
          navigation: { label: "阅读", order: 1 },
        }),
        defineFeature({
          id: "reader",
          route: "/reader-2",
          navigation: { label: "另一个阅读器", order: 2 },
        }),
      ]),
    ).toThrow("Duplicate feature id");
  });
});
