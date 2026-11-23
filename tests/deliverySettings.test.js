import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateDeliverySettings } from "../backend/deliverySettingsValidation.js";
import { createCatalogRepository } from "../backend/catalogRepository.js";
import { OrderValidationError, validateOrderRequest } from "../backend/orderValidation.js";
import { DEFAULT_DELIVERY_SETTINGS, quoteDelivery } from "../shared/deliverySettings.js";

describe("tarifas y zonas de entrega", () => {
  it("cotiza las zonas iniciales, retiro EPS y ubicaciones sin cobertura", () => {
    assert.deepEqual(
      quoteDelivery(DEFAULT_DELIVERY_SETTINGS, "address", {
        region: "Santo Domingo",
        municipality: "Santo Domingo Este",
      }),
      {
        fee: 3,
        zone: {
          id: "zone-1",
          name: "Zona 1 — Santo Domingo Este",
          fee: 3,
        },
      }
    );
    assert.deepEqual(quoteDelivery(DEFAULT_DELIVERY_SETTINGS, "eps", {}), {
      fee: 2.49,
      zone: null,
    });
    assert.equal(
      quoteDelivery(DEFAULT_DELIVERY_SETTINGS, "address", {
        region: "Provincia inexistente",
        municipality: "Municipio inexistente",
      }),
      null
    );
  });

  it("valida las tarifas y rechaza municipios asignados a zonas desconocidas", () => {
    const settings = structuredClone(DEFAULT_DELIVERY_SETTINGS);
    settings.epsPickupFee = 3.12;
    settings.zones[0].fee = 4;
    assert.equal(validateDeliverySettings(settings).zones[0].fee, 4);

    settings.municipalityZones["DO-32-01"] = "zone-unknown";
    assert.throws(() => validateDeliverySettings(settings), /zona válida/);
  });

  it("conserva los ajustes editados al reiniciar el repositorio", () => {
    const directory = mkdtempSync(join(tmpdir(), "amway-shipping-settings-"));
    const databasePath = join(directory, "store.sqlite");
    let repository;
    try {
      repository = createCatalogRepository(databasePath);
      const settings = structuredClone(DEFAULT_DELIVERY_SETTINGS);
      settings.epsPickupFee = 2.8;
      repository.updateDeliverySettings(settings);
      repository.close();
      repository = null;
      repository = createCatalogRepository(databasePath);
      assert.equal(repository.getDeliverySettings().epsPickupFee, 2.8);
    } finally {
      repository?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("calcula el envío en el servidor y bloquea direcciones sin zona", () => {
    const request = {
      address: {
        name: "Cliente",
        phone: "555-0100",
        street: "Calle 1",
        city: "Santo Domingo Este",
        region: "Santo Domingo",
        municipality: "Santo Domingo Este",
        sector: "Sector",
        postalCode: "11501",
      },
      items: [{ productId: "product-1", quantity: 1 }],
    };
    const order = validateOrderRequest(request, DEFAULT_DELIVERY_SETTINGS);
    assert.equal(order.shippingCost, 3);
    assert.equal(order.deliveryZone.id, "zone-1");

    const uncoveredSettings = structuredClone(DEFAULT_DELIVERY_SETTINGS);
    delete uncoveredSettings.municipalityZones["DO-32-01"];
    assert.throws(
      () => validateOrderRequest(request, uncoveredSettings),
      (error) =>
        error instanceof OrderValidationError &&
        /no hay una zona de entrega asignada/i.test(error.message)
    );
  });

  it("rechaza retiros en sucursales deshabilitadas por Admin", () => {
    const settings = structuredClone(DEFAULT_DELIVERY_SETTINGS);
    const selectedLocation = settings.availableEpsLocationIds[0];
    settings.availableEpsLocationIds = settings.availableEpsLocationIds.filter(
      (id) => id !== selectedLocation
    );
    assert.throws(
      () =>
        validateOrderRequest(
          {
            deliveryMethod: "eps",
            epsLocationId: selectedLocation,
            address: { name: "Cliente", phone: "555-0100" },
            items: [{ productId: "product-1", quantity: 1 }],
          },
          settings
        ),
      (error) => error instanceof OrderValidationError && /sucursal EPS válida/.test(error.message)
    );
  });
});
