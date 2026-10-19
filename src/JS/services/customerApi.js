async function readApiError(response) {
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

const isCustomer = (customer) =>
  customer &&
  typeof customer.id === "string" &&
  typeof customer.name === "string" &&
  typeof customer.email === "string" &&
  typeof customer.phone === "string";

/**
 * Comprueba una cookie de cuenta HttpOnly sin guardarla en JavaScript.
 * @returns {Promise<import("../models.js").Customer|null>} Perfil de sesión actual.
 */
export async function readCustomerSession() {
  const response = await fetch("/api/account/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const result = await response.json();
  if (
    !result ||
    typeof result.authenticated !== "boolean" ||
    (result.customer !== null && !isCustomer(result.customer)) ||
    (result.authenticated && !result.customer)
  ) {
    throw new TypeError("La respuesta de sesión del cliente no cumple el formato esperado.");
  }
  return result.customer;
}

/**
 * Inicia una sesión de cliente y deja la cookie protegida en el navegador.
 */
export async function loginCustomer(email, password) {
  const response = await fetch("/api/account/login", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const result = await response.json();
  if (!result || !isCustomer(result.customer)) {
    throw new TypeError("La respuesta de inicio de sesión no cumple el formato esperado.");
  }
  return result.customer;
}

/**
 * Registra una cuenta de cliente con contraseña cifrada en el servidor.
 */
export async function registerCustomer(customer) {
  const response = await fetch("/api/account/register", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const result = await response.json();
  if (!result || !isCustomer(result.customer) || result.verificationRequired !== true) {
    throw new TypeError("La respuesta de registro no cumple el formato esperado.");
  }
  return result;
}

/** Verifica un enlace de correo; el servidor inicia sesión solo tras validarlo. */
export async function verifyCustomerEmail(token) {
  const response = await fetch("/api/account/verify-email", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const result = await response.json();
  if (!result || !isCustomer(result.customer)) {
    throw new TypeError("La respuesta de verificación no cumple el formato esperado.");
  }
  return result.customer;
}

/** Solicita el reenvío seguro de un enlace de verificación. */
export async function resendCustomerVerification(email) {
  return postAccountMessage("/api/account/verification/resend", { email });
}

/** Solicita por correo un enlace para restablecer la contraseña. */
export async function requestCustomerPasswordReset(email) {
  return postAccountMessage("/api/account/password-reset/request", { email });
}

/** Cambia la contraseña usando el token temporal enviado por correo. */
export async function resetCustomerPassword(token, password) {
  const response = await fetch("/api/account/password-reset/complete", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const result = await response.json();
  if (!result || result.passwordReset !== true) {
    throw new TypeError("La respuesta de restablecimiento no cumple el formato esperado.");
  }
}

async function postAccountMessage(path, values) {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const result = await response.json();
  if (!result || typeof result.message !== "string") {
    throw new TypeError("La respuesta de la solicitud de correo no cumple el formato esperado.");
  }
  return result.message;
}

/** Termina la sesión y borra la cookie HttpOnly del cliente. */
export async function logoutCustomer() {
  const response = await fetch("/api/account/logout", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

/**
 * Crea un pedido pendiente. El backend calcula precios y vuelve a comprobar stock.
 * @param {{address: object, items: Array<{productId: string, quantity: number}>}} order Solicitud sin precios.
 * @returns {Promise<import("../models.js").Order>} Pedido persistido.
 */
export async function createCustomerOrder(order) {
  const response = await fetch("/api/orders", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const savedOrder = await response.json();
  if (!isOrder(savedOrder)) {
    throw new TypeError("La respuesta del pedido no cumple el formato esperado.");
  }
  return savedOrder;
}

function isOrder(order) {
  return (
    order &&
    typeof order.id === "string" &&
    typeof order.date === "string" &&
    typeof order.customerId === "string" &&
    typeof order.customerName === "string" &&
    order.shippingAddress &&
    typeof order.shippingAddress.name === "string" &&
    Array.isArray(order.items) &&
    order.items.every(
      (item) =>
        item &&
        typeof item.productId === "string" &&
        typeof item.name === "string" &&
        typeof item.sku === "string" &&
        Number.isFinite(item.unitPrice) &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0
    ) &&
    Number.isFinite(order.total) &&
    order.total >= 0 &&
    order.status === "pending"
  );
}
