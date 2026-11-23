import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProvinceMunicipalities, PROVINCES } from "dominican-republic-geodata";

describe("división territorial dominicana para entrega", () => {
  it("ofrece provincias y municipios dependientes de la provincia elegida", () => {
    assert.equal(PROVINCES.length, 32);
    const santoDomingo = PROVINCES.find((province) => province.name === "Santo Domingo");
    assert.ok(santoDomingo);

    const municipalities = getProvinceMunicipalities(santoDomingo.id);
    assert.ok(municipalities.some((municipality) => municipality.name === "Santo Domingo Este"));
    assert.ok(!municipalities.some((municipality) => municipality.name === "Santiago"));
  });
});
