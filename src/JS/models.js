/**
 * Contratos de datos usados por la tienda, checkout y administración.
 * Estos typedefs JSDoc documentan la forma persistida sin introducir un paso
 * de compilación TypeScript adicional en este prototipo JavaScript.
 */

/**
 * Producto visible en el catálogo y susceptible de inventario.
 * @typedef {Object} Product
 * @property {string} id Identificador estable del producto.
 * @property {string} name Nombre que ve el cliente.
 * @property {string} sku Código de inventario único.
 * @property {string} category Categoría existente en el catálogo.
 * @property {string} detail Descripción breve del producto.
 * @property {number} price Precio unitario en USD.
 * @property {number} stock Cantidad entera disponible.
 * @property {string} [badge] Etiqueta breve usada en la ficha.
 * @property {string} [image] URL HTTPS o imagen de datos validada.
 * @property {ProductDetails} [details] Información editorial editable de la ficha pública.
 */

/**
 * Contenido detallado configurable desde Admin.
 * @typedef {Object} ProductDetails
 * @property {string} description Descripción extendida del producto.
 * @property {string} ingredients Ingredientes y avisos.
 * @property {string} package Presentación y cantidad.
 * @property {string} instructions Instrucciones de uso.
 * @property {string[]} benefits Lista de beneficios.
 * @property {number} rating Promedio de calificación de 0 a 5.
 * @property {number} reviewCount Total de reseñas.
 * @property {ProductReview[]} reviews Reseñas mostradas en la ficha.
 * @property {string[]} [recommendedProductIds] Productos recomendados configurados en Admin.
 */

/**
 * Opinión visible en la sección de reseñas del producto.
 * @typedef {Object} ProductReview
 * @property {string} author Nombre mostrado del cliente.
 * @property {number} rating Calificación entera de 1 a 5.
 * @property {string} date Fecha o etiqueta de antigüedad mostrada.
 * @property {string} text Texto de la opinión.
 */

/**
 * Línea temporal del carrito del cliente.
 * @typedef {Object} CartLine
 * @property {string} id Relación al identificador actual de Product.
 * @property {number} quantity Cantidad entera positiva solicitada.
 */

/**
 * Registro privado de un cliente guardado en el portal Admin.
 * @typedef {Object} Customer
 * @property {string} id Identificador estable del cliente.
 * @property {string} name Nombre completo.
 * @property {string} email Correo de contacto.
 * @property {string} phone Teléfono de contacto.
 */

/**
 * Categoría ordenable y editable que organiza productos en la tienda.
 * @typedef {Object} Category
 * @property {string} name Nombre público de la categoría.
 * @property {number} sortOrder Posición ascendente en la navegación.
 * @property {string} image URL o imagen permitida para la tarjeta de categoría.
 * @property {string} description Descripción pública breve.
 */

/**
 * Usuario de demostración del portal administrativo.
 * @typedef {Object} AdminUser
 * @property {string} id Identificador estable del administrador.
 * @property {string} name Nombre completo.
 * @property {string} email Correo de acceso demo.
 * @property {string} role Rol asignado en el prototipo.
 * @property {boolean} active Indica si el registro está habilitado.
 */

/**
 * Copia de un artículo al momento de registrar una venta.
 * @typedef {Object} SaleItem
 * @property {string} productId Relación histórica con Product.
 * @property {string} name Nombre capturado al vender.
 * @property {string} sku SKU capturado al vender.
 * @property {number} unitPrice Precio unitario capturado al vender.
 * @property {number} quantity Unidades vendidas.
 */

/**
 * Venta de punto de venta. Los artículos guardan una instantánea para que
 * cambios posteriores en el catálogo no reescriban el historial.
 * @typedef {Object} Sale
 * @property {string} id Identificador estable de la venta.
 * @property {string} date Fecha ISO de creación.
 * @property {string|null} customerId Cliente relacionado, o null para mostrador.
 * @property {string} customerName Nombre capturado para el historial.
 * @property {string} paymentMethod Método elegido en el POS demo.
 * @property {SaleItem[]} items Artículos y precios congelados al vender.
 * @property {number} total Total en USD.
 * @property {"completed"|"voided"} status Estado de la venta.
 * @property {string} [voidedAt] Fecha ISO de anulación.
 */

/**
 * Pedido web que captura precios, productos y entrega al momento de crearse.
 * Los pedidos pendientes no reservan inventario; Admin lo descuenta al confirmar.
 * @typedef {Object} Order
 * @property {string} id Identificador estable del pedido.
 * @property {string} date Fecha ISO de creación.
 * @property {string|null} customerId Cuenta que creó el pedido.
 * @property {string} customerName Nombre capturado de la cuenta.
 * @property {{name: string, street: string, city: string, region: string, postalCode: string, phone: string}} shippingAddress Dirección de entrega capturada.
 * @property {SaleItem[]} items Artículos, precios y nombres congelados al crear.
 * @property {number} total Total calculado con los precios del servidor.
 * @property {"pending"|"confirmed"|"cancelled"} status Estado del pedido.
 * @property {string} [confirmedAt] Fecha ISO de confirmación.
 * @property {string} [cancelledAt] Fecha ISO de cancelación.
 */

/**
 * Forma completa del documento persistido bajo la clave de Admin.
 * @typedef {Object} AdminData
 * @property {Product[]} products Catálogo público editable desde Admin.
 * @property {Category[]} categories Categorías públicas del catálogo.
 * @property {Customer[]} customers Registros privados del portal.
 * @property {Sale[]} sales Historial de ventas del portal.
 * @property {AdminUser[]} admins Usuarios demo del portal.
 */

/**
 * Catálogo de productos y categorías leído para el sitio público.
 * @typedef {Pick<AdminData, "products"|"categories">} Catalog
 */

/**
 * Tipos de formularios abiertos desde el módulo de administración.
 * @typedef {"product"|"category"|"customer"|"admin"|"stock"} AdminFormType
 */

/**
 * Estado del diálogo Admin: null cuando no se muestra ningún formulario.
 * @typedef {Object} AdminFormState
 * @property {AdminFormType} type Entidad o acción que se está editando.
 * @property {Product|Category|Customer|AdminUser|null} record Registro original, si existe.
 */

export {};
