import { announceAdminDataChange, announceCatalogChange } from "./catalogStorage.js";

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
 * @returns {Promise<import("../models.js").Category[]>} Categorías públicas.
 */
export async function readAdminCategories() {
  const response = await fetch("/api/categories", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const categories = await response.json();
  if (
    !Array.isArray(categories) ||
    categories.some(
      (category) =>
        !category ||
        typeof category.name !== "string" ||
        !Number.isSafeInteger(category.sortOrder) ||
        typeof category.image !== "string" ||
        typeof category.description !== "string"
    )
  ) {
    throw new TypeError("La respuesta de categorías no cumple el formato esperado.");
  }
  return categories;
}

/**
 * Crea una categoría persistida en SQLite desde Admin.
 * @param {import("../models.js").Category} category Registro nuevo.
 * @returns {Promise<import("../models.js").Category>} Registro confirmado por el servidor.
 */
export async function createAdminCategory(category) {
  const response = await fetch("/api/categories", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(category),
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const savedCategory = await response.json();
  if (!savedCategory || typeof savedCategory.name !== "string") {
    throw new TypeError("La respuesta de categoría no cumple el formato esperado.");
  }
  announceCatalogChange();
  return savedCategory;
}

/**
 * Actualiza una categoría y las referencias de producto si cambia su nombre.
 * @param {string} currentName Nombre anterior de la categoría.
 * @param {import("../models.js").Category} category Datos actualizados.
 * @returns {Promise<import("../models.js").Category>} Registro persistido.
 */
export async function updateAdminCategory(currentName, category) {
  const response = await fetch(`/api/categories/${encodeURIComponent(currentName)}`, {
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(category),
  });
  if (!response.ok) throw new Error(await readAdminError(response));

  const savedCategory = await response.json();
  if (!savedCategory || typeof savedCategory.name !== "string") {
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

async function readAdminCollection(path, validate) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));
  const records = await response.json();
  if (!Array.isArray(records) || !records.every(validate)) {
    throw new TypeError(`La respuesta de ${path} no cumple el formato esperado.`);
  }
  return records;
}

const isCustomer = (customer) =>
  customer &&
  typeof customer.id === "string" &&
  typeof customer.name === "string" &&
  typeof customer.email === "string" &&
  typeof customer.phone === "string";

const isSale = (sale) =>
  sale &&
  typeof sale.id === "string" &&
  typeof sale.date === "string" &&
  Number.isFinite(Date.parse(sale.date)) &&
  (sale.customerId === null || typeof sale.customerId === "string") &&
  typeof sale.customerName === "string" &&
  typeof sale.paymentMethod === "string" &&
  Number.isFinite(sale.total) &&
  sale.total >= 0 &&
  ["completed", "voided"].includes(sale.status) &&
  Array.isArray(sale.items) &&
  sale.items.every(
    (item) =>
      item &&
      typeof item.productId === "string" &&
      typeof item.name === "string" &&
      typeof item.sku === "string" &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice >= 0 &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity > 0
  );

const isOrder = (order) =>
  order &&
  typeof order.id === "string" &&
  typeof order.date === "string" &&
  (order.customerId === null || typeof order.customerId === "string") &&
  typeof order.customerName === "string" &&
  order.shippingAddress &&
  typeof order.shippingAddress.name === "string" &&
  typeof order.shippingAddress.street === "string" &&
  Array.isArray(order.items) &&
  order.items.every(
    (item) =>
      item &&
      typeof item.productId === "string" &&
      typeof item.name === "string" &&
      typeof item.sku === "string" &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice >= 0 &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity > 0
  ) &&
  Number.isFinite(order.total) &&
  order.total >= 0 &&
  ["pending", "confirmed", "cancelled"].includes(order.status);

/** Lee los clientes privados desde el backend protegido. */
export function readAdminCustomers() {
  return readAdminCollection("/api/admin/customers", isCustomer);
}

/** Lee el historial de ventas persistido y protegido. */
export function readAdminSales() {
  return readAdminCollection("/api/admin/sales", isSale);
}

/** Lee pedidos y direcciones de entrega desde la ruta protegida de Admin. */
export function readAdminOrders() {
  return readAdminCollection("/api/admin/orders", isOrder);
}

async function writeAdminCustomer(url, method, customer) {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  });
  if (!response.ok) throw new Error(await readAdminError(response));
  const savedCustomer = await response.json();
  if (!isCustomer(savedCustomer)) {
    throw new TypeError("La respuesta del cliente no cumple el formato esperado.");
  }
  announceAdminDataChange();
  return savedCustomer;
}

/** Crea un cliente persistido en SQLite. */
export function createAdminCustomer(customer) {
  return writeAdminCustomer("/api/admin/customers", "POST", customer);
}

/** Actualiza los datos de contacto de un cliente persistido. */
export function updateAdminCustomer(customerId, customer) {
  return writeAdminCustomer(
    `/api/admin/customers/${encodeURIComponent(customerId)}`,
    "PUT",
    customer
  );
}

/** Elimina un cliente sin borrar sus instantáneas de ventas pasadas. */
export async function deleteAdminCustomer(customerId) {
  const response = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));
  announceAdminDataChange();
}

async function readSaleMutation(response) {
  if (!response.ok) throw new Error(await readAdminError(response));
  const result = await response.json();
  if (!result || !isSale(result.sale) || !Array.isArray(result.products)) {
    throw new TypeError("La respuesta de venta no cumple el formato esperado.");
  }
  announceAdminDataChange();
  announceCatalogChange();
  return result;
}

/** Registra una venta y recibe del servidor el stock actualizado. */
export async function createAdminSale(sale) {
  const response = await fetch("/api/admin/sales", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sale),
  });
  return readSaleMutation(response);
}

/** Anula una venta y recibe el inventario que restauró el servidor. */
export async function voidAdminSale(saleId) {
  const response = await fetch(`/api/admin/sales/${encodeURIComponent(saleId)}/void`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });
  return readSaleMutation(response);
}

async function mutateAdminOrder(orderId, action) {
  const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/${action}`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readAdminError(response));
  const result = await response.json();
  if (
    !result ||
    !isOrder(result.order) ||
    !Array.isArray(result.products) ||
    result.products.some((product) => !product || typeof product.id !== "string")
  ) {
    throw new TypeError("La respuesta del pedido no cumple el formato esperado.");
  }
  announceAdminDataChange();
  announceCatalogChange();
  return result;
}

/** Confirma el pedido si el backend puede descontar todas sus existencias. */
export function confirmAdminOrder(orderId) {
  return mutateAdminOrder(orderId, "confirm");
}

/** Cancela un pedido y restaura existencias cuando ya estaba confirmado. */
export function cancelAdminOrder(orderId) {
  return mutateAdminOrder(orderId, "cancel");
}
