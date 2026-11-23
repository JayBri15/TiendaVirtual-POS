import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createCustomerOrder,
  loginCustomer,
  logoutCustomer,
  readCustomerAddresses,
  readCustomerSession,
  requestCustomerPasswordReset,
  registerCustomer,
  resendCustomerVerification,
  resetCustomerPassword,
  verifyCustomerEmail,
} from "../src/JS/services/customerApi.js";
import { EPS_LOCATIONS } from "../shared/epsLocations.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("API de cuentas de cliente", () => {
  it("usa las rutas del backend para sesión, registro, acceso y salida", async () => {
    const requests = [];
    const customer = {
      id: "customer-1",
      name: "Cliente",
      email: "cliente@example.test",
      phone: "555-0100",
    };
    globalThis.fetch = async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith("/session")) {
        return { ok: true, json: async () => ({ authenticated: true, customer }) };
      }
      if (url.endsWith("/addresses")) {
        return {
          ok: true,
          json: async () => ({
            primary: {
              name: customer.name,
              street: "Calle Principal",
              city: "Santo Domingo",
              region: "Distrito Nacional",
              municipality: "Santo Domingo de Guzmán",
              sector: "Zona Colonial",
              postalCode: "10210",
              phone: customer.phone,
            },
            alternate: null,
          }),
        };
      }
      if (url.endsWith("/logout")) return { ok: true };
      if (url.endsWith("/verification/resend") || url.endsWith("/password-reset/request")) {
        return { ok: true, json: async () => ({ message: "Correo enviado." }) };
      }
      if (url.endsWith("/verify-email")) return { ok: true, json: async () => ({ customer }) };
      if (url.endsWith("/password-reset/complete")) {
        return { ok: true, json: async () => ({ passwordReset: true }) };
      }
      if (url.endsWith("/register")) {
        return {
          ok: true,
          json: async () => ({ customer, verificationRequired: true }),
        };
      }
      return { ok: true, json: async () => ({ customer }) };
    };

    assert.deepEqual(await readCustomerSession(), customer);
    assert.equal((await readCustomerAddresses()).alternate, null);
    assert.deepEqual(await loginCustomer(customer.email, "CompraSegura#2026"), customer);
    assert.deepEqual(await registerCustomer({ ...customer, password: "CompraSegura#2026" }), {
      customer,
      verificationRequired: true,
    });
    assert.deepEqual(await verifyCustomerEmail("a".repeat(43)), customer);
    assert.equal(await resendCustomerVerification(customer.email), "Correo enviado.");
    assert.equal(await requestCustomerPasswordReset(customer.email), "Correo enviado.");
    await resetCustomerPassword("b".repeat(43), "NuevaSegura#2027");
    await logoutCustomer();

    assert.deepEqual(
      requests.map(({ url, options }) => [url, options.method || "GET", options.credentials]),
      [
        ["/api/account/session", "GET", "same-origin"],
        ["/api/account/addresses", "GET", "same-origin"],
        ["/api/account/login", "POST", "same-origin"],
        ["/api/account/register", "POST", "same-origin"],
        ["/api/account/verify-email", "POST", "same-origin"],
        ["/api/account/verification/resend", "POST", "same-origin"],
        ["/api/account/password-reset/request", "POST", "same-origin"],
        ["/api/account/password-reset/complete", "POST", "same-origin"],
        ["/api/account/logout", "POST", "same-origin"],
      ]
    );
    assert.deepEqual(JSON.parse(requests[3].options.body), {
      ...customer,
      password: "CompraSegura#2026",
    });
  });

  it("envía dirección y cantidades sin precios para crear un pedido", async () => {
    const requests = [];
    const order = {
      id: "order-1",
      date: "2026-10-19T12:00:00.000Z",
      customerId: "customer-1",
      customerName: "Cliente",
      shippingAddress: {
        name: "Cliente",
        street: "123 Calle",
        city: "Santo Domingo",
        region: "Distrito Nacional",
        municipality: "Santo Domingo de Guzmán",
        sector: "Zona Colonial",
        postalCode: "10210",
        phone: "555-0100",
      },
      items: [
        {
          productId: "product-1",
          name: "Producto",
          sku: "SKU-1",
          unitPrice: 12,
          quantity: 2,
        },
      ],
      subtotal: 24,
      shippingCost: 3,
      deliveryZone: { id: "zone-1", name: "Zona 1" },
      total: 27,
      status: "pending",
    };
    globalThis.fetch = async (url, options = {}) => {
      requests.push({ url, options });
      return { ok: true, json: async () => order };
    };
    const request = {
      address: {
        name: "Cliente",
        street: "123 Calle",
        city: "Santo Domingo",
        region: "Distrito Nacional",
        municipality: "Santo Domingo de Guzmán",
        sector: "Zona Colonial",
        postalCode: "10210",
        phone: "555-0100",
      },
      items: [{ productId: "product-1", quantity: 2 }],
    };

    assert.deepEqual(await createCustomerOrder(request), order);
    assert.equal(requests[0].url, "/api/orders");
    assert.equal(requests[0].options.credentials, "same-origin");
    assert.deepEqual(JSON.parse(requests[0].options.body), request);
  });

  it("envía y valida pedidos para retirar en una sucursal EPS", async () => {
    const location = EPS_LOCATIONS[0];
    const order = {
      id: "order-eps",
      date: "2026-10-19T12:00:00.000Z",
      customerId: "customer-1",
      customerName: "Cliente",
      shippingAddress: {
        name: "Cliente",
        street: location.address,
        city: location.city,
        region: location.region,
        municipality: "",
        sector: "",
        postalCode: "",
        phone: "555-0100",
        deliveryMethod: "eps",
        epsLocation: location,
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
      subtotal: 12,
      shippingCost: 2.49,
      deliveryZone: null,
      total: 14.49,
      status: "pending",
    };
    const request = {
      address: { name: "Cliente", phone: "555-0100" },
      deliveryMethod: "eps",
      epsLocationId: location.id,
      items: [{ productId: "product-1", quantity: 1 }],
    };
    globalThis.fetch = async (_url, options = {}) => {
      assert.deepEqual(JSON.parse(options.body), request);
      return { ok: true, json: async () => order };
    };

    assert.deepEqual(await createCustomerOrder(request), order);
  });
});
