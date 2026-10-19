import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmailSender } from "../backend/emailSender.js";

const SMTP_CONFIG = {
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_USER: "mailer@example.test",
  SMTP_PASSWORD: "mail-secret-for-tests",
  SMTP_FROM: "Amway <mailer@example.test>",
  PUBLIC_BASE_URL: "https://store.example.test",
  NODE_ENV: "production",
};

describe("envío de correo SMTP", () => {
  it("configura transporte TLS y prepara mensajes de verificación y recuperación", async () => {
    const transports = [];
    const messages = [];
    const sender = createEmailSender(SMTP_CONFIG, (options) => {
      transports.push(options);
      return { sendMail: async (message) => messages.push(message) };
    });

    assert.equal(sender.isConfigured, true);
    assert.equal(createEmailSender(SMTP_CONFIG).isConfigured, true);
    assert.equal(
      sender.createAccountLink("verificar-correo", "token_123"),
      "https://store.example.test/#verificar-correo/token_123"
    );
    await sender.sendVerificationEmail("customer@example.test", "https://store.test/verify");
    await sender.sendPasswordResetEmail("customer@example.test", "https://store.test/reset");

    assert.deepEqual(transports[0], {
      host: "smtp.example.test",
      port: 587,
      secure: false,
      auth: { user: "mailer@example.test", pass: "mail-secret-for-tests" },
      requireTLS: true,
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    assert.equal(messages[0].to, "customer@example.test");
    assert.match(messages[0].text, /válido por 24 horas/);
    assert.match(messages[1].text, /válido por 1 hora/);
    assert.equal("html" in messages[0], false);
  });

  it("deshabilita el envío si faltan credenciales o la URL pública no es HTTPS", () => {
    const missing = createEmailSender({}, () => {
      throw new Error("No debe crear un transporte sin configuración.");
    });
    assert.equal(missing.isConfigured, false);
    assert.throws(() => missing.createAccountLink("verificar-correo", "token"));

    const insecureProduction = createEmailSender(
      { ...SMTP_CONFIG, PUBLIC_BASE_URL: "http://store.example.test" },
      () => ({ sendMail: async () => {} })
    );
    assert.equal(insecureProduction.isConfigured, false);
  });
});
