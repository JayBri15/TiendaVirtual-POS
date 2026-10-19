import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAdminAuth } from "../backend/adminAuth.js";

const validConfig = {
  email: "owner@example.test",
  password: "correct-test-password",
  sessionSecret: "test-session-secret-with-at-least-32-bytes",
};

describe("sesión segura de Admin", () => {
  it("valida credenciales configuradas solo en el servidor", async () => {
    const auth = createAdminAuth(validConfig);

    assert.equal(auth.isConfigured, true);
    assert.equal(await auth.verifyCredentials("OWNER@example.test", validConfig.password), true);
    assert.equal(await auth.verifyCredentials(validConfig.email, "contraseña incorrecta"), false);
    assert.equal(await auth.verifyCredentials("otro@example.test", validConfig.password), false);
  });

  it("firma, expira y revoca las sesiones", () => {
    const auth = createAdminAuth(validConfig);
    const now = 1_700_000_000_000;
    const token = auth.createSessionToken(now);
    const [payload, signature] = token.split(".");
    const alteredSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    assert.equal(auth.isValidSession(token, now), true);
    assert.equal(auth.isValidSession(`${payload}.${alteredSignature}`, now), false);
    assert.equal(auth.isValidSession(token, now + (8 * 60 * 60 + 1) * 1000), false);

    auth.revokeSession(token);
    assert.equal(auth.isValidSession(token, now), false);
  });

  it("deshabilita el acceso si falta un secreto fuerte o la contraseña es corta", () => {
    const auth = createAdminAuth({
      email: validConfig.email,
      password: "short",
      sessionSecret: "this-session-secret-is-long-enough",
    });

    assert.equal(auth.isConfigured, false);
    assert.equal(auth.isValidSession("anything"), false);
    assert.throws(() => auth.createSessionToken(), /no está configurada/);
  });
});
