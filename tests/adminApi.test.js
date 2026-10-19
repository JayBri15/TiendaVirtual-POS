import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createAdminCustomer,
  createAdminSale,
  cancelAdminOrder,
  confirmAdminOrder,
  createAdminProduct,
  deleteAdminCustomer,
  deleteAdminProduct,
  readAdminCustomers,
  readAdminOrders,
  readAdminSales,
  updateAdminProduct,
  updateAdminCustomer,
  voidAdminSale,
} from "../src/JS/services/adminApi.js";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

describe("API de Admin", () => {
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

  it("lee y persiste clientes y ventas usando las rutas protegidas", async () => {
    const requests = [];
    globalThis.localStorage = { setItem: () => {} };
    const customer = {
      id: "customer-1",
      name: "Cliente",
      email: "cliente@example.test",
      phone: "555-0100",
    };
    const sale = {
      id: "sale-1",
      date: "2026-10-19T12:00:00.000Z",
      customerId: customer.id,
      customerName: customer.name,
      paymentMethod: "Efectivo",
      items: [],
      total: 12,
      status: "completed",
    };
    globalThis.fetch = async (url, options = {}) => {
      requests.push({ url, options });
      if (options.method === "DELETE") return { ok: true };
      if (url === "/api/admin/customers" && !options.method) {
        return { ok: true, json: async () => [customer] };
      }
      if (url === "/api/admin/sales" && !options.method) {
        return { ok: true, json: async () => [sale] };
      }
      if (url === "/api/admin/sales" || url.endsWith("/void")) {
        return {
          ok: true,
          json: async () => ({
            sale: url.endsWith("/void") ? { ...sale, status: "voided" } : sale,
            products: [],
          }),
        };
      }
      return { ok: true, json: async () => customer };
    };

    assert.deepEqual(await readAdminCustomers(), [customer]);
    assert.deepEqual(await readAdminSales(), [sale]);
    assert.deepEqual(await createAdminCustomer(customer), customer);
    assert.deepEqual(await updateAdminCustomer(customer.id, customer), customer);
    await deleteAdminCustomer(customer.id);
    const createdSale = await createAdminSale({
      customerId: customer.id,
      paymentMethod: "Efectivo",
      items: [{ productId: "product-1", quantity: 1 }],
    });
    const voidedSale = await voidAdminSale(sale.id);

    assert.equal(createdSale.sale.status, "completed");
    assert.equal(voidedSale.sale.status, "voided");
    assert.deepEqual(
      requests.map(({ url, options }) => [url, options.method || "GET", options.credentials]),
      [
        ["/api/admin/customers", "GET", "same-origin"],
        ["/api/admin/sales", "GET", "same-origin"],
        ["/api/admin/customers", "POST", "same-origin"],
        ["/api/admin/customers/customer-1", "PUT", "same-origin"],
        ["/api/admin/customers/customer-1", "DELETE", "same-origin"],
        ["/api/admin/sales", "POST", "same-origin"],
        ["/api/admin/sales/sale-1/void", "POST", "same-origin"],
      ]
    );
  });

  it("lee pedidos y comunica confirmación o cancelación al backend", async () => {
    const requests = [];
    globalThis.localStorage = { setItem: () => {} };
    const order = {
      id: "order-1",
      date: "2026-10-19T12:00:00.000Z",
      customerId: "customer-1",
      customerName: "Cliente",
      shippingAddress: {
        name: "Cliente",
        street: "123 Calle",
        city: "Ciudad",
        region: "Estado",
        postalCode: "12345",
        phone: "555-0100",
      },
      items: [
        {
          productId: "product-1",
          name: "Producto",
          sku: "SKU-1",
          unitPrice: 12,
          quantity: 1,
        },
      ],
      total: 12,
      status: "pending",
    };
    globalThis.fetch = async (url, options = {}) => {
      requests.push({ url, options });
      if (url === "/api/admin/orders") return { ok: true, json: async () => [order] };
      const status = url.endsWith("/confirm") ? "confirmed" : "cancelled";
      return {
        ok: true,
        json: async () => ({
          order: { ...order, status },
          products: [{ id: "product-1" }],
        }),
      };
    };

    assert.deepEqual(await readAdminOrders(), [order]);
    assert.equal((await confirmAdminOrder(order.id)).order.status, "confirmed");
    assert.equal((await cancelAdminOrder(order.id)).order.status, "cancelled");
    assert.deepEqual(
      requests.map(({ url, options }) => [url, options.method || "GET", options.credentials]),
      [
        ["/api/admin/orders", "GET", "same-origin"],
        ["/api/admin/orders/order-1/confirm", "POST", "same-origin"],
        ["/api/admin/orders/order-1/cancel", "POST", "same-origin"],
      ]
    );
  });
});
