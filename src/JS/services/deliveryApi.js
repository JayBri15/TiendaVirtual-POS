import { announceAdminDataChange } from "./catalogStorage.js";

async function readSettings(path) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error(`El servidor devolvió una respuesta inválida (${response.status}).`, {
        cause: error,
      });
    }
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "No se pudieron leer los ajustes de entrega."
    );
  }
  const settings = await response.json();
  if (!isDeliverySettings(settings)) {
    throw new TypeError("Los ajustes de entrega no cumplen el formato esperado.");
  }
  return settings;
}

export function readDeliverySettings() {
  return readSettings("/api/delivery-settings");
}

export function readAdminDeliverySettings() {
  return readSettings("/api/admin/delivery-settings");
}

export async function updateAdminDeliverySettings(settings) {
  const response = await fetch("/api/admin/delivery-settings", {
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error(`El servidor devolvió una respuesta inválida (${response.status}).`, {
        cause: error,
      });
    }
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "No se pudieron guardar los ajustes de entrega."
    );
  }
  const savedSettings = await response.json();
  if (!isDeliverySettings(savedSettings)) {
    throw new TypeError("Los ajustes guardados no cumplen el formato esperado.");
  }
  announceAdminDataChange();
  return savedSettings;
}

function isDeliverySettings(settings) {
  return (
    settings &&
    typeof settings.dispatchEpsLocationId === "string" &&
    Number.isFinite(settings.epsPickupFee) &&
    Array.isArray(settings.availableEpsLocationIds) &&
    settings.availableEpsLocationIds.length > 0 &&
    settings.availableEpsLocationIds.every((id) => typeof id === "string") &&
    Array.isArray(settings.zones) &&
    settings.zones.length === 6 &&
    settings.zones.every(
      (zone) =>
        zone &&
        typeof zone.id === "string" &&
        typeof zone.name === "string" &&
        Number.isFinite(zone.fee)
    ) &&
    settings.municipalityZones &&
    typeof settings.municipalityZones === "object" &&
    !Array.isArray(settings.municipalityZones) &&
    Object.values(settings.municipalityZones).every((zoneId) => typeof zoneId === "string")
  );
}
