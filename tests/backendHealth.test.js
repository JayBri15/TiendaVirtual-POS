import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../backend/app.js";
import { createCatalogRepository } from "../backend/catalogRepository.js";

const TEST_ADMIN_CONFIG = {
  email: "owner@example.test",
  password: "a-long-test-password",
  sessionSecret: "test-session-secret-that-is-at-least-32-bytes-long",
};
let adminHeaders;

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("API inicial", () => {
  let server;
  let apiUrl;
  const repository = createCatalogRepository(":memory:");
  const app = createApp({
    catalogRepository: repository,
    adminConfig: TEST_ADMIN_CONFIG,
    secureCookies: true,
  });

  before(async () => {
    server = await listen(app);
    const { port } = server.address();
    apiUrl = `http://127.0.0.1:${port}`;
    const loginResponse = await fetch(`${apiUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TEST_ADMIN_CONFIG),
    });
    assert.equal(loginResponse.status, 200);
    const sessionCookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
    assert.ok(sessionCookie);
    adminHeaders = { Cookie: sessionCookie };
  });

  after(async () => {
    if (server) {
      await close(server);
    }
    repository.close();
  });

  it("valida el acceso, protege la cookie y revoca la sesión al salir", async () => {
    const invalidLogin = await fetch(`${apiUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_ADMIN_CONFIG.email, password: "incorrecta" }),
    });
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLogin.headers.get("set-cookie"), null);

    const loginResponse = await fetch(`${apiUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TEST_ADMIN_CONFIG),
    });
    const cookie = loginResponse.headers.get("set-cookie");
    assert.equal(loginResponse.status, 200);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Max-Age=28800/);
    assert.match(cookie, /Secure/);

    const sessionCookie = cookie.split(";")[0];
    const sessionResponse = await fetch(`${apiUrl}/api/admin/session`, {
      headers: { Cookie: sessionCookie },
    });
    assert.deepEqual(await sessionResponse.json(), { authenticated: true });

    const logoutResponse = await fetch(`${apiUrl}/api/admin/logout`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    assert.equal(logoutResponse.status, 204);
    const endedSession = await fetch(`${apiUrl}/api/admin/session`, {
      headers: { Cookie: sessionCookie },
    });
    assert.deepEqual(await endedSession.json(), { authenticated: false });
  });

  it("responde al chequeo de salud con un estado legible", async () => {
    const response = await fetch(`${apiUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), {
      status: "ok",
      message: "Backend disponible",
    });
  });

  describe("repositorio SQLite", () => {
    it("guarda el catálogo inicial en el archivo y lo recupera al reabrirlo", () => {
      const databaseDirectory = mkdtempSync(join(tmpdir(), "amway-catalog-test-"));
      const databasePath = join(databaseDirectory, "catalog.sqlite");
      let repository;

      try {
        repository = createCatalogRepository(databasePath);
        const originalCatalog = repository.getCatalog();
        const updatedProduct = {
          ...originalCatalog.products[0],
          name: "Producto persistente",
          price: 33,
        };
        assert.equal(repository.updateProduct(updatedProduct), true);
        repository.createProduct({
          ...originalCatalog.products[0],
          id: "product-persisted-test",
          name: "Producto persistente nuevo",
          sku: "PERSISTED-001",
        });
        repository.close();

        repository = createCatalogRepository(databasePath);
        const reopenedCatalog = repository.getCatalog();
        assert.equal(reopenedCatalog.products[0].name, "Producto persistente");
        assert.equal(reopenedCatalog.products[0].price, 33);
        assert.equal(reopenedCatalog.products.length, 9);
        assert.equal(reopenedCatalog.products.at(-1).id, "product-persisted-test");
        assert.deepEqual(
          reopenedCatalog.products.slice(1, originalCatalog.products.length),
          originalCatalog.products.slice(1)
        );
      } finally {
        repository?.close();
        rmSync(databaseDirectory, { recursive: true, force: true });
      }
    });
  });

  it("expone el catálogo inicial con sus fichas y categorías", async () => {
    const response = await fetch(`${apiUrl}/api/products`);
    const catalog = await response.json();

    assert.equal(response.status, 200);
    assert.equal(catalog.products.length, 8);
    assert.equal(catalog.categories.length, 4);
    assert.ok(catalog.products[0].details.ingredients);
    assert.ok(Array.isArray(catalog.products[0].details.reviews));
  });

  it("administra las categorías desde la API protegida", async () => {
    const categoryName = "Categoría API";
    const createdResponse = await fetch(`${apiUrl}/api/categories`, {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: categoryName }),
    });
    assert.equal(createdResponse.status, 201);
    assert.equal(await createdResponse.json(), categoryName);

    const renamed = "Categoría API Renombrada";
    const renameResponse = await fetch(
      `${apiUrl}/api/categories/${encodeURIComponent(categoryName)}`,
      {
        method: "PUT",
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: renamed }),
      }
    );
    assert.equal(renameResponse.status, 200);
    assert.equal(await renameResponse.json(), renamed);

    const listResponse = await fetch(`${apiUrl}/api/categories`);
    assert.equal(listResponse.status, 200);
    const currentCategories = await listResponse.json();
    assert.ok(currentCategories.includes(renamed));

    const deleteResponse = await fetch(`${apiUrl}/api/categories/${encodeURIComponent(renamed)}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(deleteResponse.status, 204);
  });

  it("bloquea las ediciones si falta la sesión de administrador", async () => {
    const original = repository.getCatalog().products[0];
    const updateServer = await listen(
      createApp({ catalogRepository: repository, adminConfig: TEST_ADMIN_CONFIG })
    );
    const { port } = updateServer.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/products/${original.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...original, name: "Cambio no autorizado" }),
      });
      assert.equal(response.status, 401);
      assert.equal(repository.getCatalog().products[0].name, original.name);
    } finally {
      await close(updateServer);
    }
  });

  it("mantiene deshabilitadas las ediciones si no se configura una clave", async () => {
    const original = repository.getCatalog().products[0];
    const disabledServer = await listen(
      createApp({
        catalogRepository: repository,
        adminConfig: { email: "", password: "", sessionSecret: "" },
      })
    );
    const { port } = disabledServer.address();
    try {
      const loginResponse = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(TEST_ADMIN_CONFIG),
      });
      const response = await fetch(`http://127.0.0.1:${port}/api/products/${original.id}`, {
        method: "PUT",
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...original, name: "Cambio sin configurar" }),
      });
      assert.equal(loginResponse.status, 503);
      assert.equal(response.status, 503);
      assert.equal(repository.getCatalog().products[0].name, original.name);
    } finally {
      await close(disabledServer);
    }
  });

  it("limita los intentos repetidos de inicio de sesión", async () => {
    const limitedServer = await listen(
      createApp({ catalogRepository: repository, adminConfig: TEST_ADMIN_CONFIG })
    );
    const { port } = limitedServer.address();
    const loginUrl = `http://127.0.0.1:${port}/api/admin/login`;

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: TEST_ADMIN_CONFIG.email, password: "incorrecta" }),
        });
        assert.equal(response.status, 401);
      }
      const blockedResponse = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(TEST_ADMIN_CONFIG),
      });
      assert.equal(blockedResponse.status, 429);
      assert.ok(Number(blockedResponse.headers.get("retry-after")) > 0);
    } finally {
      await close(limitedServer);
    }
  });

  it("rechaza valores inválidos y conserva el registro original", async () => {
    const original = repository.getCatalog().products[0];
    const response = await fetch(`${apiUrl}/api/products/${original.id}`, {
      method: "PUT",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...original, price: 0 }),
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.match(result.error, /precio/i);
    assert.equal(repository.getCatalog().products[0].price, original.price);
  });

  it("actualiza un producto válido y lo devuelve desde la API", async () => {
    const original = repository.getCatalog().products[0];
    const update = {
      ...original,
      price: 31.25,
      stock: 12,
      details: {
        ...original.details,
        description: "Descripción actualizada por la API.",
        recommendedProductIds: [repository.getCatalog().products[1].id],
      },
    };
    const response = await fetch(`${apiUrl}/api/products/${original.id}`, {
      method: "PUT",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(update),
    });
    const updatedProduct = await response.json();
    const catalogResponse = await fetch(`${apiUrl}/api/products`);
    const updatedCatalog = await catalogResponse.json();

    assert.equal(response.status, 200);
    assert.equal(updatedProduct.price, 31.25);
    assert.equal(updatedProduct.stock, 12);
    assert.equal(
      updatedCatalog.products[0].details.description,
      "Descripción actualizada por la API."
    );
    assert.deepEqual(updatedCatalog.products[0].details.recommendedProductIds, [
      repository.getCatalog().products[1].id,
    ]);
  });

  it("crea productos y devuelve el identificador asignado por el servidor", async () => {
    const original = repository.getCatalog().products[0];
    const newProduct = {
      ...original,
      name: "Producto creado por API",
      sku: "API-NEW-001",
      price: 19.5,
      stock: 7,
    };
    delete newProduct.id;
    const response = await fetch(`${apiUrl}/api/products`, {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newProduct),
    });
    const createdProduct = await response.json();
    const catalog = repository.getCatalog();

    assert.equal(response.status, 201);
    assert.match(createdProduct.id, /^product-/);
    assert.equal(createdProduct.name, "Producto creado por API");
    assert.equal(catalog.products.length, 9);
    assert.equal(catalog.products.at(-1).id, createdProduct.id);
  });

  it("rechaza la creación cuando el SKU ya está en uso", async () => {
    const original = repository.getCatalog().products[0];
    const response = await fetch(`${apiUrl}/api/products`, {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...original, name: "SKU repetido" }),
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.match(result.error, /SKU/i);
  });

  it("elimina un producto, exige la clave y limpia sus recomendaciones", async () => {
    const catalog = repository.getCatalog();
    const original = catalog.products[0];
    const recommendedProduct = {
      ...catalog.products[1],
      name: "Producto temporal para eliminar",
      sku: "API-DELETE-001",
    };
    delete recommendedProduct.id;

    const createResponse = await fetch(`${apiUrl}/api/products`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(recommendedProduct),
    });
    const createdProduct = await createResponse.json();
    assert.equal(createResponse.status, 201);

    const updateResponse = await fetch(`${apiUrl}/api/products/${original.id}`, {
      method: "PUT",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...original,
        details: {
          ...original.details,
          recommendedProductIds: [createdProduct.id],
        },
      }),
    });
    assert.equal(updateResponse.status, 200);

    const unauthorizedResponse = await fetch(`${apiUrl}/api/products/${createdProduct.id}`, {
      method: "DELETE",
    });
    assert.equal(unauthorizedResponse.status, 401);
    assert.ok(repository.getCatalog().products.some((product) => product.id === createdProduct.id));

    const deleteResponse = await fetch(`${apiUrl}/api/products/${createdProduct.id}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const updatedCatalog = repository.getCatalog();

    assert.equal(deleteResponse.status, 204);
    assert.ok(!updatedCatalog.products.some((product) => product.id === createdProduct.id));
    assert.deepEqual(updatedCatalog.products[0].details.recommendedProductIds, []);

    const missingResponse = await fetch(`${apiUrl}/api/products/${createdProduct.id}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(missingResponse.status, 404);
  });
});
