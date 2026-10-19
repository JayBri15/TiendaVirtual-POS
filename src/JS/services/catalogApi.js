import { isValidCatalog } from "./catalogStorage.js";

/**
 * Lee y valida el catálogo público servido por el backend.
 * @returns {Promise<import("../models.js").Catalog>} Catálogo persistido en SQLite.
 */
export async function fetchPublicCatalog() {
  const response = await fetch("/api/products", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`El servidor respondió con el estado ${response.status}.`);
  }

  const catalog = await response.json();
  if (!isValidCatalog(catalog)) {
    throw new TypeError("El catálogo recibido no cumple el modelo esperado.");
  }
  return catalog;
}
