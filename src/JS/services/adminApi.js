import { announceCatalogChange } from "./catalogStorage.js";

async function readAdminError(response) {
  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error(`El servidor devolvió una respuesta inválida (${response.status}).`, {
      cause: error,
    });
  }
  return typeof result.error === "string" ? result.error : "No se pudo completar la solicitud.";
}

/**
 * Comprueba en el backend si esta pestaña tiene una sesión de administrador.
 * @returns {Promise<boolean>} Si la cookie de sesión vigente fue aceptada.
 */
export async function readAdminSession() {
  const response = await fetch("/api/admin/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const result = await response.json();
  if (typeof result.authenticated !== "boolean") {
    throw new TypeError("La respuesta de sesión no cumple el formato esperado.");
  }
  return result.authenticated;
}

/**
 * Envía las credenciales al backend; el navegador recibe una cookie HttpOnly.
 * @param {string} email Correo configurado en el servidor.
 * @param {string} password Contraseña configurada en el servidor.
 */
export async function loginAdmin(email, password) {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await readAdminError(response));
}

/** Cierra la sesión en el backend y elimina la cookie protegida. */
export async function logoutAdmin() {
  const response = await fetch("/api/admin/logout", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));
}

async function requestProduct(url, method, product) {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const savedProduct = await response.json();
  if (!savedProduct || typeof savedProduct.id !== "string") {
    throw new TypeError("La respuesta del producto no cumple el formato esperado.");
  }
  return savedProduct;
}

/**
 * Crea un producto usando la sesión que guarda el navegador en la cookie.
 * @param {import("../models.js").Product} product Producto que se creará.
 * @returns {Promise<import("../models.js").Product>} Registro guardado por el servidor.
 */
export async function createAdminProduct(product) {
  const savedProduct = await requestProduct("/api/products", "POST", product);
  announceCatalogChange();
  return savedProduct;
}

/**
 * Actualiza un producto existente en SQLite.
 * @param {string} productId Identificador estable del producto.
 * @param {import("../models.js").Product} product Campos nuevos del producto.
 * @returns {Promise<import("../models.js").Product>} Registro actualizado por el servidor.
 */
export async function updateAdminProduct(productId, product) {
  const savedProduct = await requestProduct(
    `/api/products/${encodeURIComponent(productId)}`,
    "PUT",
    product
  );
  announceCatalogChange();
  return savedProduct;
}

/**
 * Elimina un producto persistido en el backend.
 * @param {string} productId Identificador estable del producto.
 */
export async function deleteAdminProduct(productId) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));
  announceCatalogChange();
}

/**
 * Lee la lista pública de categorías del backend.
 * @returns {Promise<string[]>} Nombres válidos del catálogo.
 */
export async function readAdminCategories() {
  const response = await fetch("/api/categories", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const categories = await response.json();
  if (!Array.isArray(categories) || categories.some((category) => typeof category !== "string")) {
    throw new TypeError("La respuesta de categorías no cumple el formato esperado.");
  }
  return categories;
}

/**
 * Crea una categoría persistida en SQLite desde Admin.
 * @param {string} name Nombre nuevo de la categoría.
 * @returns {Promise<string>} Nombre confirmado por el servidor.
 */
export async function createAdminCategory(name) {
  const response = await fetch("/api/categories", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const savedCategory = await response.json();
  if (typeof savedCategory !== "string") {
    throw new TypeError("La respuesta de categoría no cumple el formato esperado.");
  }
  announceCatalogChange();
  return savedCategory;
}

/**
 * Renombra una categoría y actualiza los productos asociados.
 * @param {string} currentName Nombre anterior de la categoría.
 * @param {string} nextName Nombre nuevo que reemplaza la categoría.
 * @returns {Promise<string>} Nombre persistido con el cambio.
 */
export async function updateAdminCategory(currentName, nextName) {
  const response = await fetch(`/api/categories/${encodeURIComponent(currentName)}`, {
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nextName }),
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const savedCategory = await response.json();
  if (typeof savedCategory !== "string") {
    throw new TypeError("La respuesta de categoría no cumple el formato esperado.");
  }
  announceCatalogChange();
  return savedCategory;
}

/**
 * Elimina una categoría del catálogo si aún no tiene productos asignados.
 * @param {string} name Nombre de la categoría a borrar.
 */
export async function deleteAdminCategory(name) {
  const response = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));
  announceCatalogChange();
}
