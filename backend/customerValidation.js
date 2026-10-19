import { randomUUID } from "node:crypto";

/**
 * Error de validación que la API convierte en una respuesta HTTP 400.
 */
export class CustomerValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CustomerValidationError";
  }
}

/**
 * Normaliza y valida los datos de un cliente antes de persistirlos.
 * @param {unknown} value Cuerpo JSON recibido por la API.
 * @param {import("../src/JS/models.js").Customer[]} customers Clientes existentes.
 * @param {string|null} currentId ID del cliente editado, o null para altas nuevas.
 * @returns {import("../src/JS/models.js").Customer} Cliente listo para guardar.
 */
export function validateCustomer(value, customers, currentId = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CustomerValidationError("El cuerpo debe ser un objeto de cliente.");
  }

  const name = requiredText(value.name, "El nombre", 120);
  const email = requiredText(value.email, "El correo", 254).toLocaleLowerCase("es-MX");
  const phone = requiredText(value.phone, "El teléfono", 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CustomerValidationError("Escribe un correo electrónico válido.");
  }
  if (
    customers.some(
      (customer) =>
        customer.id !== currentId &&
        customer.email.toLocaleLowerCase("es-MX") === email.toLocaleLowerCase("es-MX")
    )
  ) {
    throw new CustomerValidationError("Ya existe un cliente con ese correo.");
  }

  return { id: currentId || `customer-${randomUUID()}`, name, email, phone };
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new CustomerValidationError(
      `${label} es obligatorio y debe tener hasta ${maxLength} caracteres.`
    );
  }
  return value.trim();
}
