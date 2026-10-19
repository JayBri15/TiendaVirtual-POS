# Amway storefront

## Desarrollo

```sh
npm install
npm run dev
```

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
src/
├── CSS/app.css                 # Tailwind, tokens de diseño y estilos compartidos
├── JS/
│   ├── data/defaultCatalog.js  # Datos iniciales únicos de productos/categorías
│   ├── data/productDetails.js  # Detalles y reseñas ilustrativas de fichas
│   ├── models.js               # Contratos JSDoc de los datos persistidos
│   ├── pages/                  # Tienda, checkout y administración
│   ├── services/               # Validación y acceso a localStorage
│   ├── shared/                 # Componentes React y formato de valores
│   └── main.jsx                # Enrutamiento por query y montaje React
└── index.html                  # Documento de entrada único
```

Los contratos del modelo viven en `src/JS/models.js`: los productos se relacionan con categorías por nombre; el carrito mantiene `id` y `quantity`; y las ventas guardan una instantánea de nombre, SKU y precio para proteger el historial de ediciones posteriores. Los archivos de `docs/` son solo salida generada: no deben editarse manualmente.

El catálogo, el carrito y los datos administrativos usan `localStorage` para el prototipo. La autenticación de clientes y los pagos reales requieren servicios de backend; no se deben usar credenciales ni datos de pago reales con esta versión.
