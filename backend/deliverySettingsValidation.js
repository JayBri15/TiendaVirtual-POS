import { MUNICIPALITIES } from "dominican-republic-geodata";
import { DELIVERY_ZONES } from "../shared/deliverySettings.js";
import { EPS_LOCATIONS } from "../shared/epsLocations.js";

const zoneIds = new Set(DELIVERY_ZONES.map(({ id }) => id));
const municipalityIds = new Set(MUNICIPALITIES.map(({ id }) => id));

export class DeliverySettingsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeliverySettingsValidationError";
  }
}

export function validateDeliverySettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeliverySettingsValidationError("Los ajustes de entrega no son válidos.");
  }
  if (!EPS_LOCATIONS.some(({ id }) => id === value.dispatchEpsLocationId)) {
    throw new DeliverySettingsValidationError("Selecciona una sucursal EPS de despacho válida.");
  }
  const epsPickupFee = validateFee(value.epsPickupFee, "La tarifa de retiro EPS");
  if (
    !Array.isArray(value.availableEpsLocationIds) ||
    value.availableEpsLocationIds.length === 0 ||
    new Set(value.availableEpsLocationIds).size !== value.availableEpsLocationIds.length ||
    value.availableEpsLocationIds.some(
      (id) => !EPS_LOCATIONS.some((location) => location.id === id)
    )
  ) {
    throw new DeliverySettingsValidationError("Mantén al menos una sucursal EPS disponible.");
  }
  if (!Array.isArray(value.zones) || value.zones.length !== DELIVERY_ZONES.length) {
    throw new DeliverySettingsValidationError("Configura las seis zonas de entrega.");
  }
  const zonesById = new Map(value.zones.map((zone) => [zone?.id, zone]));
  if (zonesById.size !== DELIVERY_ZONES.length) {
    throw new DeliverySettingsValidationError("Cada zona debe aparecer una sola vez.");
  }
  const zones = DELIVERY_ZONES.map((definition) => {
    const zone = zonesById.get(definition.id);
    if (!zone) throw new DeliverySettingsValidationError("Falta configurar una zona.");
    return {
      ...definition,
      fee: validateFee(zone.fee, `La tarifa de ${definition.name}`),
    };
  });
  if (
    !value.municipalityZones ||
    typeof value.municipalityZones !== "object" ||
    Array.isArray(value.municipalityZones)
  ) {
    throw new DeliverySettingsValidationError("Asigna las ubicaciones a sus zonas.");
  }
  const municipalityZones = {};
  for (const [municipalityId, zoneId] of Object.entries(value.municipalityZones)) {
    if (!municipalityIds.has(municipalityId)) {
      throw new DeliverySettingsValidationError("La lista contiene un municipio no reconocido.");
    }
    if (!zoneIds.has(zoneId)) {
      throw new DeliverySettingsValidationError("Selecciona una zona válida para cada municipio.");
    }
    municipalityZones[municipalityId] = zoneId;
  }
  return {
    dispatchEpsLocationId: value.dispatchEpsLocationId,
    epsPickupFee,
    availableEpsLocationIds: [...value.availableEpsLocationIds],
    zones,
    municipalityZones,
  };
}

function validateFee(value, label) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 10000 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-8
  ) {
    throw new DeliverySettingsValidationError(
      `${label} debe ser un importe entre US$0.00 y US$10,000.00.`
    );
  }
  return Math.round(value * 100) / 100;
}
