import nodemailer from "nodemailer";

/**
 * Prepara el envío de correo transaccional con SMTP configurado solo en el servidor.
 * @param {NodeJS.ProcessEnv} [config] Variables de entorno; se puede inyectar config en pruebas.
 * @param {(options: object) => {sendMail: (message: object) => Promise<unknown>}} [createTransport]
 */
export function createEmailSender(
  config = process.env,
  createTransport = nodemailer.createTransport
) {
  const host = config.SMTP_HOST?.trim() || "";
  const port = Number(config.SMTP_PORT || 587);
  const user = config.SMTP_USER || "";
  const password = config.SMTP_PASSWORD || "";
  const from = config.SMTP_FROM?.trim() || "";
  const baseUrl = readPublicBaseUrl(
    config.PUBLIC_BASE_URL,
    (config.NODE_ENV || process.env.NODE_ENV) !== "production"
  );
  const authConfigured = Boolean(user && password);
  const configured =
    Boolean(host && from && baseUrl) &&
    Boolean((user === "" && password === "") || authConfigured) &&
    Number.isSafeInteger(port) &&
    port > 0 &&
    port <= 65535;
  const secure = config.SMTP_SECURE === "true" || port === 465;
  const transporter = configured
    ? createTransport({
        host,
        port,
        secure,
        ...(authConfigured ? { auth: { user, pass: password } } : {}),
        requireTLS: !secure,
        tls: { minVersion: "TLSv1.2" },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      })
    : null;

  return {
    isConfigured: configured,
    async verifyConnection() {
      if (!transporter) throw new Error("El correo SMTP no está configurado.");
      await transporter.verify();
    },
    createAccountLink(route, token) {
      if (!configured || !baseUrl) throw new Error("El correo SMTP no está configurado.");
      return `${baseUrl}/#${route}/${encodeURIComponent(token)}`;
    },
    async sendVerificationEmail(email, link) {
      await sendMessage(
        transporter,
        from,
        email,
        "Verifica tu correo de Amway",
        `Para verificar tu dirección de correo, abre este enlace (válido por 24 horas):\n\n${link}\n\nSi no creaste esta cuenta, puedes ignorar este mensaje.`
      );
    },
    async sendPasswordResetEmail(email, link) {
      await sendMessage(
        transporter,
        from,
        email,
        "Restablece tu contraseña de Amway",
        `Para elegir una contraseña nueva, abre este enlace (válido por 1 hora):\n\n${link}\n\nSi no solicitaste el cambio, puedes ignorar este mensaje.`
      );
    },
  };
}

function readPublicBaseUrl(value, allowLocalHttp) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      (url.protocol === "http:" &&
        (!allowLocalHttp || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

async function sendMessage(transporter, from, to, subject, text) {
  if (!transporter) throw new Error("El correo SMTP no está configurado.");
  const escapedLink = text.match(/https?:\/\/[^\s]+/)?.[0] || "";
  const htmlText = text
    .split("\n\n")
    .map((paragraph) =>
      paragraph === escapedLink
        ? `<p><a href="${escapedLink}">${escapedLink}</a></p>`
        : `<p>${paragraph.replaceAll("\n", "<br>")}</p>`
    )
    .join("");
  await transporter.sendMail({ from, to, subject, text, html: `<div>${htmlText}</div>` });
}
