import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPhoneNumber } from "../src/JS/shared/format.js";

describe("formato de teléfonos", () => {
  it("separa teléfonos dominicanos de diez dígitos", () => {
    assert.equal(formatPhoneNumber("8095551234"), "809-555-1234");
    assert.equal(formatPhoneNumber("809-555-1234"), "809-555-1234");
  });

  it("preserva el código de país en teléfonos de once dígitos", () => {
    assert.equal(formatPhoneNumber("+18095551234"), "+1-809-555-1234");
  });

  it("deja intactos los números con formatos no reconocidos", () => {
    assert.equal(formatPhoneNumber("555-1234"), "555-1234");
    assert.equal(formatPhoneNumber(""), "");
  });
});
