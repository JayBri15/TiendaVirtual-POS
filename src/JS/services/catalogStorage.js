import { DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from "../data/defaultCatalog.js";

/** Claves de almacenamiento compartidas entre pestañas y las vistas del sitio. */
export const DATA_KEY = "amway-admin-demo-data-v1";
export const CART_KEY = "amway-demo-cart-v1";
export const CATALOG_CHANGE_KEY = "amway-public-catalog-updated-v1";
export const ADMIN_DATA_CHANGE_KEY = "amway-admin-data-updated-v1";
let catalogChangeSequence = 0;
let adminDataChangeSequence = 0;

/** Notifica a otras pestañas que deben volver a leer el catálogo del servidor. */
export function announceCatalogChange() {
  try {
    catalogChangeSequence += 1;
    localStorage.setItem(CATALOG_CHANGE_KEY, `${Date.now()}-${catalogChangeSequence}`);
  } catch (error) {
    console.error("No se pudo avisar a otras pestañas que cambió el catálogo.", error);
  }
}

/** Avisa a otras pestañas Admin que deben releer clientes e historial de ventas. */
export function announceAdminDataChange() {
  try {
    adminDataChangeSequence += 1;
    localStorage.setItem(ADMIN_DATA_CHANGE_KEY, `${Date.now()}-${adminDataChangeSequence}`);
  } catch (error) {
    console.error("No se pudo avisar a otras pestañas que cambiaron los datos de Admin.", error);
  }
}

/**
 * Comprueba que una imagen sea una URL web segura o una imagen permitida
 * guardada como data URL por el formulario de Admin.
 * @param {string} image Fuente de imagen por validar.
 * @returns {boolean} Si se puede usar en el catálogo.
 */
export function isValidImage(image) {
  if (typeof image !== "string" || !image) return false;
  const isAllowedDataImage =
    image.length <= 3 * 1024 * 1024 &&
    /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image);
  if (isAllowedDataImage) return true;

  try {
    return ["http:", "https:"].includes(new URL(image).protocol);
  } catch {
    return false;
  }
}

/**
 * Comprueba que una reseña tenga autor, estrellas, fecha y comentario válidos.
 * @param {unknown} review Registro de opinión leído desde el almacenamiento.
 * @returns {boolean} Si la reseña cumple el contrato.
 */
function isValidReview(review) {
  return (
    review !== null &&
    typeof review === "object" &&
    typeof review.author === "string" &&
    Boolean(review.author.trim()) &&
    Number.isInteger(review.rating) &&
    review.rating >= 1 &&
    review.rating <= 5 &&
    typeof review.date === "string" &&
    typeof review.text === "string" &&
    Boolean(review.text.trim())
  );
}

/**
 * Comprueba que las referencias opcionales de recomendaciones sean únicas.
 * @param {unknown} ids Identificadores guardados en los detalles del producto.
 * @returns {boolean} Si son como máximo cuatro IDs no vacíos y únicos.
 */
function isValidRecommendationIds(ids) {
  return (
    Array.isArray(ids) &&
    ids.length <= 4 &&
    ids.every((id) => typeof id === "string" && Boolean(id)) &&
    new Set(ids).size === ids.length
  );
}

/**
 * Comprueba el contenido editable que se muestra en la ficha pública.
 * @param {unknown} value Información detallada almacenada en un producto.
 * @returns {boolean} Si los campos y reseñas cumplen el contrato.
 */
export function isValidProductDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const {
    description,
    ingredients,
    package: productPackage,
    instructions,
    benefits,
    rating,
    reviewCount,
    reviews,
    recommendedProductIds,
  } = value;
  const requiredText = [description, ingredients, productPackage, instructions];
  const validContent = requiredText.every(
    (item) => typeof item === "string" && Boolean(item.trim())
  );
  const validBenefits =
    Array.isArray(benefits) &&
    benefits.length > 0 &&
    benefits.every((item) => typeof item === "string" && Boolean(item.trim()));
  const validRating = Number.isFinite(rating) && rating >= 0 && rating <= 5;
  const validReviewCount = Number.isInteger(reviewCount) && reviewCount >= 0;
  const validReviews =
    Array.isArray(reviews) && reviews.length <= reviewCount && reviews.every(isValidReview);
  const validRecommendations =
    recommendedProductIds === undefined || isValidRecommendationIds(recommendedProductIds);

  return (
    validContent &&
    validBenefits &&
    validRating &&
    validReviewCount &&
    validReviews &&
    validRecommendations
  );
}

/**
 * Comprueba que IDs recomendados existan y no apunten al mismo producto.
 * @param {import("../models.js").Product[]} products Catálogo completo.
 * @returns {boolean} Si todas las relaciones de recomendación son válidas.
 */
function areRecommendationsValid(products) {
  return products.every((product) => {
    const ids = product.details?.recommendedProductIds || [];
    return ids.every((id) => id !== product.id && products.some((item) => item.id === id));
  });
}

/**
 * Valida el contrato del catálogo persistido antes de exponer sus registros.
 * @param {unknown} value Datos JSON sin validar.
 * @returns {boolean} True si categorías, productos e invariantes son válidos.
 */
export function isValidCatalog(value) {
  if (!value || typeof value !== "object") return false;
  const { products, categories } = value;
  if (!Array.isArray(products) || !Array.isArray(categories)) return false;
  const categoryNames = categories.map((category) =>
    typeof category === "string" ? category : category?.name
  );
  const validCategories = categories.every((category) => {
    if (typeof category === "string") return Boolean(category.trim());
    return (
      category &&
      typeof category === "object" &&
      typeof category.name === "string" &&
      Boolean(category.name.trim()) &&
      Number.isSafeInteger(category.sortOrder) &&
      category.sortOrder >= 1 &&
      typeof category.description === "string" &&
      (category.image === "" || isValidImage(category.image))
    );
  });
  if (!validCategories) return false;

  const validProducts = products.every(
    (product) =>
      product &&
      typeof product.id === "string" &&
      Boolean(product.id.trim()) &&
      typeof product.name === "string" &&
      Boolean(product.name.trim()) &&
      typeof product.sku === "string" &&
      Boolean(product.sku.trim()) &&
      categoryNames.includes(product.category) &&
      typeof product.detail === "string" &&
      Number.isFinite(product.price) &&
      product.price > 0 &&
      Number.isSafeInteger(product.stock) &&
      product.stock >= 0 &&
      (product.badge === undefined || typeof product.badge === "string") &&
      (product.details === undefined || isValidProductDetails(product.details)) &&
      (product.image === undefined || product.image === "" || isValidImage(product.image))
  );
  if (!validProducts) return false;
  if (!areRecommendationsValid(products)) return false;

  const uniqueProductIds = new Set(products.map((product) => product.id)).size === products.length;
  const uniqueSkus =
    new Set(products.map((product) => product.sku.toLocaleLowerCase("es-MX"))).size ===
    products.length;
  const uniqueCategories =
    new Set(categoryNames.map((category) => category.toLocaleLowerCase("es-MX"))).size ===
    categoryNames.length;
  return uniqueProductIds && uniqueSkus && uniqueCategories;
}

/**
 * Lee el catálogo del almacenamiento y completa campos opcionales desde el
 * catálogo base. Ante datos corruptos informa el error y devuelve la base.
 * @returns {import("../models.js").Catalog} Catálogo validado para la interfaz.
 */
export function readCatalog() {
  try {
    const stored = localStorage.getItem(DATA_KEY);
    if (!stored) return getDefaultCatalog();

    const data = JSON.parse(stored);
    if (!isValidCatalog(data)) {
      throw new TypeError("El catálogo guardado no cumple el modelo de datos.");
    }

    const products = data.products.map((product) => {
      const fallback = DEFAULT_PRODUCTS.find((item) => item.id === product.id);
      return {
        ...fallback,
        ...product,
        image: product.image || fallback?.image || "",
        badge: product.badge ?? fallback?.badge ?? "Nuevo",
      };
    });
    const categories = data.categories.map((category, index) =>
      typeof category === "string"
        ? { name: category, sortOrder: index + 1, image: "", description: "" }
        : {
            sortOrder: index + 1,
            image: "",
            description: "",
            ...category,
          }
    );
    return { products, categories };
  } catch (error) {
    console.error("No se pudo recuperar el catálogo.", error);
    return getDefaultCatalog();
  }
}

/**
 * Crea copias del catálogo inicial para que las vistas no muten sus constantes.
 * @returns {import("../models.js").Catalog} Datos base independientes.
 */
export function getDefaultCatalog() {
  return {
    products: DEFAULT_PRODUCTS.map((product) => ({ ...product })),
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
  };
}

/**
 * Consolida líneas repetidas, descarta productos inválidos y limita unidades
 * a las existencias vigentes.
 * @param {unknown} cart Líneas recuperadas del almacenamiento.
 * @param {import("../models.js").Product[]} products Catálogo vigente.
 * @returns {import("../models.js").CartLine[]} Carrito normalizado.
 */
export function normalizeCart(cart, products) {
  if (!Array.isArray(cart)) return [];
  const quantities = new Map();

  for (const line of cart) {
    if (
      !line ||
      typeof line.id !== "string" ||
      !Number.isInteger(line.quantity) ||
      line.quantity <= 0
    )
      continue;
    const product = products.find((item) => item.id === line.id);
    if (!product || product.stock < 1) continue;

    const currentQuantity = quantities.get(line.id) || 0;
    quantities.set(line.id, Math.min(product.stock, currentQuantity + line.quantity));
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

/**
 * Recupera y normaliza el carrito; errores de JSON o almacenamiento se reportan.
 * @param {import("../models.js").Product[]} products Catálogo para validar IDs.
 * @returns {import("../models.js").CartLine[]} Carrito listo para mostrarse.
 */
export function loadCart(products) {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return normalizeCart(JSON.parse(stored || "[]"), products);
  } catch (error) {
    console.error("No se pudo recuperar el carrito.", error);
    return [];
  }
}

/**
 * Persiste el carrito y devuelve el resultado para que la UI pueda reaccionar.
 * @param {import("../models.js").CartLine[]} cart Carrito que se guardará.
 * @returns {boolean} Indica si el navegador pudo persistir el cambio.
 */
export function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    return true;
  } catch (error) {
    console.error("No se pudo guardar el carrito.", error);
    return false;
  }
}

/**
 * Persiste el conjunto completo de datos administrados por Admin.
 * @param {import("../models.js").AdminData} data Modelo que se serializará.
 */
export function saveCatalog(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}
