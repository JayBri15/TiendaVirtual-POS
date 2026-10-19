/**
 * Error de validación que la API convierte en una respuesta HTTP 400.
 */
export class SaleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SaleValidationError";
  }
}

/**
 * Valida la solicitud de una venta; precios y existencias se consultan después
 * dentro de la transacción SQLite, nunca se confían al navegador.
 * @param {unknown} value Cuerpo JSON recibido por la API.
 * @returns {{customerId: string|null, paymentMethod: string, items: Array<{productId: string, quantity: number}>}}
 */
export function validateSaleRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SaleValidationError("El cuerpo debe ser un objeto de venta.");
  }
  const customerId = value.customerId === undefined ? null : value.customerId;
  if (customerId !== null && (typeof customerId !== "string" || !customerId.trim())) {
    throw new SaleValidationError("El cliente seleccionado no es válido.");
  }
  if (
    typeof value.paymentMethod !== "string" ||
    !value.paymentMethod.trim() ||
    value.paymentMethod.trim().length > 80
  ) {
    throw new SaleValidationError("Selecciona un método de pago válido.");
  }
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
        item.quantity < 1
    ) ||
    new Set(value.items.map((item) => item.productId)).size !== value.items.length
  ) {
    throw new SaleValidationError(
      "Agrega productos y cantidades enteras válidas sin repetir productos."
    );
  }

  return {
    customerId,
    paymentMethod: value.paymentMethod.trim(),
    items: value.items.map(({ productId, quantity }) => ({ productId, quantity })),
  };
}
