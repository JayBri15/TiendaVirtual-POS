import { getProvinceMunicipalities, MUNICIPALITIES, PROVINCES } from "dominican-republic-geodata";
import { EPS_LOCATIONS } from "./epsLocations.js";

export const DELIVERY_ZONES = [
  { id: "zone-1", name: "Zona 1 — Santo Domingo Este", fee: 3 },
  { id: "zone-2", name: "Zona 2 — Distrito Nacional", fee: 3.5 },
  { id: "zone-3", name: "Zona 3 — Santo Domingo Norte y Oeste", fee: 4 },
  { id: "zone-4", name: "Zona 4 — San Cristóbal y provincias cercanas", fee: 5 },
  { id: "zone-5", name: "Zona 5 — Santiago y principales ciudades del Cibao", fee: 6 },
  { id: "zone-6", name: "Zona 6 — Resto del país", fee: 7 },
];

const initialMunicipalityZones = Object.fromEntries(MUNICIPALITIES.map(({ id }) => [id, "zone-6"]));

function assignProvince(provinceName, zoneId, municipalityNames = null) {
  const province = PROVINCES.find(({ name }) => name === provinceName);
  if (!province) return;
  for (const municipality of getProvinceMunicipalities(province.id)) {
    if (!municipalityNames || municipalityNames.includes(municipality.name)) {
      initialMunicipalityZones[municipality.id] = zoneId;
    }
  }
}

assignProvince("Santo Domingo", "zone-1", ["Santo Domingo Este"]);
assignProvince("Distrito Nacional", "zone-2");
assignProvince("Santo Domingo", "zone-3", ["Santo Domingo Norte", "Santo Domingo Oeste"]);
assignProvince("San Cristóbal", "zone-4");
assignProvince("Santiago", "zone-5");

const dispatchLocation =
  EPS_LOCATIONS.find(({ name }) => name === "San Isidro") || EPS_LOCATIONS[0];

export const DEFAULT_DELIVERY_SETTINGS = {
  dispatchEpsLocationId: dispatchLocation.id,
  epsPickupFee: 2.49,
  availableEpsLocationIds: EPS_LOCATIONS.map(({ id }) => id),
  zones: DELIVERY_ZONES.map((zone) => ({ ...zone })),
  municipalityZones: initialMunicipalityZones,
};

export function getMunicipalityId(provinceName, municipalityName) {
  const province = PROVINCES.find(({ name }) => name === provinceName);
  return province
    ? getProvinceMunicipalities(province.id).find(({ name }) => name === municipalityName)?.id
    : undefined;
}

export function quoteDelivery(settings, deliveryMethod, address) {
  if (deliveryMethod === "eps") {
    return { fee: settings.epsPickupFee, zone: null };
  }
  if (deliveryMethod !== "address") return null;

  const municipalityId = getMunicipalityId(address?.region, address?.municipality);
  const zoneId = municipalityId && settings.municipalityZones[municipalityId];
  const zone = settings.zones.find((item) => item.id === zoneId);
  return zone ? { fee: zone.fee, zone } : null;
}
