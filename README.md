# 🛍️ Amway Storefront

Tienda online con catálogo, checkout y panel de administración. La aplicación usa **React y Vite** en el frontend y **Node.js, Express y SQLite** en el backend.

> [!IMPORTANT]
> El checkout no procesa pagos ni solicita datos de tarjeta. No uses datos de pago reales con esta versión.

## 📚 Contenido

- [✨ Funcionalidades](#-funcionalidades)
- [🧰 Requisitos](#-requisitos)
- [🚀 Inicio rápido](#-inicio-rápido)
- [⚙️ Configuración](#️-configuración)
- [🧩 Cómo funciona](#-cómo-funciona)
- [🗂️ Estructura del proyecto](#️-estructura-del-proyecto)
- [✅ Pruebas y formato](#-pruebas-y-formato)
- [📦 Compilación y producción](#-compilación-y-producción)

## ✨ Funcionalidades

- 🛒 Catálogo con productos, categorías y fichas de producto.
- 👤 Cuentas de cliente, verificación por correo y recuperación de contraseña.
- 📦 Checkout con pedidos persistidos en el backend.
- 🧾 Panel Admin para gestionar productos, categorías, clientes, ventas y pedidos.
- 💾 Persistencia SQLite para catálogo, cuentas, ventas y pedidos.
- 📱 Vistas de tienda, checkout y administración dentro de una aplicación React.

## 🧰 Requisitos

- **Node.js 22.5 o posterior** (se usa el módulo SQLite integrado).
- **npm**.
- Un servidor SMTP para registro, verificación de correo y recuperación de contraseña.

## 🚀 Inicio rápido

1. Instala las dependencias:

   ```sh
   npm install
   ```

2. Genera un secreto aleatorio para las sesiones:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. En una terminal, configura las variables de entorno e inicia el backend:

   ```sh
   ADMIN_EMAIL="tu-correo@ejemplo.com" \
   ADMIN_PASSWORD="una-frase-secreta-de-al-menos-12-caracteres" \
   ADMIN_SESSION_SECRET="pega-aqui-el-secreto-generado" \
   SMTP_HOST="smtp.tu-proveedor.com" \
   SMTP_PORT="587" \
   SMTP_USER="tu-usuario-smtp" \
   SMTP_PASSWORD="tu-clave-smtp" \
   SMTP_FROM="Amway <no-reply@tu-dominio.com>" \
   PUBLIC_BASE_URL="http://localhost:5173" \
   npm run server
   ```

4. En otra terminal, inicia el frontend:

   ```sh
   npm run dev
   ```

El backend escucha en `http://localhost:3000`; Vite sirve el frontend y reenvía las solicitudes `/api` al backend. `GET /api/health` permite comprobar la disponibilidad del servidor.

## ⚙️ Configuración

| Variable               | Descripción                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_EMAIL`          | Correo de la cuenta administradora.                                                                                                   |
| `ADMIN_PASSWORD`       | Contraseña de Admin, con al menos 12 caracteres.                                                                                      |
| `ADMIN_SESSION_SECRET` | Secreto aleatorio de 32 bytes o más para las sesiones de Admin.                                                                       |
| `SMTP_HOST`            | Servidor SMTP para enviar correo.                                                                                                     |
| `SMTP_PORT`            | Puerto SMTP.                                                                                                                          |
| `SMTP_USER`            | Usuario SMTP.                                                                                                                         |
| `SMTP_PASSWORD`        | Contraseña o credencial SMTP dedicada.                                                                                                |
| `SMTP_FROM`            | Remitente de los correos, por ejemplo `Amway <no-reply@tu-dominio.com>`.                                                              |
| `PUBLIC_BASE_URL`      | Dirección pública usada para generar enlaces; en desarrollo se permite HTTP solo para `localhost`, y en producción se requiere HTTPS. |

> [!CAUTION]
> Configura estas variables únicamente en el entorno del servidor. No incluyas contraseñas ni secretos en el código, en el navegador ni en el repositorio. Sin la configuración de Admin, el acceso y las escrituras administrativas quedan deshabilitados. Sin SMTP, el registro y las solicitudes de correo no están disponibles.

### 🔐 Cuentas y sesiones

Los clientes pueden registrarse desde la tienda y verificar su dirección de correo. Los enlaces de verificación vencen en 24 horas y solo pueden utilizarse una vez. La recuperación de contraseña usa enlaces que vencen en una hora; al cambiar la contraseña, se revocan las sesiones existentes.

Las contraseñas se almacenan con hashes salados mediante scrypt. El registro, los intentos fallidos de inicio de sesión y las solicitudes de correo tienen límites por dirección IP. Las sesiones de Admin y de clientes usan cookies HttpOnly y se invalidan al reiniciar el servidor. La autenticación de Admin está pensada para un solo administrador.

| Operación                                                      | Endpoint                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Iniciar sesión, consultar sesión y cerrar sesión de Admin      | `POST /api/admin/login`, `GET /api/admin/session`, `POST /api/admin/logout`               |
| Registrar cuenta, verificar correo e iniciar sesión de cliente | `POST /api/account/register`, `POST /api/account/verify-email`, `POST /api/account/login` |
| Consultar y cerrar sesión de cliente                           | `GET /api/account/session`, `POST /api/account/logout`                                    |
| Reenviar verificación de correo                                | `POST /api/account/verification/resend`                                                   |
| Solicitar y completar recuperación de contraseña               | `POST /api/account/password-reset/request`, `POST /api/account/password-reset/complete`   |

Para probar las rutas de Admin, inicia sesión desde el portal; no copies la contraseña ni una clave dentro del código del navegador.

## 🧩 Cómo funciona

### 🏷️ Catálogo y administración

La tienda lee productos y categorías del backend. Admin puede crear, editar y eliminar productos y categorías, y administrar clientes. Las categorías tienen `name`, `sortOrder`, `image` y `description`: el orden ascendente controla la navegación, y las tarjetas públicas muestran imagen y descripción cuando están configuradas. No se pueden eliminar categorías que tengan productos asignados.

Las tarjetas del catálogo abren las fichas de producto mediante `#producto/<id>`. Las fichas incluyen disponibilidad, detalles, recomendaciones enlazadas y reseñas. Admin permite editar esta información y previsualizar la ficha pública. Los detalles y las reseñas precargadas son ilustrativos: confirma los datos oficiales y la autenticidad de las opiniones.

### 🧾 Ventas y pedidos

- **Ventas:** el servidor vuelve a comprobar las existencias y calcula el total con los precios actuales de SQLite. La venta, los precios y nombres históricos y el descuento de inventario se guardan en una transacción. Si falta stock o un producto, no se aplica ningún cambio parcial. Anular una venta restaura el inventario y conserva el registro como anulado.
- **Pedidos:** Checkout requiere una sesión de cliente con correo verificado. Envía únicamente cantidades, identificadores de producto y dirección; el servidor calcula los precios y comprueba el stock. Crear un pedido no reserva ni descuenta existencias. Admin vuelve a comprobarlas y las descuenta al confirmar el pedido; si lo cancela después, las restaura. Los pedidos y sus líneas se guardan aparte de las ventas y conservan una instantánea de los productos.
- **Historial:** las ventas conservan una instantánea de cada artículo y del nombre del cliente en el momento de la compra, incluso si después se edita o elimina ese cliente.

### 💾 Persistencia y datos de demostración

La primera ejecución crea `backend/data/store.sqlite` y carga datos de ejemplo si la tabla de productos está vacía. También añade automáticamente columnas nuevas a las tablas de categorías y credenciales de clientes de bases de datos anteriores.

Los productos, las categorías y los datos privados de clientes, ventas y pedidos se almacenan en SQLite. El carrito y las secciones administrativas que aún son de demostración utilizan `localStorage`.

## 🗂️ Estructura del proyecto

```text
├── backend/
│   ├── adminAuth.js                  # Contraseña protegida y sesiones de Admin
│   ├── app.js                        # Aplicación Express y rutas HTTP
│   ├── catalogRepository.js          # Persistencia SQLite
│   ├── customerAccountValidation.js  # Validación de registro y contraseña
│   ├── customerAuth.js               # Hash de contraseñas y sesiones de cliente
│   ├── customerValidation.js         # Validación de clientes
│   ├── emailSender.js                # Envío de correo SMTP
│   ├── orderValidation.js            # Validación de pedidos
│   ├── productValidation.js          # Validación de productos y categorías
│   ├── saleValidation.js             # Validación de solicitudes de venta
│   └── server.js                     # Inicio del servidor Node.js
├── src/
│   ├── CSS/app.css                   # Tailwind y estilos compartidos
│   ├── JS/
│   │   ├── data/                     # Catálogo inicial y detalles de producto
│   │   ├── pages/                    # Tienda, checkout y administración
│   │   ├── services/                 # APIs y persistencia del frontend
│   │   ├── shared/                   # Componentes React y formato de valores
│   │   ├── main.jsx                  # Enrutamiento y montaje de React
│   │   └── models.js                 # Contratos JSDoc de los datos
│   └── index.html                    # Documento de entrada
└── docs/                             # Salida generada para publicación estática
```

Los productos se relacionan con categorías por nombre; el carrito conserva `id` y `quantity`, y las ventas guardan instantáneas para proteger el historial frente a ediciones posteriores. No edites manualmente los archivos generados en `docs/`.

## ✅ Pruebas y formato

```sh
npm test
npm run format
npm run format:check
```

## 📦 Compilación y producción

Genera la aplicación estática con:

```sh
npm run build
```

Vite crea una página en `docs/index.html` y los recursos compilados en `docs/assets/`. La tienda, el checkout y Admin son vistas React seleccionadas mediante `?page=checkout` y `?page=admin`.

> [!WARNING]
> El proxy de Vite solo funciona durante `npm run dev`. En producción, la aplicación compilada necesita un backend desplegado bajo la misma dirección `/api`; este alojamiento todavía no está configurado. No publiques la compilación estática hasta desplegar el backend y configurar HTTPS. La cookie de producción requiere HTTPS.

Antes de abrir la tienda al público, configura SMTP con credenciales protegidas en el servidor, despliega con HTTPS y configura un proveedor de pagos externo al checkout actual.
