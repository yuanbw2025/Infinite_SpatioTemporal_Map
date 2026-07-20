import { describe, expect, it, vi } from "vitest";
import { createIiifPresentationImageAdapter, resolveIiifCanvas } from "../src";

describe("IIIF Presentation image adapter", () => {
  it("resolves a Presentation 3 canvas", () => {
    expect(
      resolveIiifCanvas(
        {
          id: "https://example.org/canvas/1",
          width: 1200,
          height: 1800,
          items: [
            {
              items: [
                {
                  body: {
                    id: "https://example.org/image/1.jpg",
                    type: "Image",
                  },
                },
              ],
            },
          ],
        },
        "https://example.org/canvas/1",
      ),
    ).toEqual({
      imageUrl: "https://example.org/image/1.jpg",
      canvasUrl: "https://example.org/canvas/1",
      width: 1200,
      height: 1800,
      source: "iiif",
    });
  });

  it("resolves Presentation 2 resources and Image API services", () => {
    expect(
      resolveIiifCanvas(
        {
          images: [
            {
              resource: {
                "@id": "https://example.org/full.jpg",
                width: 900,
                height: 1200,
              },
            },
          ],
        },
        "https://example.org/canvas/2",
      )?.imageUrl,
    ).toBe("https://example.org/full.jpg");
    expect(
      resolveIiifCanvas(
        {
          items: [
            {
              items: [
                {
                  body: {
                    service: [{ id: "https://example.org/iiif/image-1/" }],
                  },
                },
              ],
            },
          ],
        },
        "https://example.org/canvas/3",
      )?.imageUrl,
    ).toBe("https://example.org/iiif/image-1/full/max/0/default.jpg");
  });

  it("rejects unsafe resources, caches canvases, and reports HTTP failures", async () => {
    expect(
      resolveIiifCanvas(null, "https://example.org/canvas"),
    ).toBeUndefined();
    expect(
      resolveIiifCanvas(
        { items: [{ items: [{ body: { id: "file:///private/image.jpg" } }] }] },
        "https://example.org/canvas",
      ),
    ).toBeUndefined();
    expect(
      resolveIiifCanvas(
        { items: [{ items: [{ body: { service: { id: "not a URL" } } }] }] },
        "https://example.org/canvas",
      ),
    ).toBeUndefined();

    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            items: [{ body: { id: "https://example.org/image.jpg" } }],
          },
        ],
      }),
    }));
    const adapter = createIiifPresentationImageAdapter(fetcher);
    await expect(
      adapter.resolveCanvas("file:///private/canvas"),
    ).resolves.toBeUndefined();
    await expect(
      adapter.resolveCanvas("not a URL"),
    ).resolves.toBeUndefined();
    await expect(
      adapter.resolveCanvas("https://example.org/canvas"),
    ).resolves.toMatchObject({
      imageUrl: "https://example.org/image.jpg",
      source: "iiif",
    });
    await adapter.resolveCanvas("https://example.org/canvas");
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.org/canvas",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);

    const failing = createIiifPresentationImageAdapter(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await expect(
      failing.resolveCanvas("https://example.org/canvas"),
    ).rejects.toThrow("503");
  });
});
