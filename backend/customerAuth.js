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
 * Prepara el hash de contraseñas de clientes y las sesiones de navegador.
 * @param {string|undefined} sessionSecret Secreto de sesión configurado en el servidor.
 */
export function createCustomerAuth(sessionSecret = process.env.ADMIN_SESSION_SECRET) {
  const secret = typeof sessionSecret === "string" ? Buffer.from(sessionSecret) : null;
  const configured = secret !== null && secret.length >= 32;
  const activeSessions = new Map();
  const dummySalt = randomBytes(16);
  const dummyHash = scryptSync(randomBytes(32), dummySalt, passwordKeyLength);

  return {
    isConfigured: configured,
    async hashPassword(password) {
      if (!configured) throw new Error("La autenticación de clientes no está configurada.");
      const salt = randomBytes(16);
      const passwordHash = await scrypt(password, salt, passwordKeyLength);
      return {
        salt: salt.toString("base64url"),
        passwordHash: Buffer.from(passwordHash).toString("base64url"),
      };
    },
    async verifyPassword(password, account) {
      const salt = account ? Buffer.from(account.salt, "base64url") : dummySalt;
      const expectedHash = account ? Buffer.from(account.passwordHash, "base64url") : dummyHash;
      const candidateHash = Buffer.from(await scrypt(password, salt, passwordKeyLength));
      return (
        account !== null &&
        account !== undefined &&
        expectedHash.length === candidateHash.length &&
        timingSafeEqual(candidateHash, expectedHash)
      );
    },
    createSessionToken(customerId, now = Date.now()) {
      if (!configured || !secret) {
        throw new Error("La autenticación de clientes no está configurada.");
      }
      const nowSeconds = Math.floor(now / 1000);
      for (const [id, session] of activeSessions) {
        if (session.expiresAt <= nowSeconds) activeSessions.delete(id);
      }
      if (activeSessions.size >= 10000) activeSessions.delete(activeSessions.keys().next().value);

      const id = randomBytes(32).toString("base64url");
      const expiresAt = nowSeconds + sessionDurationSeconds;
      activeSessions.set(id, { customerId, expiresAt });
      const payload = Buffer.from(JSON.stringify({ id, customerId, expiresAt })).toString(
        "base64url"
      );
      const signature = createHmac("sha256", secret).update(payload).digest("base64url");
      return `${payload}.${signature}`;
    },
    readSession(token, now = Date.now()) {
      const session = readSignedSession(token, secret, configured);
      if (!session || session.expiresAt <= Math.floor(now / 1000)) return null;
      const active = activeSessions.get(session.id);
      return active?.expiresAt === session.expiresAt && active.customerId === session.customerId
        ? session.customerId
        : null;
    },
    revokeSession(token) {
      const session = readSignedSession(token, secret, configured);
      if (session) activeSessions.delete(session.id);
    },
    revokeCustomerSessions(customerId) {
      for (const [id, session] of activeSessions) {
        if (session.customerId === customerId) activeSessions.delete(id);
      }
    },
  };
}

function readSignedSession(token, secret, configured) {
  if (!configured || !secret || typeof token !== "string" || token.length > 512) return null;
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
      !/^[A-Za-z0-9_-]{43}$/.test(session.id) ||
      typeof session.customerId !== "string" ||
      !Number.isSafeInteger(session.expiresAt)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
