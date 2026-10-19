import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from "../src/JS/data/defaultCatalog.js";
import { getProductDetails } from "../src/JS/data/productDetails.js";

const backendDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = join(backendDirectory, "data", "store.sqlite");

/**
 * Crea las tablas y carga los datos demo solo si todavía no hay productos.
 * @param {string} databasePath Ruta del archivo SQLite; usa ":memory:" en pruebas.
 * @returns {{
 *   getCatalog: () => import("../src/JS/models.js").Catalog,
 *   createProduct: (product: import("../src/JS/models.js").Product) => void,
 *   updateProduct: (product: import("../src/JS/models.js").Product) => boolean,
 *   deleteProduct: (productId: string) => boolean,
 *   close: () => void
 * }}
 */
export function createCatalogRepository(databasePath = defaultDatabasePath) {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY
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
  `);

  const productCount = database.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (productCount === 0) seedCatalog(database);

  return {
    getCatalog: () => readCatalog(database),
    createProduct: (product) => createProduct(database, product),
    updateProduct: (product) => updateProduct(database, product),
    deleteProduct: (productId) => deleteProduct(database, productId),
    createCategory: (categoryName) => createCategory(database, categoryName),
    updateCategory: (currentName, nextName) => updateCategory(database, currentName, nextName),
    deleteCategory: (categoryName) => deleteCategory(database, categoryName),
    close: () => database.close(),
  };
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
 * Añade una categoría nueva siempre que no exista ya con un nombre equivalente.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} categoryName Nombre que se guarda en el catálogo público.
 * @returns {boolean} Si se insertó la categoría sin duplicados.
 */
function createCategory(database, categoryName) {
  const existing = database.prepare("SELECT name FROM categories WHERE name = ?").get(categoryName);
  if (existing) return false;

  const result = database.prepare("INSERT INTO categories (name) VALUES (?)").run(categoryName);
  return result.changes > 0;
}

/**
 * Renombra una categoría y actualiza también el campo de cada producto asociado.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 * @param {string} currentName Nombre actual persistido.
 * @param {string} nextName Nombre nuevo que reemplaza la categoría.
 * @returns {boolean} Indica si se encontró la categoría y se actualizó.
 */
function updateCategory(database, currentName, nextName) {
  database.exec("BEGIN");
  try {
    const existing = database
      .prepare("SELECT name FROM categories WHERE name = ?")
      .get(currentName);
    if (!existing) {
      database.exec("ROLLBACK");
      return false;
    }

    const duplicate = database
      .prepare("SELECT name FROM categories WHERE name = ? AND name != ?")
      .get(nextName, currentName);
    if (duplicate) {
      database.exec("ROLLBACK");
      return false;
    }

    database
      .prepare("UPDATE products SET category = ? WHERE category = ?")
      .run(nextName, currentName);
    const result = database
      .prepare("UPDATE categories SET name = ? WHERE name = ?")
      .run(nextName, currentName);
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
 * Inserta el catálogo demo en una transacción para evitar una carga parcial.
 * @param {import("node:sqlite").DatabaseSync} database Conexión SQLite abierta.
 */
function seedCatalog(database) {
  const insertCategory = database.prepare("INSERT INTO categories (name) VALUES (?)");
  const insertProduct = database.prepare(`
    INSERT INTO products (
      id, name, sku, category, detail, price, stock, badge, image, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");
  try {
    for (const category of DEFAULT_CATEGORIES) insertCategory.run(category);
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
    .prepare("SELECT name FROM categories ORDER BY rowid")
    .all()
    .map((category) => category.name);
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
