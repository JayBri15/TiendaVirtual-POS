import { randomUUID } from "node:crypto";

/**
 * Error de validación que la API devuelve como respuesta HTTP 400.
 */
export class ProductValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProductValidationError";
  }
}

/**
 * Error específico de validación de categorías del catálogo.
 */
export class CategoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CategoryValidationError";
  }
}

/**
 * Valida los datos editoriales de una categoría nueva y evita duplicados.
 * @param {unknown} value Cuerpo JSON enviado por el cliente.
 * @param {import("../src/JS/models.js").Catalog} catalog Catálogo actual con categorías ya persistidas.
 * @returns {import("../src/JS/models.js").Category} Categoría normalizada y válida.
 */
export function validateCategoryCreate(value, catalog) {
  const category = validateCategory(value);
  if (
    catalog.categories.some(
      (existing) =>
        existing.name.toLocaleLowerCase("es-MX") === category.name.toLocaleLowerCase("es-MX")
    )
  ) {
    throw new CategoryValidationError("Ya existe una categoría con ese nombre.");
  }

  return category;
}

/**
 * Valida el cambio de los campos de una categoría existente.
 * @param {string} currentName Nombre actual que se está renombrando.
 * @param {unknown} value Cuerpo JSON enviado por el cliente.
 * @param {import("../src/JS/models.js").Catalog} catalog Catálogo actual.
 * @returns {import("../src/JS/models.js").Category} Categoría nueva validada.
 */
export function validateCategoryRename(currentName, value, catalog) {
  const category = validateCategory(value);
  if (
    catalog.categories.some(
      (existing) =>
        existing.name !== currentName &&
        existing.name.toLocaleLowerCase("es-MX") === category.name.toLocaleLowerCase("es-MX")
    )
  ) {
    throw new CategoryValidationError("Ya existe una categoría con ese nombre.");
  }

  return category;
}

/**
 * Comprueba que una categoría exista y que no tenga productos asociados.
 * @param {string} categoryName Nombre de la categoría a borrar.
 * @param {import("../src/JS/models.js").Catalog} catalog Catálogo actual.
 * @returns {string} Nombre validado.
 */
export function validateCategoryDelete(categoryName, catalog) {
  const name = requiredText(categoryName, "La categoría", 60);
  if (!catalog.categories.some((category) => category.name === name)) {
    throw new CategoryValidationError("La categoría no existe.");
  }
  if (catalog.products.some((product) => product.category === name)) {
    throw new CategoryValidationError(
      "No se puede eliminar una categoría que tiene productos asignados."
    );
  }
  return name;
}

/**
 * Comprueba el contrato completo de una categoría configurable desde Admin.
 * @param {unknown} value Cuerpo JSON recibido.
 * @returns {import("../src/JS/models.js").Category} Categoría normalizada.
 */
function validateCategory(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CategoryValidationError("El cuerpo debe ser un objeto de categoría.");
  }
  const name = requiredText(value.name, "La categoría", 60);
  const description = optionalText(value.description, "La descripción", 600);
  const image = optionalText(value.image, "La imagen", 3 * 1024 * 1024);
  const sortOrder = value.sortOrder;
  if (typeof sortOrder !== "number" || !Number.isSafeInteger(sortOrder) || sortOrder < 1) {
    throw new CategoryValidationError("El orden debe ser un entero igual o mayor que uno.");
  }
  if (image && !isValidImage(image)) {
    throw new CategoryValidationError("La imagen debe ser una URL HTTP(S) o una imagen permitida.");
  }
  return { name, sortOrder, image, description };
}

/**
 * Valida todos los campos de un producto antes de guardarlo en SQLite.
 * @param {string} productId ID estable recibido en la URL.
 * @param {unknown} value Cuerpo JSON enviado por el cliente.
 * @param {import("../src/JS/models.js").Catalog} catalog Productos y categorías actuales.
 * @returns {import("../src/JS/models.js").Product} Producto normalizado y válido.
 */
export function validateProductUpdate(productId, value, catalog) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductValidationError("El cuerpo debe ser un objeto de producto.");
  }
  const body = value;
  const name = requiredText(body.name, "El nombre", 100);
  const sku = requiredText(body.sku, "El SKU", 30);
  const category = requiredText(body.category, "La categoría", 60);
  const detail = optionalText(body.detail, "La descripción breve", 120);
  const badge = optionalText(body.badge, "La etiqueta", 40);
  const price = body.price;
  const stock = body.stock;

  if (!catalog.categories.some((item) => item.name === category)) {
    throw new ProductValidationError("La categoría no existe.");
  }
  if (
    catalog.products.some(
      (product) =>
        product.id !== productId &&
        product.sku.toLocaleLowerCase("es-MX") === sku.toLocaleLowerCase("es-MX")
    )
  ) {
    throw new ProductValidationError("Ya existe un producto con ese SKU.");
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new ProductValidationError("El precio debe ser un número mayor que cero.");
  }
  if (typeof stock !== "number" || !Number.isSafeInteger(stock) || stock < 0) {
    throw new ProductValidationError("Las existencias deben ser un entero no negativo.");
  }

  const image = optionalText(body.image, "La imagen", 3 * 1024 * 1024);
  if (image && !isValidImage(image)) {
    throw new ProductValidationError("La imagen debe ser una URL HTTP(S) o una imagen permitida.");
  }

  const details = validateDetails(body.details, productId, catalog);
  return {
    id: productId,
    name,
    sku,
    category,
    detail,
    price,
    stock,
    badge,
    image,
    details,
  };
}

/**
 * Valida un producto nuevo y genera su identificador estable en el servidor.
 * @param {unknown} value Cuerpo JSON enviado por el cliente.
 * @param {import("../src/JS/models.js").Catalog} catalog Productos y categorías actuales.
 * @returns {import("../src/JS/models.js").Product} Producto nuevo normalizado y válido.
 */
export function validateProductCreate(value, catalog) {
  return validateProductUpdate(`product-${randomUUID()}`, value, catalog);
}

/**
 * Valida la información detallada que se muestra en la ficha pública.
 * @param {unknown} value Detalles recibidos en la solicitud.
 * @param {string} productId ID del producto que se está editando.
 * @param {import("../src/JS/models.js").Catalog} catalog Catálogo actual.
 */
function validateDetails(value, productId, catalog) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductValidationError("Faltan los detalles de la ficha del producto.");
  }

  const description = requiredText(value.description, "La descripción", 600);
  const ingredients = requiredText(value.ingredients, "Los ingredientes", 600);
  const productPackage = requiredText(value.package, "La presentación", 240);
  const instructions = requiredText(value.instructions, "Las instrucciones", 600);
  const benefits = value.benefits;
  const rating = value.rating;
  const reviewCount = value.reviewCount;
  const reviews = value.reviews;

  if (
    !Array.isArray(benefits) ||
    benefits.length === 0 ||
    benefits.some((benefit) => typeof benefit !== "string" || !benefit.trim()) ||
    benefits.join("\n").length > 1200
  ) {
    throw new ProductValidationError("Agrega beneficios válidos (hasta 1200 caracteres).");
  }
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new ProductValidationError("El promedio debe estar entre 0 y 5.");
  }
  if (
    typeof reviewCount !== "number" ||
    !Number.isInteger(reviewCount) ||
    reviewCount < 0 ||
    !Array.isArray(reviews) ||
    reviews.length > reviewCount
  ) {
    throw new ProductValidationError("El total debe ser un entero igual o mayor a las reseñas.");
  }
  if (reviews.some((review) => !isValidReview(review))) {
    throw new ProductValidationError(
      "Cada reseña requiere autor, comentario y estrellas de 1 a 5."
    );
  }

  const recommendedProductIds = value.recommendedProductIds;
  if (
    recommendedProductIds !== undefined &&
    (!Array.isArray(recommendedProductIds) ||
      recommendedProductIds.length > 4 ||
      new Set(recommendedProductIds).size !== recommendedProductIds.length ||
      recommendedProductIds.some(
        (id) =>
          typeof id !== "string" ||
          id === productId ||
          !catalog.products.some((product) => product.id === id)
      ))
  ) {
    throw new ProductValidationError("Elige hasta cuatro productos recomendados que existan.");
  }

  return {
    description,
    ingredients,
    package: productPackage,
    instructions,
    benefits,
    rating,
    reviewCount,
    reviews,
    ...(recommendedProductIds ? { recommendedProductIds } : {}),
  };
}

/**
 * Acepta texto obligatorio dentro del límite del formulario público.
 * @param {unknown} value Valor que se va a validar.
 * @param {string} label Nombre legible del campo para el mensaje de error.
 * @param {number} maxLength Cantidad máxima de caracteres.
 */
function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new ProductValidationError(
      `${label} es obligatorio y debe tener hasta ${maxLength} caracteres.`
    );
  }
  return value.trim();
}

/**
 * Acepta texto opcional y aplica un límite de longitud.
 * @param {unknown} value Valor que se va a validar.
 * @param {string} label Nombre legible del campo para el mensaje de error.
 * @param {number} maxLength Cantidad máxima de caracteres.
 */
function optionalText(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ProductValidationError(`${label} debe ser texto de hasta ${maxLength} caracteres.`);
  }
  return value.trim();
}

/**
 * Valida los campos públicos de una reseña individual.
 * @param {unknown} review Reseña recibida en la solicitud.
 */
function isValidReview(review) {
  return (
    review !== null &&
    typeof review === "object" &&
    typeof review.author === "string" &&
    Boolean(review.author.trim()) &&
    review.author.length <= 80 &&
    Number.isInteger(review.rating) &&
    review.rating >= 1 &&
    review.rating <= 5 &&
    typeof review.date === "string" &&
    review.date.length <= 40 &&
    typeof review.text === "string" &&
    Boolean(review.text.trim()) &&
    review.text.length <= 500
  );
}

/**
 * Acepta imágenes vacías, URL HTTP(S) y data URL base64 dentro del límite.
 * @param {string} image Texto de imagen cuyo tamaño ya fue validado.
 */
export function isValidImage(image) {
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    return true;
  }
  try {
    return ["http:", "https:"].includes(new URL(image).protocol);
  } catch {
    return false;
  }
}
