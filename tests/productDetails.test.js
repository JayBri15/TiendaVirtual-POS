import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_PRODUCTS } from "../src/JS/data/defaultCatalog.js";
import { getProductDetails, getRecommendedProducts } from "../src/JS/data/productDetails.js";

describe("detalles de fichas de producto", () => {
  it("proporciona información completa y reseñas demo para el catálogo inicial", () => {
    for (const product of DEFAULT_PRODUCTS) {
      const details = getProductDetails(product);

      assert.ok(details.description);
      assert.ok(details.ingredients);
      assert.ok(details.package);
      assert.ok(details.benefits.length);
      assert.ok(details.instructions);
      assert.ok(details.rating >= 0 && details.rating <= 5);
      assert.ok(details.reviewCount >= details.reviews.length);
    }
  });

  it("permite que productos nuevos tengan una ficha sin valoración ni reseñas", () => {
    const details = getProductDetails({
      id: "custom",
      name: "Producto nuevo",
      sku: "CUSTOM-001",
      category: "Novedades",
      detail: "Descripción breve",
      price: 10,
      stock: 3,
    });

    assert.equal(details.rating, 0);
    assert.equal(details.reviewCount, 0);
    assert.deepEqual(details.reviews, []);
    assert.ok(details.instructions);
  });

  it("prioriza la información personalizada guardada para la ficha", () => {
    const product = {
      ...DEFAULT_PRODUCTS[0],
      details: {
        description: "Descripción administrada",
        ingredients: "Ingredientes modificados",
        package: "90 tabletas",
        instructions: "Instrucciones modificadas",
        benefits: ["Beneficio administrado"],
        rating: 4.2,
        reviewCount: 5,
        reviews: [{ author: "Cliente", rating: 4, date: "Hoy", text: "Opinión administrada" }],
      },
    };

    assert.equal(getProductDetails(product), product.details);
  });

  it("usa recomendaciones configuradas y limita las automáticas a cuatro", () => {
    const [product, ...products] = DEFAULT_PRODUCTS;
    const chosen = products.slice(-2).map((item) => item.id);

    assert.deepEqual(
      getRecommendedProducts({ ...product, details: { recommendedProductIds: chosen } }, products),
      products.filter((item) => chosen.includes(item.id))
    );
    assert.equal(getRecommendedProducts(product, DEFAULT_PRODUCTS).length, 4);
    assert.deepEqual(
      getRecommendedProducts({ ...product, details: { recommendedProductIds: [] } }, products),
      []
    );
  });
});
