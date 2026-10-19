import { CustomerValidationError, validateCustomer } from "./customerValidation.js";

/**
 * Error de validación que la API devuelve como HTTP 400.
 */
export class CustomerAccountValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CustomerAccountValidationError";
  }
}

/**
 * Valida los datos de contacto y las reglas de contraseña para registrarse.
 * @param {unknown} value Solicitud de registro.
 * @param {import("../src/JS/models.js").Customer[]} customers Clientes ya registrados.
 * @returns {{customer: import("../src/JS/models.js").Customer, password: string}} Datos preparados.
 */
export function validateCustomerRegistration(value, customers) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CustomerAccountValidationError("El cuerpo debe ser un objeto de cuenta.");
  }
  let customer;
  try {
    customer = validateCustomer(value, customers);
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      throw new CustomerAccountValidationError(error.message);
    }
    throw error;
  }

  const password = validateCustomerPassword(value.password);
  return { customer, password };
}

/** Comprueba la regla compartida por registro y restablecimiento de contraseña. */
export function validateCustomerPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 1024 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new CustomerAccountValidationError(
      "La contraseña requiere al menos 8 caracteres, mayúscula, minúscula, número y carácter especial."
    );
  }
  return password;
}
