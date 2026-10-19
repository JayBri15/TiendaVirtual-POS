import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  CART_KEY,
  DATA_KEY,
  getDefaultCatalog,
  isValidImage,
  isValidProductDetails,
  loadCart,
  normalizeCart,
  readCatalog,
  saveCart,
  saveCatalog,
} from "../src/JS/services/catalogStorage.js";
import { readAdminData } from "../src/JS/services/adminStorage.js";

/** Sustituye Web Storage por un mapa aislado para probar persistencia sin DOM. */
function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe("servicio de catálogo y carrito", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("entrega una copia independiente del catálogo inicial", () => {
    const first = getDefaultCatalog();
    const second = getDefaultCatalog();

    assert.equal(first.products.length, 8);
    assert.equal(first.categories.length, 4);
    first.products[0].price = 1;
    assert.notEqual(first.products[0].price, second.products[0].price);
  });

  it("rechaza imágenes con protocolos ejecutables y permite HTTPS o formatos validados", () => {
    assert.equal(isValidImage("https://example.com/product.webp"), true);
    assert.equal(isValidImage("data:image/png;base64,AAAA"), true);
    assert.equal(isValidImage("javascript:alert(1)"), false);
    assert.equal(isValidImage("data:text/html;base64,AAAA"), false);
  });

  it("valida el detalle editorial y las reseñas configuradas para cada producto", () => {
    const details = {
      description: "Descripción extendida",
      ingredients: "Ingredientes",
      package: "60 tabletas",
      instructions: "Tomar con alimentos",
      benefits: ["Beneficio uno"],
      rating: 4.5,
      reviewCount: 1,
      reviews: [{ author: "Cliente", rating: 5, date: "Hoy", text: "Excelente" }],
    };
    assert.equal(isValidProductDetails(details), true);
    assert.equal(isValidProductDetails({ ...details, rating: 6 }), false);
    assert.equal(isValidProductDetails({ ...details, reviewCount: 0 }), false);
    assert.equal(
      isValidProductDetails({ ...details, reviews: [{ ...details.reviews[0], rating: 0 }] }),
      false
    );
    assert.equal(
      isValidProductDetails({ ...details, recommendedProductIds: ["product-a", "product-a"] }),
      false
    );
  });

  it("consolida líneas repetidas y limita cantidad al inventario vigente", () => {
    const { products } = getDefaultCatalog();
    const cart = normalizeCart(
      [
        { id: products[0].id, quantity: 12 },
        { id: products[0].id, quantity: 20 },
        { id: "removed-product", quantity: 1 },
        { id: products[1].id, quantity: -2 },
      ],
      products
    );

    assert.deepEqual(cart, [{ id: products[0].id, quantity: products[0].stock }]);
  });

  it("persiste productos nuevos y el carrito usando claves compartidas", () => {
    const catalog = getDefaultCatalog();
    catalog.products.push({
      id: "new-product",
      name: "Nuevo producto",
      sku: "NEW-001",
      category: catalog.categories[0],
      detail: "Descripción",
      price: 12,
      stock: 4,
    });
    saveCatalog(catalog);

    const loaded = readCatalog();
    assert.equal(loaded.products.at(-1).id, "new-product");
    assert.equal(localStorage.getItem(DATA_KEY) !== null, true);

    const cart = [{ id: "new-product", quantity: 2 }];
    assert.equal(saveCart(cart), true);
    assert.equal(localStorage.getItem(CART_KEY), JSON.stringify(cart));
    assert.deepEqual(loadCart(loaded.products), cart);
  });

  it("conserva los detalles personalizados en el catálogo público", () => {
    const catalog = getDefaultCatalog();
    catalog.products[0].details = {
      description: "Descripción editable",
      ingredients: "Ingredientes actualizados",
      package: "90 tabletas",
      instructions: "Usar según la etiqueta",
      benefits: ["Beneficio personalizado"],
      rating: 4.2,
      reviewCount: 5,
      reviews: [{ author: "Cliente", rating: 4, date: "Hoy", text: "Buen producto" }],
      recommendedProductIds: [catalog.products[1].id],
    };
    saveCatalog(catalog);

    assert.deepEqual(readCatalog().products[0].details, catalog.products[0].details);
  });

  it("combina el catálogo público con los registros privados validados de Admin", () => {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({
        ...getDefaultCatalog(),
        customers: [{ id: "customer-1", name: "Cliente", email: "a@example.com", phone: "123" }],
        admins: [],
        sales: [],
      })
    );

    const data = readAdminData();
    assert.equal(data.products.length, 8);
    assert.equal(data.customers[0].id, "customer-1");
    assert.equal(data.admins[0].id, "admin-demo");
  });
});
