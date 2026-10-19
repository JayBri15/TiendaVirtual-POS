import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../backend/app.js";
import { createCatalogRepository } from "../backend/catalogRepository.js";

const TEST_ADMIN_CONFIG = {
  email: "owner@example.test",
  password: "a-long-test-password",
  sessionSecret: "test-session-secret-that-is-at-least-32-bytes-long",
};
const sentAccountEmails = [];
const TEST_EMAIL_SENDER = {
  isConfigured: true,
  createAccountLink: (route, token) => `http://localhost:5173/#${route}/${token}`,
  sendVerificationEmail: async (email, link) => {
    sentAccountEmails.push({ type: "verification", email, link });
  },
  sendPasswordResetEmail: async (email, link) => {
    sentAccountEmails.push({ type: "reset", email, link });
  },
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
    emailSender: TEST_EMAIL_SENDER,
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

    it("migra categorías de una base anterior sin perder datos ni productos", () => {
      const databaseDirectory = mkdtempSync(join(tmpdir(), "amway-legacy-catalog-test-"));
      const databasePath = join(databaseDirectory, "legacy.sqlite");
      let repository;
      let legacyDatabase = new DatabaseSync(databasePath);

      try {
        legacyDatabase.exec(`
          PRAGMA foreign_keys = ON;
          CREATE TABLE categories (name TEXT PRIMARY KEY);
          INSERT INTO categories (name) VALUES ('Categoría antigua');
          CREATE TABLE products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
            category TEXT NOT NULL REFERENCES categories(name),
            detail TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            badge TEXT NOT NULL DEFAULT '',
            image TEXT NOT NULL DEFAULT '',
            details_json TEXT NOT NULL
          );
          INSERT INTO products (
            id, name, sku, category, detail, price, stock, details_json
          ) VALUES (
            'legacy-product', 'Producto antiguo', 'OLD-001',
            'Categoría antigua', 'Descripción', 10, 3, '{}'
          );
          CREATE TABLE customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            phone TEXT NOT NULL
          );
          INSERT INTO customers (id, name, email, phone)
          VALUES ('legacy-customer', 'Cliente anterior', 'old@example.test', '555-0100');
          CREATE TABLE customer_credentials (
            customer_id TEXT PRIMARY KEY,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL
          );
          INSERT INTO customer_credentials (customer_id, salt, password_hash)
          VALUES ('legacy-customer', 'c2FsdA', 'aGFzaA');
        `);
        legacyDatabase.close();
        legacyDatabase = null;

        repository = createCatalogRepository(databasePath);
        const catalog = repository.getCatalog();
        assert.deepEqual(catalog.categories, [
          {
            name: "Categoría antigua",
            sortOrder: 1,
            image: "",
            description: "",
          },
        ]);
        assert.equal(catalog.products[0].id, "legacy-product");
        assert.equal(repository.getCustomerAccountByEmail("old@example.test").emailVerified, 0);
      } finally {
        legacyDatabase?.close();
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
    const category = {
      name: "Categoría API",
      sortOrder: 8,
      image: "https://example.test/category.webp",
      description: "Categoría creada por la API.",
    };
    const createdResponse = await fetch(`${apiUrl}/api/categories`, {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(category),
    });
    assert.equal(createdResponse.status, 201);
    assert.deepEqual(await createdResponse.json(), category);
    const originalProduct = repository.getCatalog().products[0];
    assert.equal(repository.updateProduct({ ...originalProduct, category: category.name }), true);

    const renamed = {
      name: "Categoría API Renombrada",
      sortOrder: 1,
      image: "",
      description: "Descripción actualizada.",
    };
    const renameResponse = await fetch(
      `${apiUrl}/api/categories/${encodeURIComponent(category.name)}`,
      {
        method: "PUT",
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(renamed),
      }
    );
    assert.equal(renameResponse.status, 200);
    assert.deepEqual(await renameResponse.json(), renamed);
    assert.equal(repository.getCatalog().products[0].category, renamed.name);

    const listResponse = await fetch(`${apiUrl}/api/categories`);
    assert.equal(listResponse.status, 200);
    const currentCategories = await listResponse.json();
    assert.ok(currentCategories.some((item) => item.name === renamed.name));

    const blockedDeleteResponse = await fetch(
      `${apiUrl}/api/categories/${encodeURIComponent(renamed.name)}`,
      { method: "DELETE", headers: adminHeaders }
    );
    assert.equal(blockedDeleteResponse.status, 409);
    const productAfterRename = repository.getCatalog().products[0];
    repository.updateProduct({ ...productAfterRename, category: originalProduct.category });

    const deleteResponse = await fetch(
      `${apiUrl}/api/categories/${encodeURIComponent(renamed.name)}`,
      {
        method: "DELETE",
        headers: adminHeaders,
      }
    );
    assert.equal(deleteResponse.status, 204);
  });

  it("registra cuentas y pedidos sin reservar stock hasta confirmación de Admin", async () => {
    sentAccountEmails.length = 0;
    const credentials = {
      name: "Cliente de pedidos",
      email: "pedidos@example.test",
      phone: "555-0200",
      password: "CompraSegura#2026",
    };
    const registrationResponse = await fetch(`${apiUrl}/api/account/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    assert.equal(registrationResponse.status, 201);
    assert.equal(registrationResponse.headers.get("set-cookie"), null);
    const { customer, verificationRequired } = await registrationResponse.json();
    assert.equal(verificationRequired, true);
    assert.equal(customer.email, credentials.email);
    assert.equal("password" in customer, false);
    const firstVerificationToken = sentAccountEmails[0].link.split("/").at(-1);

    const unverifiedLogin = await fetch(`${apiUrl}/api/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });
    assert.equal(unverifiedLogin.status, 403);

    const resendVerification = await fetch(`${apiUrl}/api/account/verification/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email }),
    });
    assert.equal(resendVerification.status, 202);
    const verificationToken = sentAccountEmails.at(-1).link.split("/").at(-1);
    assert.notEqual(verificationToken, firstVerificationToken);

    const expiredVerification = await fetch(`${apiUrl}/api/account/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: firstVerificationToken }),
    });
    assert.equal(expiredVerification.status, 400);

    const verifyResponse = await fetch(`${apiUrl}/api/account/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verificationToken }),
    });
    assert.equal(verifyResponse.status, 200);
    assert.match(verifyResponse.headers.get("set-cookie"), /HttpOnly/);
    assert.match(verifyResponse.headers.get("set-cookie"), /SameSite=Strict/);
    assert.match(verifyResponse.headers.get("set-cookie"), /Secure/);
    const customerCookie = verifyResponse.headers.get("set-cookie").split(";")[0];
    assert.deepEqual((await verifyResponse.json()).customer, customer);
    const reusedVerification = await fetch(`${apiUrl}/api/account/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verificationToken }),
    });
    assert.equal(reusedVerification.status, 400);

    const sessionResponse = await fetch(`${apiUrl}/api/account/session`, {
      headers: { Cookie: customerCookie },
    });
    assert.deepEqual(await sessionResponse.json(), { authenticated: true, customer });

    const weakPasswordResponse = await fetch(`${apiUrl}/api/account/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cuenta débil",
        email: "debil@example.test",
        phone: "555-0201",
        password: "short",
      }),
    });
    assert.equal(weakPasswordResponse.status, 400);

    const invalidLoginResponse = await fetch(`${apiUrl}/api/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: "incorrecta" }),
    });
    assert.equal(invalidLoginResponse.status, 401);
    const validLogin = await fetch(`${apiUrl}/api/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });
    assert.equal(validLogin.status, 200);
    assert.ok(validLogin.headers.get("set-cookie"));

    const unauthenticatedOrderResponse = await fetch(`${apiUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: {}, items: [] }),
    });
    assert.equal(unauthenticatedOrderResponse.status, 401);

    const catalogBefore = repository.getCatalog();
    const product = catalogBefore.products[0];
    const address = {
      name: credentials.name,
      street: "123 Calle Principal",
      city: "Ciudad",
      region: "Estado",
      postalCode: "12345",
      phone: credentials.phone,
    };
    const createOrderResponse = await fetch(`${apiUrl}/api/orders`, {
      method: "POST",
      headers: { ...{ Cookie: customerCookie }, "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        items: [{ productId: product.id, quantity: 2, unitPrice: 0.01 }],
      }),
    });
    assert.equal(createOrderResponse.status, 201);
    const order = await createOrderResponse.json();
    assert.equal(order.status, "pending");
    assert.equal(order.total, product.price * 2);
    assert.equal(order.items[0].unitPrice, product.price);
    assert.equal(repository.getCatalog().products[0].stock, product.stock);
    const deletePendingProductResponse = await fetch(`${apiUrl}/api/products/${product.id}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(deletePendingProductResponse.status, 409);

    const protectedOrdersResponse = await fetch(`${apiUrl}/api/admin/orders`);
    assert.equal(protectedOrdersResponse.status, 401);
    const adminOrdersResponse = await fetch(`${apiUrl}/api/admin/orders`, {
      headers: adminHeaders,
    });
    assert.equal(adminOrdersResponse.status, 200);
    assert.ok((await adminOrdersResponse.json()).some((item) => item.id === order.id));

    const confirmResponse = await fetch(`${apiUrl}/api/admin/orders/${order.id}/confirm`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(confirmResponse.status, 200);
    assert.equal((await confirmResponse.json()).order.status, "confirmed");
    assert.equal(repository.getCatalog().products[0].stock, product.stock - 2);

    const cancelConfirmedResponse = await fetch(`${apiUrl}/api/admin/orders/${order.id}/cancel`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(cancelConfirmedResponse.status, 200);
    assert.equal((await cancelConfirmedResponse.json()).order.status, "cancelled");
    assert.equal(repository.getCatalog().products[0].stock, product.stock);

    const pendingOrderResponse = await fetch(`${apiUrl}/api/orders`, {
      method: "POST",
      headers: { Cookie: customerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });
    const pendingOrder = await pendingOrderResponse.json();
    assert.equal(pendingOrderResponse.status, 201);
    const cancelPendingResponse = await fetch(
      `${apiUrl}/api/admin/orders/${pendingOrder.id}/cancel`,
      { method: "POST", headers: adminHeaders }
    );
    assert.equal(cancelPendingResponse.status, 200);
    assert.equal(repository.getCatalog().products[0].stock, product.stock);

    const multiProductOrderResponse = await fetch(`${apiUrl}/api/orders`, {
      method: "POST",
      headers: { Cookie: customerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        items: [
          { productId: product.id, quantity: 1 },
          { productId: catalogBefore.products[1].id, quantity: 1 },
        ],
      }),
    });
    const multiProductOrder = await multiProductOrderResponse.json();
    assert.equal(multiProductOrderResponse.status, 201);
    const secondProduct = repository.getCatalog().products[1];
    repository.updateProduct({ ...secondProduct, stock: 0 });
    const failedConfirmation = await fetch(
      `${apiUrl}/api/admin/orders/${multiProductOrder.id}/confirm`,
      { method: "POST", headers: adminHeaders }
    );
    assert.equal(failedConfirmation.status, 409);
    assert.equal(repository.getCatalog().products[0].stock, product.stock);
    repository.updateProduct(secondProduct);
    await fetch(`${apiUrl}/api/admin/orders/${multiProductOrder.id}/cancel`, {
      method: "POST",
      headers: adminHeaders,
    });

    const resetRequest = await fetch(`${apiUrl}/api/account/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email }),
    });
    assert.equal(resetRequest.status, 202);
    assert.equal(sentAccountEmails.at(-1).type, "reset");
    const resetToken = sentAccountEmails.at(-1).link.split("/").at(-1);
    const unknownResetRequest = await fetch(`${apiUrl}/api/account/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "missing@example.test" }),
    });
    assert.equal(unknownResetRequest.status, 202);
    assert.deepEqual(await unknownResetRequest.json(), await resetRequest.clone().json());

    const resetPassword = await fetch(`${apiUrl}/api/account/password-reset/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: "NuevaSegura#2027" }),
    });
    assert.equal(resetPassword.status, 200);
    assert.equal(resetPassword.headers.get("set-cookie").includes("Max-Age=0"), true);
    const reusedResetToken = await fetch(`${apiUrl}/api/account/password-reset/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: "OtraSegura#2027" }),
    });
    assert.equal(reusedResetToken.status, 400);
    const revokedSession = await fetch(`${apiUrl}/api/account/session`, {
      headers: { Cookie: customerCookie },
    });
    assert.deepEqual(await revokedSession.json(), { authenticated: false, customer: null });
    const oldPasswordLogin = await fetch(`${apiUrl}/api/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });
    assert.equal(oldPasswordLogin.status, 401);
    const newPasswordLogin = await fetch(`${apiUrl}/api/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: "NuevaSegura#2027" }),
    });
    assert.equal(newPasswordLogin.status, 200);

    const logoutResponse = await fetch(`${apiUrl}/api/account/logout`, {
      method: "POST",
      headers: { Cookie: newPasswordLogin.headers.get("set-cookie").split(";")[0] },
    });
    assert.equal(logoutResponse.status, 204);
    const endedSessionResponse = await fetch(`${apiUrl}/api/account/session`, {
      headers: { Cookie: newPasswordLogin.headers.get("set-cookie").split(";")[0] },
    });
    assert.deepEqual(await endedSessionResponse.json(), { authenticated: false, customer: null });
  });

  it("no registra cuentas si el servidor no tiene correo SMTP configurado", async () => {
    const limitedServer = await listen(
      createApp({
        catalogRepository: repository,
        adminConfig: TEST_ADMIN_CONFIG,
        emailSender: { isConfigured: false },
      })
    );
    const { port } = limitedServer.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/account/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Sin correo",
          email: "sin-correo@example.test",
          phone: "555-0300",
          password: "CuentaSegura#2026",
        }),
      });
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /SMTP/);
      assert.equal(repository.getCustomerAccountByEmail("sin-correo@example.test"), undefined);
    } finally {
      await close(limitedServer);
    }
  });

  it("guarda clientes y ventas, actualiza stock de forma transaccional y conserva el historial", async () => {
    const customerResponse = await fetch(`${apiUrl}/api/admin/customers`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cliente de prueba",
        email: "cliente@example.test",
        phone: "555-0100",
      }),
    });
    assert.equal(customerResponse.status, 201);
    let customer = await customerResponse.json();

    const updateCustomerResponse = await fetch(
      `${apiUrl}/api/admin/customers/${encodeURIComponent(customer.id)}`,
      {
        method: "PUT",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Cliente actualizado",
          email: "cliente.updated@example.test",
          phone: "555-0111",
        }),
      }
    );
    assert.equal(updateCustomerResponse.status, 200);
    customer = await updateCustomerResponse.json();

    const duplicateResponse = await fetch(`${apiUrl}/api/admin/customers`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicado",
        email: "CLIENTE.UPDATED@example.test",
        phone: "555-0199",
      }),
    });
    assert.equal(duplicateResponse.status, 400);

    const beforeProduct = repository.getCatalog().products[0];
    const saleResponse = await fetch(`${apiUrl}/api/admin/sales`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        paymentMethod: "Efectivo",
        items: [{ productId: beforeProduct.id, quantity: 2 }],
      }),
    });
    assert.equal(saleResponse.status, 201);
    const { sale } = await saleResponse.json();
    assert.equal(sale.customerName, customer.name);
    assert.equal(sale.items[0].unitPrice, beforeProduct.price);
    assert.equal(sale.total, beforeProduct.price * 2);
    assert.equal(repository.getCatalog().products[0].stock, beforeProduct.stock - 2);

    const beforeInvalidCatalog = repository.getCatalog();
    const beforeInvalidSale = beforeInvalidCatalog.products[0].stock;
    const secondProduct = beforeInvalidCatalog.products[1];
    const insufficientResponse = await fetch(`${apiUrl}/api/admin/sales`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: null,
        paymentMethod: "Efectivo",
        items: [
          { productId: beforeProduct.id, quantity: 1 },
          { productId: secondProduct.id, quantity: secondProduct.stock + 1 },
        ],
      }),
    });
    assert.equal(insufficientResponse.status, 409);
    assert.equal(repository.getCatalog().products[0].stock, beforeInvalidSale);
    assert.equal(repository.getCatalog().products[1].stock, secondProduct.stock);

    const voidResponse = await fetch(`${apiUrl}/api/admin/sales/${sale.id}/void`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(voidResponse.status, 200);
    const voided = await voidResponse.json();
    assert.equal(voided.sale.status, "voided");
    assert.equal(repository.getCatalog().products[0].stock, beforeProduct.stock);

    const duplicateVoidResponse = await fetch(`${apiUrl}/api/admin/sales/${sale.id}/void`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(duplicateVoidResponse.status, 409);

    const deleteCustomerResponse = await fetch(
      `${apiUrl}/api/admin/customers/${encodeURIComponent(customer.id)}`,
      { method: "DELETE", headers: adminHeaders }
    );
    assert.equal(deleteCustomerResponse.status, 204);
    const salesResponse = await fetch(`${apiUrl}/api/admin/sales`, { headers: adminHeaders });
    const sales = await salesResponse.json();
    const savedSale = sales.find((item) => item.id === sale.id);
    assert.equal(savedSale.customerId, null);
    assert.equal(savedSale.customerName, customer.name);
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
      const privateRoutes = await Promise.all([
        fetch(`http://127.0.0.1:${port}/api/admin/customers`),
        fetch(`http://127.0.0.1:${port}/api/admin/sales`),
      ]);
      assert.deepEqual(
        privateRoutes.map((route) => route.status),
        [401, 401]
      );
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
