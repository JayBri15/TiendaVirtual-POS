/**
 * Error de validación que la API devuelve como HTTP 400.
 */
export class OrderValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OrderValidationError";
  }
}

/**
 * Valida los datos de entrega y líneas de un pedido de cliente.
 * No acepta precios: el servidor toma el importe actual del catálogo.
 * @param {unknown} value Cuerpo JSON recibido.
 */
export function validateOrderRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderValidationError("El cuerpo debe ser un objeto de pedido.");
  }
  const address = value.address;
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    throw new OrderValidationError("Completa los datos de entrega.");
  }
  const normalizedAddress = {
    name: requiredText(address.name, "El nombre", 120),
    street: requiredText(address.street, "La dirección", 200),
    city: requiredText(address.city, "La ciudad", 100),
    region: requiredText(address.region, "El estado o provincia", 100),
    postalCode: requiredText(address.postalCode, "El código postal", 20),
    phone: requiredText(address.phone, "El teléfono", 40),
  };
  if (
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    value.items.length > 100 ||
    value.items.some(
      (item) =>
        !item ||
        typeof item.productId !== "string" ||
        !item.productId.trim() ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10000
    ) ||
    new Set(value.items.map((item) => item.productId)).size !== value.items.length
  ) {
    throw new OrderValidationError(
      "Agrega productos y cantidades entre 1 y 10,000 sin repetir artículos."
    );
  }
  return {
    address: normalizedAddress,
    items: value.items.map(({ productId, quantity }) => ({ productId, quantity })),
  };
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new OrderValidationError(
      `${label} es obligatorio y debe tener hasta ${maxLength} caracteres.`
    );
  }
  return value.trim();
}
