import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchPublicCatalog } from "../src/JS/services/catalogApi.js";
import { getDefaultCatalog } from "../src/JS/services/catalogStorage.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("API pública del catálogo", () => {
  it("lee y valida el catálogo del backend", async () => {
    const expectedCatalog = getDefaultCatalog();
    let requestedUrl;

    globalThis.fetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => expectedCatalog,
      };
    };

    const catalog = await fetchPublicCatalog();

    assert.equal(requestedUrl, "/api/products");
    assert.deepEqual(catalog, expectedCatalog);
  });

  it("explica un error HTTP del backend sin devolver datos de ejemplo", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
    });

    await assert.rejects(fetchPublicCatalog(), /estado 503/);
  });

  it("rechaza respuestas que no cumplen el modelo del catálogo", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ products: [], categories: [123] }),
    });

    await assert.rejects(fetchPublicCatalog(), /modelo esperado/);
  });
});
