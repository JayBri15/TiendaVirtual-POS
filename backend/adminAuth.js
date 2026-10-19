import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;
const sessionDurationSeconds = 8 * 60 * 60;

/**
 * Prepara la verificación de una cuenta Admin configurada solo en el servidor.
 * @param {{email?: string, password?: string, sessionSecret?: string}} [config]
 */
export function createAdminAuth({
  email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD,
  sessionSecret = process.env.ADMIN_SESSION_SECRET,
} = {}) {
  const adminEmail = typeof email === "string" ? email.trim().toLocaleLowerCase("en-US") : "";
  const adminPassword = typeof password === "string" ? password : "";
  const secret = typeof sessionSecret === "string" ? Buffer.from(sessionSecret) : null;
  const configured =
    adminEmail.includes("@") &&
    adminEmail.length <= 254 &&
    adminPassword.length >= 12 &&
    adminPassword.length <= 1024 &&
    secret !== null &&
    secret.length >= 32;
  const activeSessions = new Map();
  const salt = randomBytes(16);
  const passwordHash = configured ? scryptSync(adminPassword, salt, passwordKeyLength) : null;

  return {
    isConfigured: configured,
    async verifyCredentials(candidateEmail, candidatePassword) {
      if (!configured) return false;

      const submittedEmail =
        typeof candidateEmail === "string" ? candidateEmail.trim().toLocaleLowerCase("en-US") : "";
      const submittedPassword = typeof candidatePassword === "string" ? candidatePassword : "";
      const candidateHash = await scrypt(submittedPassword, salt, passwordKeyLength);
      const emailMatches = submittedEmail === adminEmail;
      const passwordMatches = passwordHash !== null && timingSafeEqual(candidateHash, passwordHash);
      return emailMatches && passwordMatches;
    },
    createSessionToken(now = Date.now()) {
      if (!configured || secret === null) {
        throw new Error("La autenticación de administrador no está configurada.");
      }

      const expiresAt = Math.floor(now / 1000) + sessionDurationSeconds;
      for (const [id, expiry] of activeSessions) {
        if (expiry <= Math.floor(now / 1000)) activeSessions.delete(id);
      }
      if (activeSessions.size >= 1000) activeSessions.delete(activeSessions.keys().next().value);
      const id = randomBytes(32).toString("base64url");
      activeSessions.set(id, expiresAt);
      const payload = Buffer.from(JSON.stringify({ id, expiresAt })).toString("base64url");
      const signature = createHmac("sha256", secret).update(payload).digest("base64url");
      return `${payload}.${signature}`;
    },
    isValidSession(token, now = Date.now()) {
      const session = readSignedSession(token, secret, configured);
      return (
        session !== null &&
        session.expiresAt > Math.floor(now / 1000) &&
        activeSessions.get(session.id) === session.expiresAt
      );
    },
    revokeSession(token) {
      const session = readSignedSession(token, secret, configured);
      if (session) activeSessions.delete(session.id);
    },
  };
}

/**
 * Verifica firma y formato de una sesión sin confiar en sus datos.
 * @param {string} token Cookie de sesión recibida del navegador.
 * @param {Buffer|null} secret Clave privada del servidor.
 * @param {boolean} configured Si la autenticación está configurada.
 */
function readSignedSession(token, secret, configured) {
  if (!configured || secret === null || typeof token !== "string" || token.length > 256) {
    return null;
  }
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expectedSignature = createHmac("sha256", secret).update(payload).digest();
  const suppliedSignature = Buffer.from(signature, "base64url");
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      typeof session.id !== "string" ||
      !Number.isSafeInteger(session.expiresAt) ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.id)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
