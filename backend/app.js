import express from "express";
import { createAdminAuth } from "./adminAuth.js";
import {
  CategoryValidationError,
  ProductValidationError,
  validateCategoryCreate,
  validateCategoryRename,
  validateProductCreate,
  validateProductUpdate,
} from "./productValidation.js";

const sessionCookieName = "amway_admin_session";
const loginWindowMilliseconds = 15 * 60 * 1000;
const maximumLoginAttempts = 5;

/**
 * Crea la API HTTP con su almacenamiento y autenticación opcional de Admin.
 * @param {{
 *   catalogRepository: {
 *     getCatalog: () => import("../src/JS/models.js").Catalog,
 *     createProduct: (product: import("../src/JS/models.js").Product) => void,
 *     updateProduct: (product: import("../src/JS/models.js").Product) => boolean,
 *     deleteProduct: (productId: string) => boolean
 *   },
 *   adminConfig?: {email?: string, password?: string, sessionSecret?: string},
 *   secureCookies?: boolean
 * }} options Dependencias de la API.
 * @returns {import("express").Express} Aplicación Express configurada.
 */
export function createApp({
  catalogRepository,
  adminConfig,
  secureCookies = process.env.NODE_ENV === "production",
}) {
  const app = express();
  const adminAuth = createAdminAuth(adminConfig);
  const failedLogins = new Map();

  // Las imágenes se envían como JSON; se limita el tamaño de cada solicitud.
  app.use(express.json({ limit: "4mb" }));

  // Ruta sencilla para confirmar que el proceso del backend está respondiendo.
  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      message: "Backend disponible",
    });
  });

  // La tienda consulta solo los datos públicos del catálogo.
  app.get("/api/products", (_request, response) => {
    response.json(catalogRepository.getCatalog());
  });

  app.get("/api/categories", (_request, response) => {
    response.json(catalogRepository.getCatalog().categories);
  });

  app.post("/api/categories", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;

    try {
      const category = validateCategoryCreate(request.body, catalogRepository.getCatalog());
      if (!catalogRepository.createCategory(category)) {
        return response.status(409).json({ error: "La categoría ya existe." });
      }
      return response.status(201).json(category);
    } catch (error) {
      if (error instanceof CategoryValidationError) {
        return response.status(400).json({ error: error.message });
      }
      console.error("No se pudo crear la categoría.", error);
      return response.status(500).json({ error: "No se pudo crear la categoría." });
    }
  });

  app.put("/api/categories/:name", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;

    try {
      const currentName = decodeURIComponent(request.params.name);
      const catalog = catalogRepository.getCatalog();
      if (!catalog.categories.some((category) => category === currentName)) {
        return response.status(404).json({ error: "No se encontró la categoría." });
      }

      const nextName = validateCategoryRename(currentName, request.body, catalog);
      if (!catalogRepository.updateCategory(currentName, nextName)) {
        return response
          .status(409)
          .json({ error: "La categoría ya existe o no se pudo actualizar." });
      }
      return response.json(nextName);
    } catch (error) {
      if (error instanceof CategoryValidationError) {
        return response.status(400).json({ error: error.message });
      }
      console.error("No se pudo actualizar la categoría.", error);
      return response.status(500).json({ error: "No se pudo actualizar la categoría." });
    }
  });

  app.delete("/api/categories/:name", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;

    try {
      const categoryName = decodeURIComponent(request.params.name);
      const catalog = catalogRepository.getCatalog();
      if (!catalog.categories.some((category) => category === categoryName)) {
        return response.status(404).json({ error: "No se encontró la categoría." });
      }
      if (catalog.products.some((product) => product.category === categoryName)) {
        return response
          .status(409)
          .json({ error: "No se puede eliminar una categoría con productos asociados." });
      }
      if (!catalogRepository.deleteCategory(categoryName)) {
        return response.status(409).json({ error: "No se pudo eliminar la categoría." });
      }
      return response.status(204).end();
    } catch (error) {
      console.error("No se pudo eliminar la categoría.", error);
      return response.status(500).json({ error: "No se pudo eliminar la categoría." });
    }
  });

  // El inicio de sesión crea una cookie firmada que nunca se expone a JavaScript.
  app.post("/api/admin/login", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!adminAuth.isConfigured) {
      return response.status(503).json({
        error: "Configura ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_SESSION_SECRET en el servidor.",
      });
    }
    if (!allowLoginAttempt(request.ip, response, failedLogins)) return;

    const { email, password } = request.body || {};
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      typeof password !== "string" ||
      password.length > 1024
    ) {
      return response.status(400).json({ error: "Ingresa un correo y una contraseña válidos." });
    }

    try {
      if (!(await adminAuth.verifyCredentials(email, password))) {
        recordFailedLogin(request.ip, failedLogins);
        return response.status(401).json({ error: "El correo o la contraseña no son correctos." });
      }

      failedLogins.delete(request.ip);
      const token = adminAuth.createSessionToken();
      response.setHeader("Set-Cookie", serializeSessionCookie(token, secureCookies));
      return response.json({ authenticated: true });
    } catch (error) {
      console.error("No se pudo validar el acceso de administrador.", error);
      return response.status(500).json({ error: "No se pudo validar el acceso." });
    }
  });

  app.get("/api/admin/session", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    return response.json({
      authenticated: adminAuth.isValidSession(readSessionCookie(request.get("cookie"))),
    });
  });

  app.post("/api/admin/logout", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    adminAuth.revokeSession(readSessionCookie(request.get("cookie")));
    response.setHeader("Set-Cookie", serializeSessionCookie("", secureCookies, true));
    return response.status(204).end();
  });

  // Las rutas de escritura exigen una sesión firmada por el backend.
  app.post("/api/products", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;

    try {
      const catalog = catalogRepository.getCatalog();
      const product = validateProductCreate(request.body, catalog);
      catalogRepository.createProduct(product);
      return response.status(201).json(product);
    } catch (error) {
      if (error instanceof ProductValidationError) {
        return response.status(400).json({ error: error.message });
      }
      console.error("No se pudo crear el producto.", error);
      return response.status(500).json({ error: "No se pudo crear el producto." });
    }
  });

  app.put("/api/products/:id", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;

    try {
      const catalog = catalogRepository.getCatalog();
      if (!catalog.products.some((product) => product.id === request.params.id)) {
        return response.status(404).json({ error: "No se encontró el producto." });
      }

      const product = validateProductUpdate(request.params.id, request.body, catalog);
      if (!catalogRepository.updateProduct(product)) {
        return response.status(404).json({ error: "No se encontró el producto." });
      }
      return response.json(product);
    } catch (error) {
      if (error instanceof ProductValidationError) {
        return response.status(400).json({ error: error.message });
      }
      console.error("No se pudo actualizar el producto.", error);
      return response.status(500).json({ error: "No se pudo actualizar el producto." });
    }
  });

  app.delete("/api/products/:id", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;

    try {
      if (!catalogRepository.deleteProduct(request.params.id)) {
        return response.status(404).json({ error: "No se encontró el producto." });
      }
      return response.status(204).end();
    } catch (error) {
      console.error("No se pudo eliminar el producto.", error);
      return response.status(500).json({ error: "No se pudo eliminar el producto." });
    }
  });

  // Responde con JSON legible si el cuerpo está mal formado o es demasiado grande.
  app.use((error, _request, response, next) => {
    if (error.type === "entity.parse.failed") {
      return response
        .status(400)
        .json({ error: "El cuerpo de la solicitud no contiene JSON válido." });
    }
    if (error.type === "entity.too.large") {
      return response
        .status(413)
        .json({ error: "El cuerpo de la solicitud supera el límite permitido." });
    }
    return next(error);
  });

  return app;
}

/**
 * Comprueba que el cliente tenga una sesión Admin válida.
 * @param {import("express").Request} request Solicitud HTTP entrante.
 * @param {import("express").Response} response Respuesta HTTP actual.
 * @param {ReturnType<typeof createAdminAuth>} adminAuth Verificador de sesiones.
 * @returns {boolean} Si la solicitud puede modificar datos.
 */
function authorizeAdmin(request, response, adminAuth) {
  if (!adminAuth.isConfigured) {
    response.status(503).json({
      error: "La edición está deshabilitada; configura las credenciales de Admin en el servidor.",
    });
    return false;
  }
  if (!adminAuth.isValidSession(readSessionCookie(request.get("cookie")))) {
    response.status(401).json({ error: "Inicia sesión como administrador para continuar." });
    return false;
  }
  return true;
}

/**
 * Bloquea intentos repetidos durante quince minutos por dirección de cliente.
 * @param {string} ip Dirección determinada por Express.
 * @param {import("express").Response} response Respuesta HTTP actual.
 * @param {Map<string, {attempts: number, resetAt: number}>} attempts Intentos recientes.
 * @returns {boolean} Si se permite procesar el intento.
 */
function allowLoginAttempt(ip, response, attempts) {
  const now = Date.now();
  for (const [address, attempt] of attempts) {
    if (attempt.resetAt <= now) attempts.delete(address);
  }
  const attempt = attempts.get(ip);
  if (!attempt || attempt.attempts < maximumLoginAttempts) return true;

  response.setHeader("Retry-After", String(Math.ceil((attempt.resetAt - now) / 1000)));
  response.status(429).json({ error: "Demasiados intentos. Espera antes de volver a probar." });
  return false;
}

/**
 * Registra un fallo de acceso dentro de una ventana de quince minutos.
 * @param {string} ip Dirección determinada por Express.
 * @param {Map<string, {attempts: number, resetAt: number}>} attempts Intentos recientes.
 */
function recordFailedLogin(ip, attempts) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.resetAt > now) {
    current.attempts += 1;
    return;
  }
  if (attempts.size >= 1000) attempts.delete(attempts.keys().next().value);
  attempts.set(ip, { attempts: 1, resetAt: now + loginWindowMilliseconds });
}

/**
 * Extrae la cookie de sesión y rechaza encabezados con valores duplicados.
 * @param {string|undefined} cookieHeader Encabezado Cookie entrante.
 */
function readSessionCookie(cookieHeader) {
  const prefix = `${sessionCookieName}=`;
  const values =
    cookieHeader
      ?.split(";")
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith(prefix)) || [];
  return values.length === 1 ? values[0].slice(prefix.length) : "";
}

/**
 * Serializa la cookie HttpOnly y SameSite; en producción exige HTTPS.
 * @param {string} token Sesión firmada por el backend.
 * @param {boolean} secure Si debe requerir HTTPS.
 * @param {boolean} clear Si debe borrar la cookie existente.
 */
function serializeSessionCookie(token, secure, clear = false) {
  const attributes = [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    clear ? "Max-Age=0" : "Max-Age=28800",
  ];
  if (secure) attributes.push("Secure");
  return `${sessionCookieName}=${token}; ${attributes.join("; ")}`;
}
