import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createAdminProduct,
  deleteAdminProduct,
  updateAdminProduct,
} from "../src/JS/services/adminApi.js";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

describe("API de productos de Admin", () => {
  it("envía altas, cambios y eliminaciones a las rutas protegidas", async () => {
    const requests = [];
    globalThis.localStorage = { setItem: () => {} };
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => ({ id: "server-product-id" }),
      };
    };
    const product = { id: "client-id", name: "Producto" };

    const created = await createAdminProduct(product);
    const updated = await updateAdminProduct("id con/espacio", product);
    await deleteAdminProduct("server-product-id");

    assert.equal(created.id, "server-product-id");
    assert.equal(updated.id, "server-product-id");
    assert.deepEqual(
      requests.map(({ url, options }) => [url, options.method, options.credentials]),
      [
        ["/api/products", "POST", "same-origin"],
        ["/api/products/id%20con%2Fespacio", "PUT", "same-origin"],
        ["/api/products/server-product-id", "DELETE", "same-origin"],
      ]
    );
    assert.deepEqual(JSON.parse(requests[0].options.body), product);
    assert.deepEqual(JSON.parse(requests[1].options.body), product);
  });
});
