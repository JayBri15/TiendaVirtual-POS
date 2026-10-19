import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { createAdminAuth } from "./adminAuth.js";
import { createCustomerAuth } from "./customerAuth.js";
import { StoreOperationError } from "./catalogRepository.js";
import { createEmailSender } from "./emailSender.js";
import {
  CustomerAccountValidationError,
  validateCustomerPassword,
  validateCustomerRegistration,
} from "./customerAccountValidation.js";
import { CustomerValidationError, validateCustomer } from "./customerValidation.js";
import { OrderValidationError, validateOrderRequest } from "./orderValidation.js";
import { SaleValidationError, validateSaleRequest } from "./saleValidation.js";
import {
  CategoryValidationError,
  ProductValidationError,
  validateCategoryCreate,
  validateCategoryRename,
  validateProductCreate,
  validateProductUpdate,
} from "./productValidation.js";

const sessionCookieName = "amway_admin_session";
const customerSessionCookieName = "amway_customer_session";
const loginWindowMilliseconds = 15 * 60 * 1000;
const maximumLoginAttempts = 5;

/**
 * Crea la API HTTP con su almacenamiento y autenticación opcional de Admin.
 * @param {{
 *   catalogRepository: {
 *     getCatalog: () => import("../src/JS/models.js").Catalog,
 *     createProduct: (product: import("../src/JS/models.js").Product) => void,
 *     updateProduct: (product: import("../src/JS/models.js").Product) => boolean,
 *     deleteProduct: (productId: string) => boolean,
 *     createCategory: (category: import("../src/JS/models.js").Category) => boolean,
 *     updateCategory: (currentName: string, category: import("../src/JS/models.js").Category) => boolean,
 *     deleteCategory: (categoryName: string) => boolean,
 *     getAdminData: () => {customers: import("../src/JS/models.js").Customer[], sales: import("../src/JS/models.js").Sale[]},
 *     createCustomer: (customer: import("../src/JS/models.js").Customer) => void,
 *     updateCustomer: (customer: import("../src/JS/models.js").Customer) => boolean,
 *     deleteCustomer: (customerId: string) => boolean,
 *     createSale: (sale: {customerId: string|null, paymentMethod: string, items: Array<{productId: string, quantity: number}>}) => import("../src/JS/models.js").Sale,
 *     voidSale: (saleId: string) => import("../src/JS/models.js").Sale,
 *     createCustomerAccount: (customer: import("../src/JS/models.js").Customer, credentials: {salt: string, passwordHash: string}) => void,
 *     getCustomerAccountByEmail: (email: string) => ({id: string, salt: string, passwordHash: string}|undefined),
 *     getCustomerById: (customerId: string) => (import("../src/JS/models.js").Customer|undefined),
 *     isCustomerEmailVerified: (customerId: string) => boolean,
 *     createAccountToken: (customerId: string, purpose: "verify-email"|"reset-password", tokenHash: string, expiresAt: number) => void,
 *     verifyCustomerEmail: (tokenHash: string, now: number) => (import("../src/JS/models.js").Customer|null),
 *     resetCustomerPassword: (tokenHash: string, credentials: {salt: string, passwordHash: string}, now: number) => (import("../src/JS/models.js").Customer|null),
 *     createOrder: (customerId: string, order: object) => import("../src/JS/models.js").Order,
 *     getOrders: () => import("../src/JS/models.js").Order[],
 *     confirmOrder: (orderId: string) => import("../src/JS/models.js").Order,
 *     cancelOrder: (orderId: string) => import("../src/JS/models.js").Order,
 *     hasActiveFulfillmentForProduct: (productId: string) => boolean
 *   },
 *   adminConfig?: {email?: string, password?: string, sessionSecret?: string},
 *   emailSender?: ReturnType<typeof createEmailSender>,
 *   secureCookies?: boolean
 * }} options Dependencias de la API.
 * @returns {import("express").Express} Aplicación Express configurada.
 */
export function createApp({
  catalogRepository,
  adminConfig,
  emailSender = createEmailSender(),
  secureCookies = process.env.NODE_ENV === "production",
}) {
  const app = express();
  const adminAuth = createAdminAuth(adminConfig);
  const customerAuth = createCustomerAuth(adminConfig?.sessionSecret);
  const failedLogins = new Map();
  const failedCustomerLogins = new Map();
  const customerRegistrations = new Map();
  const customerEmailActions = new Map();
  const customerTokenActions = new Map();

  // Las imágenes se envían como JSON; se limita el tamaño de cada solicitud.
  app.use(express.json({ limit: "4mb" }));

  // Ruta sencilla para confirmar que el proceso del backend está respondiendo.
  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      message: "Backend disponible",
    });
  });

  // El registro público crea credenciales seguras y una sesión de cliente.
  app.post("/api/account/register", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!customerAuth.isConfigured) {
      return response.status(503).json({
        error: "Configura ADMIN_SESSION_SECRET con al menos 32 bytes para habilitar cuentas.",
      });
    }
    if (!emailSender.isConfigured) {
      return response.status(503).json({
        error:
          "Configura SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM y PUBLIC_BASE_URL para crear cuentas.",
      });
    }
    if (!allowLoginAttempt(request.ip, response, customerRegistrations)) return;
    recordFailedLogin(request.ip, customerRegistrations);

    try {
      const { customer, password } = validateCustomerRegistration(
        request.body,
        catalogRepository.getAdminData().customers
      );
      const credentials = await customerAuth.hashPassword(password);
      catalogRepository.createCustomerAccount(customer, credentials);
      const { token, tokenHash } = createRawAccountToken();
      catalogRepository.createAccountToken(
        customer.id,
        "verify-email",
        tokenHash,
        Date.now() + 24 * 60 * 60 * 1000
      );
      try {
        await emailSender.sendVerificationEmail(
          customer.email,
          emailSender.createAccountLink("verificar-correo", token)
        );
      } catch (error) {
        console.error("La cuenta se creó, pero no se pudo enviar la verificación.", error);
        return response.status(503).json({
          error:
            "La cuenta se creó, pero no se pudo enviar el correo. Intenta reenviar la verificación.",
        });
      }
      return response.status(201).json({ customer, verificationRequired: true });
    } catch (error) {
      if (error instanceof CustomerAccountValidationError) {
        return response.status(400).json({ error: error.message });
      }
      if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return response.status(409).json({ error: "Ya existe una cuenta con ese correo." });
      }
      console.error("No se pudo crear la cuenta de cliente.", error);
      return response.status(500).json({ error: "No se pudo crear la cuenta." });
    }
  });

  app.post("/api/account/verify-email", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!customerAuth.isConfigured) {
      return response
        .status(503)
        .json({ error: "La autenticación de clientes no está configurada." });
    }
    if (!allowLoginAttempt(request.ip, response, customerTokenActions)) return;
    recordFailedLogin(request.ip, customerTokenActions);
    const token = request.body?.token;
    if (!isAccountToken(token)) {
      return response.status(400).json({ error: "El enlace de verificación no es válido." });
    }
    try {
      const customer = catalogRepository.verifyCustomerEmail(hashAccountToken(token), Date.now());
      if (!customer) {
        return response.status(400).json({
          error: "El enlace venció o ya se utilizó. Solicita uno nuevo.",
        });
      }
      const session = customerAuth.createSessionToken(customer.id);
      response.setHeader("Set-Cookie", serializeCustomerSessionCookie(session, secureCookies));
      return response.json({ customer });
    } catch (error) {
      console.error("No se pudo verificar el correo del cliente.", error);
      return response.status(500).json({ error: "No se pudo verificar el correo." });
    }
  });

  app.post("/api/account/verification/resend", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!customerAuth.isConfigured) {
      return response
        .status(503)
        .json({ error: "La autenticación de clientes no está configurada." });
    }
    if (!emailSender.isConfigured) {
      return response
        .status(503)
        .json({ error: "El servicio de correo SMTP no está configurado." });
    }
    if (!allowLoginAttempt(request.ip, response, customerEmailActions)) return;
    recordFailedLogin(request.ip, customerEmailActions);
    const email = request.body?.email;
    if (!isEmailAddress(email)) {
      return response.status(400).json({ error: "Ingresa un correo válido." });
    }

    try {
      const account = catalogRepository.getCustomerAccountByEmail(email.trim());
      if (account && account.emailVerified !== 1) {
        const { token, tokenHash } = createRawAccountToken();
        catalogRepository.createAccountToken(
          account.id,
          "verify-email",
          tokenHash,
          Date.now() + 24 * 60 * 60 * 1000
        );
        try {
          await emailSender.sendVerificationEmail(
            account.email,
            emailSender.createAccountLink("verificar-correo", token)
          );
        } catch (error) {
          console.error("No se pudo enviar el correo de verificación.", error);
        }
      }
      return response.status(202).json({
        message: "Si esa cuenta existe y necesita verificación, enviaremos un enlace al correo.",
      });
    } catch (error) {
      console.error("No se pudo preparar el reenvío de verificación.", error);
      return response.status(500).json({ error: "No se pudo procesar la solicitud." });
    }
  });

  app.post("/api/account/password-reset/request", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!customerAuth.isConfigured) {
      return response
        .status(503)
        .json({ error: "La autenticación de clientes no está configurada." });
    }
    if (!emailSender.isConfigured) {
      return response
        .status(503)
        .json({ error: "El servicio de correo SMTP no está configurado." });
    }
    if (!allowLoginAttempt(request.ip, response, customerEmailActions)) return;
    recordFailedLogin(request.ip, customerEmailActions);
    const email = request.body?.email;
    if (!isEmailAddress(email)) {
      return response.status(400).json({ error: "Ingresa un correo válido." });
    }

    try {
      const account = catalogRepository.getCustomerAccountByEmail(email.trim());
      if (account?.emailVerified === 1) {
        const { token, tokenHash } = createRawAccountToken();
        catalogRepository.createAccountToken(
          account.id,
          "reset-password",
          tokenHash,
          Date.now() + 60 * 60 * 1000
        );
        try {
          await emailSender.sendPasswordResetEmail(
            account.email,
            emailSender.createAccountLink("restablecer-contrasena", token)
          );
        } catch (error) {
          console.error("No se pudo enviar el correo para restablecer la contraseña.", error);
        }
      }
      return response.status(202).json({
        message: "Si existe una cuenta verificada con ese correo, enviaremos instrucciones.",
      });
    } catch (error) {
      console.error("No se pudo preparar el restablecimiento de la contraseña.", error);
      return response.status(500).json({ error: "No se pudo procesar la solicitud." });
    }
  });

  app.post("/api/account/password-reset/complete", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!customerAuth.isConfigured) {
      return response
        .status(503)
        .json({ error: "La autenticación de clientes no está configurada." });
    }
    if (!allowLoginAttempt(request.ip, response, customerTokenActions)) return;
    recordFailedLogin(request.ip, customerTokenActions);
    const token = request.body?.token;
    if (!isAccountToken(token)) {
      return response
        .status(400)
        .json({ error: "El enlace para cambiar la contraseña no es válido." });
    }
    let password;
    try {
      password = validateCustomerPassword(request.body?.password);
    } catch (error) {
      if (error instanceof CustomerAccountValidationError) {
        return response.status(400).json({ error: error.message });
      }
      console.error("No se pudo validar la nueva contraseña.", error);
      return response.status(500).json({ error: "No se pudo validar la contraseña." });
    }

    try {
      const credentials = await customerAuth.hashPassword(password);
      const customer = catalogRepository.resetCustomerPassword(
        hashAccountToken(token),
        credentials,
        Date.now()
      );
      if (!customer) {
        return response.status(400).json({
          error: "El enlace venció o ya se utilizó. Solicita otro para continuar.",
        });
      }
      customerAuth.revokeCustomerSessions(customer.id);
      response.setHeader("Set-Cookie", serializeCustomerSessionCookie("", secureCookies, true));
      return response.json({ passwordReset: true });
    } catch (error) {
      console.error("No se pudo restablecer la contraseña del cliente.", error);
      return response.status(500).json({ error: "No se pudo restablecer la contraseña." });
    }
  });

  // La respuesta de inicio de sesión no revela si existe el correo indicado.
  app.post("/api/account/login", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!customerAuth.isConfigured) {
      return response
        .status(503)
        .json({ error: "La autenticación de clientes no está configurada." });
    }
    if (!allowLoginAttempt(request.ip, response, failedCustomerLogins)) return;

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
      const account = catalogRepository.getCustomerAccountByEmail(email.trim());
      if (!(await customerAuth.verifyPassword(password, account))) {
        recordFailedLogin(request.ip, failedCustomerLogins);
        return response.status(401).json({ error: "El correo o la contraseña no son correctos." });
      }
      if (account.emailVerified !== 1) {
        return response.status(403).json({
          error: "Verifica tu correo antes de iniciar sesión. Puedes solicitar otro enlace.",
        });
      }
      failedCustomerLogins.delete(request.ip);
      const customer = catalogRepository.getCustomerById(account.id);
      if (!customer) {
        return response.status(401).json({ error: "El correo o la contraseña no son correctos." });
      }
      const token = customerAuth.createSessionToken(customer.id);
      response.setHeader("Set-Cookie", serializeCustomerSessionCookie(token, secureCookies));
      return response.json({ customer });
    } catch (error) {
      console.error("No se pudo validar el acceso del cliente.", error);
      return response.status(500).json({ error: "No se pudo validar el acceso." });
    }
  });

  app.get("/api/account/session", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const token = readNamedCookie(request.get("cookie"), customerSessionCookieName);
    const customerId = customerAuth.readSession(token);
    const customer =
      customerId && catalogRepository.isCustomerEmailVerified(customerId)
        ? catalogRepository.getCustomerById(customerId)
        : null;
    if (customerId && !customer) customerAuth.revokeSession(token);
    return response.json({ authenticated: Boolean(customer), customer: customer || null });
  });

  app.post("/api/account/logout", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const token = readNamedCookie(request.get("cookie"), customerSessionCookieName);
    customerAuth.revokeSession(token);
    response.setHeader("Set-Cookie", serializeCustomerSessionCookie("", secureCookies, true));
    return response.status(204).end();
  });

  // Un pedido requiere la sesión de cliente; el backend vuelve a consultar precios y stock.
  app.post("/api/orders", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const customerId = customerAuth.readSession(
      readNamedCookie(request.get("cookie"), customerSessionCookieName)
    );
    if (
      !customerId ||
      !catalogRepository.isCustomerEmailVerified(customerId) ||
      !catalogRepository.getCustomerById(customerId)
    ) {
      return response.status(401).json({ error: "Inicia sesión para crear un pedido." });
    }
    try {
      const order = validateOrderRequest(request.body);
      return response.status(201).json(catalogRepository.createOrder(customerId, order));
    } catch (error) {
      if (error instanceof OrderValidationError) {
        return response.status(400).json({ error: error.message });
      }
      if (error instanceof StoreOperationError) {
        const status = error.code === "PRODUCT_NOT_FOUND" ? 404 : 409;
        return response.status(status).json({ error: error.message });
      }
      console.error("No se pudo crear el pedido.", error);
      return response.status(500).json({ error: "No se pudo crear el pedido." });
    }
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
      const currentName = request.params.name;
      const catalog = catalogRepository.getCatalog();
      if (!catalog.categories.some((category) => category.name === currentName)) {
        return response.status(404).json({ error: "No se encontró la categoría." });
      }

      const category = validateCategoryRename(currentName, request.body, catalog);
      if (!catalogRepository.updateCategory(currentName, category)) {
        return response
          .status(409)
          .json({ error: "La categoría ya existe o no se pudo actualizar." });
      }
      return response.json(category);
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
      const categoryName = request.params.name;
      const catalog = catalogRepository.getCatalog();
      if (!catalog.categories.some((category) => category.name === categoryName)) {
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
  app.get("/api/admin/customers", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    response.setHeader("Cache-Control", "no-store");
    return response.json(catalogRepository.getAdminData().customers);
  });

  app.post("/api/admin/customers", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    try {
      const { customers } = catalogRepository.getAdminData();
      const customer = validateCustomer(request.body, customers);
      catalogRepository.createCustomer(customer);
      return response.status(201).json(customer);
    } catch (error) {
      if (error instanceof CustomerValidationError) {
        return response.status(400).json({ error: error.message });
      }
      console.error("No se pudo crear el cliente.", error);
      return response.status(500).json({ error: "No se pudo crear el cliente." });
    }
  });

  app.put("/api/admin/customers/:id", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    try {
      const { customers } = catalogRepository.getAdminData();
      if (!customers.some((customer) => customer.id === request.params.id)) {
        return response.status(404).json({ error: "No se encontró el cliente." });
      }
      const customer = validateCustomer(request.body, customers, request.params.id);
      if (!catalogRepository.updateCustomer(customer)) {
        return response.status(404).json({ error: "No se encontró el cliente." });
      }
      return response.json(customer);
    } catch (error) {
      if (error instanceof CustomerValidationError) {
        return response.status(400).json({ error: error.message });
      }
      console.error("No se pudo actualizar el cliente.", error);
      return response.status(500).json({ error: "No se pudo actualizar el cliente." });
    }
  });

  app.delete("/api/admin/customers/:id", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    try {
      if (!catalogRepository.deleteCustomer(request.params.id)) {
        return response.status(404).json({ error: "No se encontró el cliente." });
      }
      return response.status(204).end();
    } catch (error) {
      console.error("No se pudo eliminar el cliente.", error);
      return response.status(500).json({ error: "No se pudo eliminar el cliente." });
    }
  });

  app.get("/api/admin/sales", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    response.setHeader("Cache-Control", "no-store");
    return response.json(catalogRepository.getAdminData().sales);
  });

  app.post("/api/admin/sales", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    try {
      const saleRequest = validateSaleRequest(request.body);
      const sale = catalogRepository.createSale(saleRequest);
      return response.status(201).json({
        sale,
        products: catalogRepository.getCatalog().products,
      });
    } catch (error) {
      if (error instanceof SaleValidationError) {
        return response.status(400).json({ error: error.message });
      }
      if (error instanceof StoreOperationError) {
        const status =
          error.code === "CUSTOMER_NOT_FOUND" || error.code === "PRODUCT_NOT_FOUND" ? 404 : 409;
        return response.status(status).json({ error: error.message });
      }
      console.error("No se pudo registrar la venta.", error);
      return response.status(500).json({ error: "No se pudo registrar la venta." });
    }
  });

  app.post("/api/admin/sales/:id/void", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    try {
      const sale = catalogRepository.voidSale(request.params.id);
      return response.json({
        sale,
        products: catalogRepository.getCatalog().products,
      });
    } catch (error) {
      if (error instanceof StoreOperationError) {
        return response
          .status(error.code === "SALE_NOT_FOUND" ? 404 : 409)
          .json({ error: error.message });
      }
      console.error("No se pudo anular la venta.", error);
      return response.status(500).json({ error: "No se pudo anular la venta." });
    }
  });

  app.get("/api/admin/orders", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    response.setHeader("Cache-Control", "no-store");
    return response.json(catalogRepository.getOrders());
  });

  app.post("/api/admin/orders/:id/confirm", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    try {
      const order = catalogRepository.confirmOrder(request.params.id);
      return response.json({
        order,
        products: catalogRepository.getCatalog().products,
      });
    } catch (error) {
      if (error instanceof StoreOperationError) {
        const status =
          error.code === "ORDER_NOT_FOUND" || error.code === "PRODUCT_NOT_FOUND" ? 404 : 409;
        return response.status(status).json({ error: error.message });
      }
      console.error("No se pudo confirmar el pedido.", error);
      return response.status(500).json({ error: "No se pudo confirmar el pedido." });
    }
  });

  app.post("/api/admin/orders/:id/cancel", (request, response) => {
    if (!authorizeAdmin(request, response, adminAuth)) return;
    try {
      const order = catalogRepository.cancelOrder(request.params.id);
      return response.json({
        order,
        products: catalogRepository.getCatalog().products,
      });
    } catch (error) {
      if (error instanceof StoreOperationError) {
        return response
          .status(error.code === "ORDER_NOT_FOUND" ? 404 : 409)
          .json({ error: error.message });
      }
      console.error("No se pudo cancelar el pedido.", error);
      return response.status(500).json({ error: "No se pudo cancelar el pedido." });
    }
  });

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
      if (catalogRepository.hasActiveFulfillmentForProduct(request.params.id)) {
        return response.status(409).json({
          error: "No se puede eliminar un producto asociado a una venta o pedido vigente.",
        });
      }
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

/** Genera un token secreto para el enlace y conserva solamente su hash en SQLite. */
function createRawAccountToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAccountToken(token) };
}

/** Acepta solo el formato aleatorio de 256 bits usado en enlaces de cuenta. */
function isAccountToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Convierte el token del enlace en un hash no reutilizable como credencial. */
function hashAccountToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/** Valida la forma del correo sin revelar si está asociado a una cuenta. */
function isEmailAddress(value) {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

/**
 * Extrae la cookie de sesión y rechaza encabezados con valores duplicados.
 * @param {string|undefined} cookieHeader Encabezado Cookie entrante.
 */
function readSessionCookie(cookieHeader) {
  return readNamedCookie(cookieHeader, sessionCookieName);
}

/**
 * Extrae una cookie por nombre y rechaza encabezados con valores duplicados.
 */
function readNamedCookie(cookieHeader, cookieName) {
  const prefix = `${cookieName}=`;
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

/** Configura una cookie de cliente separada de la sesión de Admin. */
function serializeCustomerSessionCookie(token, secure, clear = false) {
  const attributes = [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    clear ? "Max-Age=0" : "Max-Age=28800",
  ];
  if (secure) attributes.push("Secure");
  return `${customerSessionCookieName}=${token}; ${attributes.join("; ")}`;
}
