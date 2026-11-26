/** Formatea importes de la aplicación en dólares con convenciones regionales. */
export function money(amount) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount) || 0);
}

/** Genera identificadores únicos para registros locales del prototipo. */
export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Presenta números dominicanos de 10 dígitos con guiones sin alterar otros formatos. */
export function formatPhoneNumber(phone = "") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
