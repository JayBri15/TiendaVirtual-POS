import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { createApp } from "./app.js";
import { createCatalogRepository } from "./catalogRepository.js";
import { createEmailSender } from "./emailSender.js";

// PORT permite cambiar el puerto al ejecutar el servidor en otros entornos.
const port = Number(process.env.PORT) || 3000;
const catalogRepository = createCatalogRepository();
const sessionSecretFile = resolve("backend/data/customer-session-secret");
if (!process.env.ADMIN_SESSION_SECRET) {
  mkdirSync(dirname(sessionSecretFile), { recursive: true });
  try {
    process.env.ADMIN_SESSION_SECRET = readFileSync(sessionSecretFile, "utf8").trim();
  } catch {
    process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString("hex");
    writeFileSync(sessionSecretFile, process.env.ADMIN_SESSION_SECRET, { mode: 0o600 });
  }
}
const codespacesBaseUrl =
  process.env.PUBLIC_BASE_URL ||
  (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `https://${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : undefined);
const emailSender = createEmailSender({
  ...process.env,
  ...(codespacesBaseUrl ? { PUBLIC_BASE_URL: codespacesBaseUrl } : {}),
});
const adminConfig = {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
  sessionSecret: process.env.ADMIN_SESSION_SECRET,
};
const app = createApp({ catalogRepository, adminConfig, emailSender });

if (!adminConfig.sessionSecret || Buffer.from(adminConfig.sessionSecret).length < 32) {
  console.warn(
    "Autenticación de clientes desactivada: define ADMIN_SESSION_SECRET con al menos 32 caracteres."
  );
}

if (emailSender.isConfigured) {
  emailSender.verifyConnection().catch((error) => {
    console.error(
      "No se pudo conectar al servidor SMTP. Revisa SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASSWORD.",
      error instanceof Error ? error.message : error
    );
  });
} else {
  console.warn(
    "Correo SMTP no configurado. Define SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM y PUBLIC_BASE_URL."
  );
}

app.listen(port, () => {
  console.log(`Backend disponible en http://localhost:${port}`);
});
