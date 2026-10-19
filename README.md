# Amway storefront

## Desarrollo

```sh
npm install
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))" # copia el resultado
# Reemplaza los valores de ejemplo y pega el secreto generado:
ADMIN_EMAIL="tu-correo@ejemplo.com" \
ADMIN_PASSWORD="una-frase-secreta-de-al-menos-12-caracteres" \
ADMIN_SESSION_SECRET="pega-aqui-el-secreto-generado" npm run server
# En otra terminal:
npm run dev
```

El backend inicial corre con Node.js + Express en `http://localhost:3000` y requiere Node.js 22.5 o posterior por el módulo SQLite integrado. `GET /api/health` comprueba si está disponible, `GET /api/products` lee el catálogo persistido, `POST /api/products` crea un producto, `PUT /api/products/:id` edita uno existente y `DELETE /api/products/:id` elimina uno, limpiando sus recomendaciones. Para crear, editar o eliminar se necesita una sesión iniciada en Admin. El backend comprueba la contraseña, limita intentos y entrega una cookie HttpOnly que vence después de ocho horas. Configura el correo, una contraseña de al menos 12 caracteres y un secreto aleatorio de 32 bytes o más en el servidor; sin esa configuración, el acceso y las escrituras quedan deshabilitados. No guardes esos valores en el código ni los subas al repositorio.

El acceso usa `POST /api/admin/login`, `GET /api/admin/session` y `POST /api/admin/logout`. Para probar las rutas, inicia sesión desde el portal Admin; no copies la contraseña ni una clave dentro del código del navegador.

La primera vez, el backend crea `backend/data/store.sqlite` y carga los datos de ejemplo si la tabla de productos está vacía; las siguientes ejecuciones leen ese archivo. Mientras se ejecuta Vite, las llamadas a `/api` se reenvían al backend. La tienda y Checkout leen productos, precios y existencias desde `GET /api/products`; el editor de productos de Admin usa las rutas protegidas para crear, editar y eliminar. El carrito y las demás secciones administrativas siguen guardados en `localStorage`. El proxy de Vite solo funciona durante `npm run dev`; el sitio compilado necesita un backend desplegado bajo la misma dirección `/api`. Aún no se ha configurado ese alojamiento, así que no publiques la compilación estática hasta desplegar el backend. En producción la cookie requiere HTTPS. Esta autenticación está pensada para un único administrador y las sesiones se invalidan al reiniciar el servidor.

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
│   ├── catalogRepository.js    # Esquema SQLite y lectura del catálogo
│   ├── productValidation.js    # Validaciones de productos y detalles
│   └── server.js               # Inicio local del servidor Node.js
└── src/
    ├── CSS/app.css             # Tailwind, tokens de diseño y estilos compartidos
    ├── JS/
    │   ├── data/               # Catálogo inicial y detalles de fichas
    │   ├── models.js           # Contratos JSDoc de los datos persistidos
    │   ├── pages/              # Tienda, checkout y administración
    │   ├── services/           # APIs del catálogo/Admin y acceso a localStorage
    │   ├── shared/             # Componentes React y formato de valores
    │   └── main.jsx            # Enrutamiento por query y montaje React
    └── index.html              # Documento de entrada único
```

Los contratos del modelo viven en `src/JS/models.js`: los productos se relacionan con categorías por nombre; el carrito mantiene `id` y `quantity`; y las ventas guardan una instantánea de nombre, SKU y precio para proteger el historial de ediciones posteriores. Los archivos de `docs/` son solo salida generada: no deben editarse manualmente.

El catálogo, el carrito y los datos administrativos usan `localStorage` para el prototipo. La autenticación de clientes y los pagos reales requieren servicios de backend; no se deben usar credenciales ni datos de pago reales con esta versión.
