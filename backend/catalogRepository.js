import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from "../src/JS/data/defaultCatalog.js";
import { getProductDetails } from "../src/JS/data/productDetails.js";

const backendDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = join(backendDirectory, "data", "store.sqlite");

/**
 * Fallo de una operación por una condición actual del inventario o del modelo.
 */
export class StoreOperationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StoreOperationError";
    this.code = code;
  }
}

/**
 * Crea las tablas y carga los datos demo solo si todavía no hay productos.
 * @param {string} databasePath Ruta del archivo SQLite; usa ":memory:" en pruebas.
 * @returns {{
 *   getCatalog: () => import("../src/JS/models.js").Catalog,
 *   createProduct: (product: import("../src/JS/models.js").Product) => void,
 *   updateProduct: (product: import("../src/JS/models.js").Product) => boolean,
 *   deleteProduct: (productId: string) => boolean,
 *   createCategory: (category: import("../src/JS/models.js").Category) => boolean,
 *   updateCategory: (currentName: string, category: import("../src/JS/models.js").Category) => boolean,
 *   deleteCategory: (categoryName: string) => boolean,
 *   getAdminData: () => {customers: import("../src/JS/models.js").Customer[], sales: import("../src/JS/models.js").Sale[]},
 *   createCustomer: (customer: import("../src/JS/models.js").Customer) => void,
 *   updateCustomer: (customer: import("../src/JS/models.js").Customer) => boolean,
 *   deleteCustomer: (customerId: string) => boolean,
 *   createCustomerAccount: (customer: import("../src/JS/models.js").Customer, credentials: {salt: string, passwordHash: string}) => void,
 *   getCustomerAccountByEmail: (email: string) => ({id: string, name: string, email: string, phone: string, salt: string, passwordHash: string, emailVerified: number}|undefined),
 *   getCustomerById: (customerId: string) => (import("../src/JS/models.js").Customer|undefined),
 *   isCustomerEmailVerified: (customerId: string) => boolean,
 *   createAccountToken: (customerId: string, purpose: "verify-email"|"reset-password", tokenHash: string, expiresAt: number) => void,
 *   verifyCustomerEmail: (tokenHash: string, now: number) => (import("../src/JS/models.js").Customer|null),
 *   resetCustomerPassword: (tokenHash: string, credentials: {salt: string, passwordHash: string}, now: number) => (import("../src/JS/models.js").Customer|null),
 *   createSale: (request: {customerId: string|null, paymentMethod: string, items: Array<{productId: string, quantity: number}>}) => import("../src/JS/models.js").Sale,
 *   voidSale: (saleId: string) => import("../src/JS/models.js").Sale,
 *   createOrder: (customerId: string, request: {address: object, items: Array<{productId: string, quantity: number}>}) => import("../src/JS/models.js").Order,
 *   getOrders: () => import("../src/JS/models.js").Order[],
 *   confirmOrder: (orderId: string) => import("../src/JS/models.js").Order,
 *   cancelOrder: (orderId: string) => import("../src/JS/models.js").Order,
 *   hasActiveFulfillmentForProduct: (productId: string) => boolean,
 *   close: () => void
 * }}
 */
export function createCatalogRepository(databasePath = defaultDatabasePath) {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
      category TEXT NOT NULL REFERENCES categories(name),
      detail TEXT NOT NULL,
      price REAL NOT NULL CHECK (price > 0),
      stock INTEGER NOT NULL CHECK (stock >= 0),
      badge TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_credentials (
      customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS customer_account_tokens (
      token_hash TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose IN ('verify-email', 'reset-password')),
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL,
      total REAL NOT NULL CHECK (total >= 0),
      status TEXT NOT NULL CHECK (status IN ('completed', 'voided')),
      voided_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (sale_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      street TEXT NOT NULL,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      phone TEXT NOT NULL,
      total REAL NOT NULL CHECK (total >= 0),
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
      stock_deducted INTEGER NOT NULL DEFAULT 0 CHECK (stock_deducted IN (0, 1)),
      confirmed_at TEXT,
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (order_id, product_id)
    );
  `);

  migrateCategoryColumns(database);
  migrateCustomerCredentialColumns(database);
  const productCount = database.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (productCount === 0) seedCatalog(database);

  return {
    getCatalog: () => readCatalog(database),
    createProduct: (product) => createProduct(database, product),
    updateProduct: (product) => updateProduct(database, product),
    deleteProduct: (productId) => deleteProduct(database, productId),
    createCategory: (category) => createCategory(database, category),
    updateCategory: (currentName, category) => updateCategory(database, currentName, category),
    deleteCategory: (categoryName) => deleteCategory(database, categoryName),
    getAdminData: () => readAdminData(database),
    createCustomer: (customer) => createCustomer(database, customer),
    updateCustomer: (customer) => updateCustomer(database, customer),
    deleteCustomer: (customerId) => deleteCustomer(database, customerId),
    createCustomerAccount: (customer, credentials) =>
      createCustomerAccount(database, customer, credentials),
    getCustomerAccountByEmail: (email) => getCustomerAccountByEmail(database, email),
    getCustomerById: (customerId) => getCustomerById(database, customerId),
    isCustomerEmailVerified: (customerId) => isCustomerEmailVerified(database, customerId),
    createAccountToken: (customerId, purpose, tokenHash, expiresAt) =>
      createAccountToken(database, customerId, purpose, tokenHash, expiresAt),
    verifyCustomerEmail: (tokenHash, now) => verifyCustomerEmail(database, tokenHash, now),
    resetCustomerPassword: (tokenHash, credentials, now) =>
      resetCustomerPassword(database, tokenHash, credentials, now),
    createSale: (sale) => createSale(database, sale),
    voidSale: (saleId) => voidSale(database, saleId),
    createOrder: (customerId, order) => createOrder(database, customerId, order),
    getOrders: () => readOrders(database),
    confirmOrder: (orderId) => confirmOrder(database, orderId),
    cancelOrder: (orderId) => cancelOrder(database, orderId),
    hasActiveFulfillmentForProduct: (productId) =>
      hasActiveFulfillmentForProduct(database, productId),
    close: () => database.close(),
  };
}

/**
 * Amplía la tabla de categorías al abrir una base anterior sin perder sus filas.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 */
function migrateCategoryColumns(database) {
  const columns = new Set(
    database
      .prepare("PRAGMA table_info(categories)")
      .all()
      .map((item) => item.name)
  );
  if (!columns.has("sort_order")) {
    database.exec("ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    const categories = database.prepare("SELECT name FROM categories ORDER BY rowid").all();
    const setOrder = database.prepare("UPDATE categories SET sort_order = ? WHERE name = ?");
    categories.forEach((category, index) => setOrder.run(index + 1, category.name));
  }
  if (!columns.has("image")) {
    database.exec("ALTER TABLE categories ADD COLUMN image TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("description")) {
    database.exec("ALTER TABLE categories ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
}

/**
 * Añade el estado de verificación cuando se abre una base con cuentas más antiguas.
 */
function migrateCustomerCredentialColumns(database) {
  const columns = new Set(
    database
      .prepare("PRAGMA table_info(customer_credentials)")
      .all()
      .map((column) => column.name)
  );
  if (!columns.has("email_verified")) {
    database.exec(
      "ALTER TABLE customer_credentials ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1))"
    );
  }
}

/**
 * Inserta un producto que ya pasó las validaciones de la API.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {import("../src/JS/models.js").Product} product Producto validado.
 */
function createProduct(database, product) {
  database
    .prepare(
      `
      INSERT INTO products (
        id, name, sku, category, detail, price, stock, badge, image, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      product.id,
      product.name,
      product.sku,
      product.category,
      product.detail,
      product.price,
      product.stock,
      product.badge,
      product.image,
      JSON.stringify(product.details)
    );
}

/**
 * Actualiza los campos y detalles JSON del producto en una sola consulta SQL.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {import("../src/JS/models.js").Product} product Cambios de producto validados.
 * @returns {boolean} Indica si se encontró y actualizó el producto.
 */
function updateProduct(database, product) {
  const result = database
    .prepare(
      `
      UPDATE products
      SET name = ?, sku = ?, category = ?, detail = ?, price = ?, stock = ?,
          badge = ?, image = ?, details_json = ?
      WHERE id = ?
    `
    )
    .run(
      product.name,
      product.sku,
      product.category,
      product.detail,
      product.price,
      product.stock,
      product.badge,
      product.image,
      JSON.stringify(product.details),
      product.id
    );
  return result.changes > 0;
}

/**
 * Elimina el producto y limpia sus referencias en recomendaciones atómicamente.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} productId ID del producto que se va a eliminar.
 * @returns {boolean} Indica si se encontró y eliminó el producto.
 */
function deleteProduct(database, productId) {
  database.exec("BEGIN");
  try {
    const product = database.prepare("SELECT id FROM products WHERE id = ?").get(productId);
    if (!product) {
      database.exec("ROLLBACK");
      return false;
    }

    const products = database
      .prepare("SELECT id, details_json FROM products WHERE id != ?")
      .all(productId);
    const updateDetails = database.prepare("UPDATE products SET details_json = ? WHERE id = ?");

    for (const { id, details_json: detailsJson } of products) {
      const details = JSON.parse(detailsJson);
      if (details.recommendedProductIds?.includes(productId)) {
        details.recommendedProductIds = details.recommendedProductIds.filter(
          (recommendedId) => recommendedId !== productId
        );
        updateDetails.run(JSON.stringify(details), id);
      }
    }

    database.prepare("DELETE FROM products WHERE id = ?").run(productId);
    database.exec("COMMIT");
    return true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Añade una categoría ya validada, incluyendo sus datos editoriales y orden.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {import("../src/JS/models.js").Category} category Registro de categoría validado.
 * @returns {boolean} Si se insertó la categoría sin duplicados.
 */
function createCategory(database, category) {
  const existing = database
    .prepare("SELECT name FROM categories WHERE name = ?")
    .get(category.name);
  if (existing) return false;

  const result = database
    .prepare("INSERT INTO categories (name, sort_order, image, description) VALUES (?, ?, ?, ?)")
    .run(category.name, category.sortOrder, category.image, category.description);
  return result.changes > 0;
}

/**
 * Renombra una categoría y actualiza también el campo de cada producto asociado.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} currentName Nombre actual persistido.
 * @param {import("../src/JS/models.js").Category} category Datos nuevos de la categoría.
 * @returns {boolean} Indica si se encontró la categoría y se actualizó.
 */
function updateCategory(database, currentName, category) {
  database.exec("BEGIN");
  try {
    database.exec("PRAGMA defer_foreign_keys = ON");
    const existing = database
      .prepare("SELECT name FROM categories WHERE name = ?")
      .get(currentName);
    if (!existing) {
      database.exec("ROLLBACK");
      return false;
    }

    const duplicate = database
      .prepare("SELECT name FROM categories WHERE name = ? AND name != ?")
      .get(category.name, currentName);
    if (duplicate) {
      database.exec("ROLLBACK");
      return false;
    }

    database
      .prepare("UPDATE products SET category = ? WHERE category = ?")
      .run(category.name, currentName);
    const result = database
      .prepare(
        "UPDATE categories SET name = ?, sort_order = ?, image = ?, description = ? WHERE name = ?"
      )
      .run(category.name, category.sortOrder, category.image, category.description, currentName);
    database.exec("COMMIT");
    return result.changes > 0;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Elimina una categoría solo si no tiene productos asociados.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} categoryName Nombre que se desea borrar.
 * @returns {boolean} Si la categoría se eliminó del catálogo.
 */
function deleteCategory(database, categoryName) {
  const productCount = database
    .prepare("SELECT COUNT(*) AS count FROM products WHERE category = ?")
    .get(categoryName).count;

  if (productCount > 0) return false;

  const result = database.prepare("DELETE FROM categories WHERE name = ?").run(categoryName);
  return result.changes > 0;
}

/**
 * Devuelve los registros privados del portal, nunca incluidos en el catálogo público.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 */
function readAdminData(database) {
  const customers = database
    .prepare("SELECT id, name, email, phone FROM customers ORDER BY rowid")
    .all();
  return { customers, sales: readSales(database) };
}

/**
 * Crea una cuenta y sus credenciales en una transacción para evitar registros parciales.
 */
function createCustomerAccount(database, customer, credentials) {
  database.exec("BEGIN");
  try {
    createCustomer(database, customer);
    database
      .prepare(
        "INSERT INTO customer_credentials (customer_id, salt, password_hash) VALUES (?, ?, ?)"
      )
      .run(customer.id, credentials.salt, credentials.passwordHash);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** Busca credenciales por correo sin incluirlas en ninguna respuesta pública. */
function getCustomerAccountByEmail(database, email) {
  return database
    .prepare(
      `SELECT customers.id, customers.name, customers.email, customers.phone,
              customer_credentials.salt, customer_credentials.password_hash AS passwordHash,
              customer_credentials.email_verified AS emailVerified
       FROM customers
       JOIN customer_credentials ON customer_credentials.customer_id = customers.id
       WHERE customers.email = ? COLLATE NOCASE`
    )
    .get(email);
}

/** Lee el perfil de una cuenta sin consultar ni exponer su contraseña derivada. */
function getCustomerById(database, customerId) {
  return database
    .prepare("SELECT id, name, email, phone FROM customers WHERE id = ?")
    .get(customerId);
}

/** Informa si el cliente completó la verificación de su correo. */
function isCustomerEmailVerified(database, customerId) {
  const account = database
    .prepare("SELECT email_verified FROM customer_credentials WHERE customer_id = ?")
    .get(customerId);
  return account?.email_verified === 1;
}

/**
 * Guarda el hash de un token secreto, reemplazando tokens anteriores del mismo propósito.
 */
function createAccountToken(database, customerId, purpose, tokenHash, expiresAt) {
  database.exec("BEGIN");
  try {
    database
      .prepare("DELETE FROM customer_account_tokens WHERE customer_id = ? AND purpose = ?")
      .run(customerId, purpose);
    database.prepare("DELETE FROM customer_account_tokens WHERE expires_at <= ?").run(Date.now());
    database
      .prepare(
        `INSERT INTO customer_account_tokens (
           token_hash, customer_id, purpose, expires_at, created_at
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(tokenHash, customerId, purpose, expiresAt, new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** Verifica una dirección solo si el token es válido y todavía no se consumió. */
function verifyCustomerEmail(database, tokenHash, now) {
  database.exec("BEGIN");
  try {
    const token = database
      .prepare(
        `SELECT customer_id FROM customer_account_tokens
         WHERE token_hash = ? AND purpose = 'verify-email' AND expires_at > ?`
      )
      .get(tokenHash, now);
    if (!token) {
      database.exec("COMMIT");
      return null;
    }
    const result = database
      .prepare("UPDATE customer_credentials SET email_verified = 1 WHERE customer_id = ?")
      .run(token.customer_id);
    database
      .prepare(
        "DELETE FROM customer_account_tokens WHERE customer_id = ? AND purpose = 'verify-email'"
      )
      .run(token.customer_id);
    database.exec("COMMIT");
    return result.changes ? getCustomerById(database, token.customer_id) || null : null;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** Cambia la contraseña con un token válido y consume todos los tokens de la cuenta. */
function resetCustomerPassword(database, tokenHash, credentials, now) {
  database.exec("BEGIN");
  try {
    const token = database
      .prepare(
        `SELECT customer_id FROM customer_account_tokens
         WHERE token_hash = ? AND purpose = 'reset-password' AND expires_at > ?`
      )
      .get(tokenHash, now);
    if (!token) {
      database.exec("COMMIT");
      return null;
    }
    const result = database
      .prepare(
        `UPDATE customer_credentials
         SET salt = ?, password_hash = ?
         WHERE customer_id = ? AND email_verified = 1`
      )
      .run(credentials.salt, credentials.passwordHash, token.customer_id);
    database
      .prepare("DELETE FROM customer_account_tokens WHERE customer_id = ?")
      .run(token.customer_id);
    database.exec("COMMIT");
    return result.changes ? getCustomerById(database, token.customer_id) || null : null;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Guarda un cliente que ya pasó la validación de la API.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {import("../src/JS/models.js").Customer} customer Cliente validado.
 */
function createCustomer(database, customer) {
  database
    .prepare("INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)")
    .run(customer.id, customer.name, customer.email, customer.phone);
}

/**
 * Actualiza los datos de contacto sin reescribir instantáneas de ventas anteriores.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {import("../src/JS/models.js").Customer} customer Cliente validado.
 * @returns {boolean} Si se encontró y actualizó el registro.
 */
function updateCustomer(database, customer) {
  const result = database
    .prepare("UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ?")
    .run(customer.name, customer.email, customer.phone, customer.id);
  return result.changes > 0;
}

/**
 * Elimina el cliente y conserva el nombre capturado en las ventas existentes.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} customerId ID estable del cliente.
 * @returns {boolean} Si se encontró y eliminó el registro.
 */
function deleteCustomer(database, customerId) {
  const result = database.prepare("DELETE FROM customers WHERE id = ?").run(customerId);
  return result.changes > 0;
}

/**
 * Registra una venta usando precios y stock del servidor, dentro de una transacción.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {{customerId: string|null, paymentMethod: string, items: Array<{productId: string, quantity: number}>}} request Solicitud previamente validada.
 * @returns {import("../src/JS/models.js").Sale} Venta creada con sus instantáneas.
 */
function createSale(database, request) {
  database.exec("BEGIN");
  try {
    let customerName = "";
    if (request.customerId) {
      const customer = database
        .prepare("SELECT name FROM customers WHERE id = ?")
        .get(request.customerId);
      if (!customer) {
        throw new StoreOperationError(
          "CUSTOMER_NOT_FOUND",
          "No se encontró el cliente seleccionado."
        );
      }
      customerName = customer.name;
    }

    const saleItems = [];
    let total = 0;
    for (const line of request.items) {
      const product = database
        .prepare("SELECT id, name, sku, price, stock FROM products WHERE id = ?")
        .get(line.productId);
      if (!product) {
        throw new StoreOperationError("PRODUCT_NOT_FOUND", "Uno de los productos ya no existe.");
      }
      if (product.stock < line.quantity) {
        throw new StoreOperationError(
          "INSUFFICIENT_STOCK",
          `Existencias insuficientes para ${product.name}. Disponibles: ${product.stock}.`
        );
      }

      const stockUpdate = database
        .prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?")
        .run(line.quantity, product.id, line.quantity);
      if (stockUpdate.changes !== 1) {
        throw new StoreOperationError(
          "INSUFFICIENT_STOCK",
          `Las existencias de ${product.name} cambiaron; vuelve a revisar la venta.`
        );
      }

      saleItems.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: line.quantity,
      });
      total += product.price * line.quantity;
    }

    const sale = {
      id: `sale-${randomUUID()}`,
      date: new Date().toISOString(),
      customerId: request.customerId,
      customerName,
      paymentMethod: request.paymentMethod,
      items: saleItems,
      total,
      status: "completed",
    };
    database
      .prepare(
        `INSERT INTO sales (id, date, customer_id, customer_name, payment_method, total, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sale.id,
        sale.date,
        sale.customerId,
        sale.customerName,
        sale.paymentMethod,
        sale.total,
        sale.status
      );
    const insertItem = database.prepare(
      `INSERT INTO sale_items (sale_id, product_id, name, sku, unit_price, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const item of sale.items) {
      insertItem.run(sale.id, item.productId, item.name, item.sku, item.unitPrice, item.quantity);
    }

    database.exec("COMMIT");
    return sale;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Anula una venta completada y devuelve al inventario las unidades relacionadas.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} saleId ID de la venta.
 * @returns {import("../src/JS/models.js").Sale} Venta ya anulada.
 */
function voidSale(database, saleId) {
  database.exec("BEGIN");
  try {
    const sale = database.prepare("SELECT status FROM sales WHERE id = ?").get(saleId);
    if (!sale) {
      throw new StoreOperationError("SALE_NOT_FOUND", "No se encontró la venta.");
    }
    if (sale.status !== "completed") {
      throw new StoreOperationError("SALE_ALREADY_VOIDED", "La venta ya fue anulada.");
    }

    const items = database
      .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?")
      .all(saleId);
    const restoreStock = database.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    for (const item of items) restoreStock.run(item.quantity, item.product_id);

    database
      .prepare("UPDATE sales SET status = 'voided', voided_at = ? WHERE id = ?")
      .run(new Date().toISOString(), saleId);
    database.exec("COMMIT");
    return readSales(database).find((item) => item.id === saleId);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Evita borrar productos mientras haya una venta completada que consuma su stock.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} productId ID del producto.
 * @returns {boolean} Si hay una venta activa asociada.
 */
function hasActiveFulfillmentForProduct(database, productId) {
  return Boolean(
    database
      .prepare(
        `SELECT 1 FROM sale_items items
         JOIN sales ON sales.id = items.sale_id
         WHERE items.product_id = ? AND sales.status = 'completed'
         UNION ALL
         SELECT 1 FROM order_items items
         JOIN orders ON orders.id = items.order_id
         WHERE items.product_id = ? AND orders.status IN ('pending', 'confirmed')
         LIMIT 1`
      )
      .get(productId, productId)
  );
}

/**
 * Registra un pedido pendiente con precios y nombres actuales, sin reservar stock.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} customerId Cuenta que inició sesión.
 * @param {{address: object, items: Array<{productId: string, quantity: number}>}} request Solicitud validada.
 */
function createOrder(database, customerId, request) {
  database.exec("BEGIN");
  try {
    const customer = database
      .prepare("SELECT id, name FROM customers WHERE id = ?")
      .get(customerId);
    if (!customer) {
      throw new StoreOperationError("CUSTOMER_NOT_FOUND", "No se encontró la cuenta.");
    }

    const orderItems = [];
    let total = 0;
    for (const line of request.items) {
      const product = database
        .prepare("SELECT id, name, sku, price, stock FROM products WHERE id = ?")
        .get(line.productId);
      if (!product) {
        throw new StoreOperationError("PRODUCT_NOT_FOUND", "Uno de los productos ya no existe.");
      }
      if (product.stock < line.quantity) {
        throw new StoreOperationError(
          "INSUFFICIENT_STOCK",
          `Existencias insuficientes para ${product.name}. Disponibles: ${product.stock}.`
        );
      }

      orderItems.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: line.quantity,
      });
      total += product.price * line.quantity;
    }

    const order = {
      id: `order-${randomUUID()}`,
      date: new Date().toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      shippingAddress: { ...request.address },
      items: orderItems,
      total,
      status: "pending",
    };
    database
      .prepare(
        `INSERT INTO orders (
           id, date, customer_id, customer_name, recipient_name, street, city, region,
           postal_code, phone, total, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        order.id,
        order.date,
        order.customerId,
        order.customerName,
        order.shippingAddress.name,
        order.shippingAddress.street,
        order.shippingAddress.city,
        order.shippingAddress.region,
        order.shippingAddress.postalCode,
        order.shippingAddress.phone,
        order.total,
        order.status
      );
    const insertItem = database.prepare(
      `INSERT INTO order_items (order_id, product_id, name, sku, unit_price, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const item of order.items) {
      insertItem.run(order.id, item.productId, item.name, item.sku, item.unitPrice, item.quantity);
    }

    database.exec("COMMIT");
    return order;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Confirma un pedido solo si todo el inventario sigue disponible y lo descuenta atómicamente.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} orderId Identificador del pedido.
 */
function confirmOrder(database, orderId) {
  database.exec("BEGIN");
  try {
    const order = database.prepare("SELECT status FROM orders WHERE id = ?").get(orderId);
    if (!order) throw new StoreOperationError("ORDER_NOT_FOUND", "No se encontró el pedido.");
    if (order.status !== "pending") {
      throw new StoreOperationError("ORDER_NOT_PENDING", "El pedido ya no está pendiente.");
    }

    const items = database
      .prepare("SELECT product_id, name, quantity FROM order_items WHERE order_id = ?")
      .all(orderId);
    const deductStock = database.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
    );
    for (const item of items) {
      const result = deductStock.run(item.quantity, item.product_id, item.quantity);
      if (result.changes !== 1) {
        const product = database
          .prepare("SELECT stock FROM products WHERE id = ?")
          .get(item.product_id);
        const available = product?.stock ?? 0;
        throw new StoreOperationError(
          product ? "INSUFFICIENT_STOCK" : "PRODUCT_NOT_FOUND",
          product
            ? `Existencias insuficientes para ${item.name}. Disponibles: ${available}.`
            : `El producto ${item.name} ya no existe en el catálogo.`
        );
      }
    }

    database
      .prepare(
        `UPDATE orders
         SET status = 'confirmed', stock_deducted = 1, confirmed_at = ?
         WHERE id = ?`
      )
      .run(new Date().toISOString(), orderId);
    database.exec("COMMIT");
    return readOrders(database).find((item) => item.id === orderId);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Cancela un pedido pendiente o confirmado; solo este último restaura existencias.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} orderId Identificador del pedido.
 */
function cancelOrder(database, orderId) {
  database.exec("BEGIN");
  try {
    const order = database
      .prepare("SELECT status, stock_deducted FROM orders WHERE id = ?")
      .get(orderId);
    if (!order) throw new StoreOperationError("ORDER_NOT_FOUND", "No se encontró el pedido.");
    if (order.status === "cancelled") {
      throw new StoreOperationError("ORDER_ALREADY_CANCELLED", "El pedido ya fue cancelado.");
    }

    if (order.stock_deducted) {
      const items = database
        .prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?")
        .all(orderId);
      const restoreStock = database.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
      for (const item of items) restoreStock.run(item.quantity, item.product_id);
    }
    database
      .prepare(
        `UPDATE orders
         SET status = 'cancelled', stock_deducted = 0, cancelled_at = ?
         WHERE id = ?`
      )
      .run(new Date().toISOString(), orderId);
    database.exec("COMMIT");
    return readOrders(database).find((item) => item.id === orderId);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** Lee pedidos y líneas históricas de artículos en orden descendente de fecha. */
function readOrders(database) {
  const orders = database
    .prepare(
      `SELECT id, date, customer_id AS customerId, customer_name AS customerName,
              recipient_name AS recipientName, street, city, region,
              postal_code AS postalCode, phone, total, status,
              confirmed_at AS confirmedAt, cancelled_at AS cancelledAt
       FROM orders ORDER BY date DESC, rowid DESC`
    )
    .all();
  const getItems = database.prepare(
    `SELECT product_id AS productId, name, sku, unit_price AS unitPrice, quantity
     FROM order_items WHERE order_id = ? ORDER BY rowid`
  );
  return orders.map((order) => ({
    id: order.id,
    date: order.date,
    customerId: order.customerId,
    customerName: order.customerName,
    shippingAddress: {
      name: order.recipientName,
      street: order.street,
      city: order.city,
      region: order.region,
      postalCode: order.postalCode,
      phone: order.phone,
    },
    items: getItems.all(order.id),
    total: order.total,
    status: order.status,
    ...(order.confirmedAt ? { confirmedAt: order.confirmedAt } : {}),
    ...(order.cancelledAt ? { cancelledAt: order.cancelledAt } : {}),
  }));
}

/**
 * Lee ventas en orden reciente con las instantáneas de sus artículos.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @returns {import("../src/JS/models.js").Sale[]} Historial de ventas.
 */
function readSales(database) {
  const sales = database
    .prepare(
      `SELECT id, date, customer_id AS customerId, customer_name AS customerName,
              payment_method AS paymentMethod, total, status, voided_at AS voidedAt
       FROM sales ORDER BY date DESC, rowid DESC`
    )
    .all();
  const getItems = database.prepare(
    `SELECT product_id AS productId, name, sku, unit_price AS unitPrice, quantity
     FROM sale_items WHERE sale_id = ? ORDER BY rowid`
  );
  return sales.map((sale) => ({ ...sale, items: getItems.all(sale.id) }));
}

/**
 * Inserta el catálogo demo en una transacción para evitar una carga parcial.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 */
function seedCatalog(database) {
  const insertCategory = database.prepare(
    "INSERT INTO categories (name, sort_order, image, description) VALUES (?, ?, ?, ?)"
  );
  const insertProduct = database.prepare(`
    INSERT INTO products (
      id, name, sku, category, detail, price, stock, badge, image, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");
  try {
    for (const category of DEFAULT_CATEGORIES) {
      insertCategory.run(category.name, category.sortOrder, category.image, category.description);
    }
    for (const product of DEFAULT_PRODUCTS) {
      insertProduct.run(
        product.id,
        product.name,
        product.sku,
        product.category,
        product.detail,
        product.price,
        product.stock,
        product.badge || "",
        product.image || "",
        JSON.stringify(getProductDetails(product))
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Lee productos y categorías en orden estable y recupera los detalles JSON.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @returns {import("../src/JS/models.js").Catalog} Catálogo entregado por la API.
 */
function readCatalog(database) {
  const categories = database
    .prepare(
      `SELECT name, sort_order AS sortOrder, image, description
       FROM categories ORDER BY sort_order, rowid`
    )
    .all()
    .map((category) => ({ ...category }));
  const products = database
    .prepare(
      `SELECT id, name, sku, category, detail, price, stock, badge, image, details_json
       FROM products ORDER BY rowid`
    )
    .all()
    .map(({ details_json, ...product }) => ({
      ...product,
      details: JSON.parse(details_json),
    }));

  return { products, categories };
}
