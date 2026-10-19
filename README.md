# Amway storefront

## Desarrollo

```sh
npm install
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))" # copia el resultado
# Reemplaza los valores de ejemplo y pega el secreto generado:
ADMIN_EMAIL="tu-correo@ejemplo.com" \
ADMIN_PASSWORD="una-frase-secreta-de-al-menos-12-caracteres" \
ADMIN_SESSION_SECRET="pega-aqui-el-secreto-generado" \
SMTP_HOST="smtp.tu-proveedor.com" \
SMTP_PORT="587" \
SMTP_USER="tu-usuario-smtp" \
SMTP_PASSWORD="tu-clave-smtp" \
SMTP_FROM="Amway <no-reply@tu-dominio.com>" \
PUBLIC_BASE_URL="http://localhost:5173" npm run server
# En otra terminal:
npm run dev
```

El backend corre con Node.js + Express en `http://localhost:3000` y requiere Node.js 22.5 o posterior por el módulo SQLite integrado. `GET /api/health` comprueba si está disponible. La tienda lee productos y categorías con `GET /api/products` y `GET /api/categories`. Admin puede crear, editar y eliminar productos con `/api/products`, categorías con `/api/categories` y clientes con `/api/admin/customers`. Las lecturas de clientes, ventas y pedidos están en `GET /api/admin/customers`, `GET /api/admin/sales` y `GET /api/admin/orders`; las ventas se crean con `POST /api/admin/sales` y se anulan con `POST /api/admin/sales/:id/void`. Admin confirma o cancela pedidos con `POST /api/admin/orders/:id/confirm` y `POST /api/admin/orders/:id/cancel`. Las rutas de Admin requieren sesión. Configura el correo, una contraseña de al menos 12 caracteres y un secreto aleatorio de 32 bytes o más en el servidor; sin esa configuración, el acceso y las escrituras de Admin quedan deshabilitados. No guardes esos valores en el código ni los subas al repositorio.

El acceso Admin usa `POST /api/admin/login`, `GET /api/admin/session` y `POST /api/admin/logout`. Para probar las rutas, inicia sesión desde el portal Admin; no copies la contraseña ni una clave dentro del código del navegador.

Los clientes pueden crear una cuenta desde la tienda (`POST /api/account/register`), verificar el correo (`POST /api/account/verify-email`), iniciar sesión (`POST /api/account/login`), consultar su sesión (`GET /api/account/session`) y cerrarla (`POST /api/account/logout`). Para reenviar la verificación se usa `POST /api/account/verification/resend`; sus enlaces vencen en 24 horas y solo pueden utilizarse una vez. La recuperación usa `POST /api/account/password-reset/request` y `POST /api/account/password-reset/complete`; los enlaces vencen en una hora y, al cambiar la contraseña, se revocan las sesiones existentes. Las contraseñas se guardan como hashes con sal mediante scrypt, separadas de los datos de contacto. El registro, los intentos fallidos de acceso y las solicitudes de correo tienen límites por dirección IP.

El envío SMTP requiere `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y `PUBLIC_BASE_URL`. Usa una contraseña de aplicación o credencial SMTP dedicada, guárdala solo en el entorno del servidor y no la escribas en el código ni en el navegador. Sin esos valores el registro y las solicitudes de correo quedan deshabilitados. En desarrollo se permite una URL HTTP solo para `localhost`; en producción se exige HTTPS.

La primera vez, el backend crea `backend/data/store.sqlite` y carga los datos de ejemplo si la tabla de productos está vacía; también añade automáticamente columnas nuevas a las tablas de categorías y credenciales de clientes en bases de datos anteriores. Las siguientes ejecuciones leen ese archivo. Mientras se ejecuta Vite, las llamadas a `/api` se reenvían al backend. La tienda y Checkout leen productos, precios, existencias y categorías desde el backend. Admin administra productos, categorías, clientes, ventas y pedidos mediante rutas protegidas.

Al confirmar una venta, el servidor vuelve a comprobar las existencias y calcula el total con los precios actuales de SQLite. La venta, sus precios/nombres históricos y el descuento de inventario se guardan en una transacción: si falta stock o un producto, no se aplica ningún cambio parcial. Anular una venta restaura el inventario y conserva el registro como anulado. El historial guarda una instantánea de cada artículo y el nombre del cliente del momento de compra, incluso si después se edita o elimina ese cliente.

Checkout requiere una sesión de cliente cuyo correo esté verificado. Envía al servidor únicamente cantidades, identificadores de producto y dirección; el servidor calcula los precios y comprueba stock. Crear un pedido no reserva ni descuenta existencias. Admin vuelve a comprobarlas y las descuenta en una transacción al confirmar el pedido; si luego lo cancela, las restaura. Los pedidos y sus líneas se guardan aparte de las ventas del POS y conservan una instantánea de los productos. El Checkout no procesa pagos ni solicita datos de tarjeta.

Las categorías tienen `name`, `sortOrder`, `image` y `description`. Admin permite editar esos datos; el orden ascendente controla la navegación y las tarjetas públicas muestran la imagen y descripción cuando están configuradas. Las categorías con productos asignados no se pueden eliminar. Los datos privados de clientes/ventas/pedidos y los productos/categorías ya no dependen de `localStorage`; el carrito y el resto de secciones administrativas de demostración siguen locales. El proxy de Vite solo funciona durante `npm run dev`; el sitio compilado necesita un backend desplegado bajo la misma dirección `/api`. Aún no se ha configurado ese alojamiento, así que no publiques la compilación estática hasta desplegar el backend. En producción la cookie requiere HTTPS. La autenticación de Admin está pensada para un solo administrador; las sesiones de Admin y clientes se invalidan al reiniciar el servidor.

## Validación y formato

```sh
npm test
npm run format
npm run format:check
```

## Producción

```sh
npm run build
```

Vite genera una sola página estática en `docs/index.html` y los recursos compilados en `docs/assets/`. La tienda, el checkout y Admin son vistas React seleccionadas mediante `?page=checkout` y `?page=admin`. El código de las vistas está en `src/JS/pages/`, los componentes compartidos en `src/JS/shared/` y Tailwind CSS en `src/CSS/app.css`.

Las tarjetas del catálogo abren la ficha del producto con `#producto/<id>`. Las fichas incluyen disponibilidad, detalles, recomendaciones enlazadas y una sección de reseñas. Desde Admin se editan la información completa, imagen, etiqueta, recomendaciones, calificación y reseñas, con una vista previa en vivo de la ficha pública. Los detalles y las reseñas precargadas son contenido ilustrativo de demostración; confirma siempre los datos oficiales del producto y la autenticidad de las opiniones.

## Estructura del código fuente

```text
├── backend/
│   ├── adminAuth.js            # Contraseña protegida y sesiones firmadas
│   ├── app.js                  # Aplicación Express y rutas HTTP
│   ├── catalogRepository.js    # Persistencia SQLite de catálogo, cuentas, ventas y pedidos
│   ├── customerAccountValidation.js # Validación de registro y contraseña
│   ├── customerAuth.js         # Hash de contraseñas y sesiones de cliente
│   ├── customerValidation.js   # Validación de clientes
│   ├── emailSender.js          # Envío de correo SMTP
│   ├── orderValidation.js      # Validación de pedidos
│   ├── productValidation.js    # Validaciones de productos y categorías
│   ├── saleValidation.js       # Validación de solicitudes de venta
│   └── server.js               # Inicio local del servidor Node.js
└── src/
    ├── CSS/app.css             # Tailwind, tokens de diseño y estilos compartidos
    ├── JS/
    │   ├── data/               # Catálogo inicial y detalles de fichas
    │   ├── models.js           # Contratos JSDoc de los datos persistidos
    │   ├── pages/              # Tienda, checkout y administración
    │   ├── services/           # APIs del catálogo, cuenta de cliente y Admin
    │   ├── shared/             # Componentes React y formato de valores
    │   └── main.jsx            # Enrutamiento por query y montaje React
    └── index.html              # Documento de entrada único
```

Los contratos del modelo viven en `src/JS/models.js`: los productos se relacionan con categorías por nombre; las categorías tienen orden, imagen y descripción; el carrito mantiene `id` y `quantity`; y las ventas guardan una instantánea de nombre, SKU y precio para proteger el historial de ediciones posteriores. Los archivos de `docs/` son solo salida generada: no deben editarse manualmente.

El carrito y las secciones administrativas que aún son de demostración usan `localStorage`; las sesiones de cliente y Admin usan cookies HttpOnly del backend. No se deben usar datos de pago reales con esta versión. Antes de abrir la tienda al público, configura SMTP con credenciales protegidas en el servidor, despliega HTTPS y configura un proveedor de pagos fuera de este Checkout.
