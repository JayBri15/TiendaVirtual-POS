import { EPS_LOCATIONS } from "../shared/epsLocations.js";

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
  const deliveryMethod = value.deliveryMethod ?? "address";
  if (deliveryMethod !== "address" && deliveryMethod !== "eps") {
    throw new OrderValidationError("Selecciona una modalidad de entrega válida.");
  }
  const recipient = {
    name: requiredText(address.name, "El nombre", 120),
    phone: requiredText(address.phone, "El teléfono", 40),
  };
  let normalizedAddress;
  let epsLocation = null;
  if (deliveryMethod === "eps") {
    epsLocation = EPS_LOCATIONS.find((location) => location.id === value.epsLocationId);
    if (!epsLocation) {
      throw new OrderValidationError("Selecciona una sucursal EPS válida.");
    }
    normalizedAddress = {
      ...recipient,
      street: epsLocation.address,
      city: epsLocation.city,
      region: epsLocation.region,
      municipality: "",
      sector: "",
      postalCode: "",
      deliveryMethod,
      epsLocation: { ...epsLocation },
    };
  } else {
    normalizedAddress = {
      ...recipient,
      street: requiredText(address.street, "La dirección", 200),
      city: requiredText(address.city, "La ciudad", 100),
      region: requiredText(address.region, "La provincia", 100),
      municipality: requiredText(address.municipality, "El municipio", 100),
      sector: requiredText(address.sector, "El sector", 100),
      postalCode: requiredText(address.postalCode, "El código postal", 20),
    };
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
    deliveryMethod,
    epsLocation,
    saveAsAlternate: deliveryMethod === "address" && value.saveAsAlternate === true,
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
