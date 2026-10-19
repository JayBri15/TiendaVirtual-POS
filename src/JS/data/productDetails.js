/**
 * Información editorial de demostración para las fichas del catálogo.
 * Las reseñas y valoraciones son ejemplos, no opiniones verificadas.
 */
const PRODUCT_DETAILS = {
  "nutrilite-daily": {
    description:
      "Un multivitamínico diario diseñado para complementar una alimentación variada y acompañar tu rutina de bienestar.",
    ingredients:
      "Mezcla de vitaminas y minerales. Consulta la etiqueta del producto para conocer la lista completa de ingredientes y alérgenos.",
    package: "Frasco con 60 tabletas",
    rating: 4.8,
    reviewCount: 39,
    benefits: [
      "Complementa la ingesta diaria de vitaminas y minerales.",
      "Formato práctico para incorporar a tu rutina.",
      "Elaborado con ingredientes de origen vegetal seleccionados.",
    ],
    instructions:
      "Toma 1 tableta al día junto con alimentos. Sigue siempre las indicaciones del envase.",
    reviews: [
      {
        author: "Laura M.",
        rating: 5,
        date: "Hace 2 semanas",
        text: "Es fácil de integrar a mi rutina diaria y el tamaño de la tableta me resulta cómodo.",
      },
      {
        author: "Carlos R.",
        rating: 4,
        date: "Hace 1 mes",
        text: "Buena presentación y el frasco rinde bastante. La información del empaque es clara.",
      },
    ],
  },
  "artistry-skin": {
    description:
      "Cuidado facial pensado para acompañar una rutina diaria de limpieza e hidratación de la piel.",
    ingredients:
      "Fórmula cosmética con ingredientes hidratantes y extractos botánicos. Revisa el empaque para conocer la fórmula completa.",
    package: "Envase de cuidado facial; contenido indicado en la etiqueta",
    rating: 4.7,
    reviewCount: 28,
    benefits: [
      "Aporta hidratación para el cuidado cotidiano.",
      "Se integra con otros pasos de tu rutina facial.",
      "Textura diseñada para una aplicación cómoda.",
    ],
    instructions:
      "Aplica sobre la piel limpia según las indicaciones del envase. Evita el contacto directo con los ojos.",
    reviews: [
      {
        author: "Sofía G.",
        rating: 5,
        date: "Hace 1 semana",
        text: "Se siente ligero y queda bien dentro de mi rutina de mañana.",
      },
      {
        author: "Ana P.",
        rating: 4,
        date: "Hace 3 semanas",
        text: "Me gustó la presentación y lo fácil que es aplicar el producto.",
      },
    ],
  },
  "body-series": {
    description:
      "Geles de baño para una limpieza diaria agradable, con una sensación fresca para el cuidado del cuerpo.",
    ingredients:
      "Base limpiadora y componentes acondicionadores. Consulta la etiqueta para ver ingredientes, fragancia y posibles alérgenos.",
    package: "Presentación de gel de baño; contenido indicado en la etiqueta",
    rating: 4.6,
    reviewCount: 31,
    benefits: [
      "Limpieza corporal para el uso cotidiano.",
      "Acompaña tu rutina de baño con una sensación fresca.",
      "Práctico para tener a mano en casa.",
    ],
    instructions:
      "Aplica sobre la piel húmeda, masajea suavemente y enjuaga. Suspende su uso si aparece irritación.",
    reviews: [
      {
        author: "Diego L.",
        rating: 5,
        date: "Hace 4 días",
        text: "Tiene una textura agradable y deja una sensación fresca después del baño.",
      },
      {
        author: "Mónica T.",
        rating: 4,
        date: "Hace 2 semanas",
        text: "Buen producto para el uso diario; me gustó mucho su presentación.",
      },
    ],
  },
  "dish-drops": {
    description:
      "Concentrado para lavar la vajilla que ayuda a hacer más práctica la limpieza cotidiana de la cocina.",
    ingredients:
      "Fórmula concentrada con agentes limpiadores. Consulta el empaque para conocer todos sus componentes y precauciones.",
    package: "Envase de concentrado; contenido indicado en la etiqueta",
    rating: 4.9,
    reviewCount: 42,
    benefits: [
      "Concentrado para el lavado manual de vajilla.",
      "Se puede dosificar de acuerdo con las indicaciones del envase.",
      "Ayuda a simplificar las tareas de limpieza en casa.",
    ],
    instructions:
      "Dilúyelo o aplícalo según las instrucciones del envase. Mantén el producto fuera del alcance de los niños.",
    reviews: [
      {
        author: "Patricia V.",
        rating: 5,
        date: "Hace 5 días",
        text: "Rinde muy bien porque solo necesito usar una pequeña cantidad.",
      },
      {
        author: "José A.",
        rating: 5,
        date: "Hace 3 semanas",
        text: "Me funciona muy bien para lavar los platos de todos los días.",
      },
    ],
  },
  protein: {
    description:
      "Mezcla de proteína de origen vegetal que puedes incorporar a tus preparaciones y a tu rutina de alimentación.",
    ingredients:
      "Proteínas de fuentes vegetales. Revisa el envase para consultar ingredientes, alérgenos y valores nutrimentales completos.",
    package: "Envase de proteína en polvo; contenido indicado en la etiqueta",
    rating: 4.8,
    reviewCount: 36,
    benefits: [
      "Alternativa de proteína de origen vegetal.",
      "Se puede añadir a bebidas y otras preparaciones.",
      "Versátil para diferentes momentos de tu día.",
    ],
    instructions:
      "Mezcla una porción siguiendo la medida y preparación recomendadas en el envase. No excedas la porción indicada.",
    reviews: [
      {
        author: "Valeria C.",
        rating: 5,
        date: "Hace 6 días",
        text: "La agrego a mis licuados y es muy fácil de preparar.",
      },
      {
        author: "Andrés F.",
        rating: 4,
        date: "Hace 1 mes",
        text: "Me gusta que sea de origen vegetal y queda bien mezclada.",
      },
    ],
  },
  "artistry-lip": {
    description:
      "Color para labios que complementa tu maquillaje diario y te permite crear un look a tu manera.",
    ingredients:
      "Fórmula cosmética para labios. Consulta el empaque para conocer la lista completa de ingredientes.",
    package: "1 producto para labios; tono sujeto a disponibilidad",
    rating: 4.5,
    reviewCount: 19,
    benefits: [
      "Aporta color para completar tu maquillaje.",
      "Formato compacto para llevar contigo.",
      "Se puede combinar con otros productos de maquillaje.",
    ],
    instructions:
      "Aplica directamente sobre los labios. Para uso externo; suspende su uso si causa irritación.",
    reviews: [
      {
        author: "Camila N.",
        rating: 5,
        date: "Hace 2 semanas",
        text: "El color es muy bonito y queda perfecto para usar a diario.",
      },
      {
        author: "Elena B.",
        rating: 4,
        date: "Hace 1 mes",
        text: "Me gustó mucho el acabado y el empaque es fácil de llevar.",
      },
    ],
  },
  glister: {
    description:
      "Pasta dental para acompañar el cepillado diario y la rutina de higiene bucal de toda la familia.",
    ingredients:
      "Fórmula de higiene bucal. Consulta el envase para conocer ingredientes activos, concentración e indicaciones.",
    package: "Tubo de pasta dental; contenido indicado en la etiqueta",
    rating: 4.7,
    reviewCount: 25,
    benefits: [
      "Para el cepillado y la higiene bucal diaria.",
      "Se incorpora fácilmente a tu rutina de cuidado.",
      "Presentación práctica para el hogar.",
    ],
    instructions:
      "Cepilla tus dientes siguiendo las recomendaciones de tu profesional de salud dental y la etiqueta del producto.",
    reviews: [
      {
        author: "Roberto H.",
        rating: 5,
        date: "Hace 1 semana",
        text: "Es una pasta cómoda para el uso diario y me gusta su sabor.",
      },
      {
        author: "Gabriela D.",
        rating: 4,
        date: "Hace 3 semanas",
        text: "Buena presentación para tener en casa y usar todos los días.",
      },
    ],
  },
  "e-spring": {
    description:
      "Sistema para el tratamiento de agua en el hogar, diseñado para integrarse a tu espacio y a tu rutina.",
    ingredients:
      "No aplica: es un sistema para el tratamiento de agua. Consulta la documentación del equipo para sus materiales y especificaciones.",
    package: "Sistema de tratamiento de agua; incluye componentes según su configuración",
    rating: 4.9,
    reviewCount: 17,
    benefits: [
      "Pensado para el tratamiento de agua en el hogar.",
      "Diseño para instalarse en el espacio doméstico.",
      "Requiere mantenimiento conforme a su manual.",
    ],
    instructions:
      "Instala y utiliza el sistema de acuerdo con el manual del fabricante. Revisa las instrucciones de mantenimiento y cambio de componentes.",
    reviews: [
      {
        author: "Mariana S.",
        rating: 5,
        date: "Hace 2 semanas",
        text: "El sistema quedó muy bien en casa y las instrucciones fueron claras.",
      },
      {
        author: "Federico J.",
        rating: 5,
        date: "Hace 2 meses",
        text: "Me resulta práctico para el hogar; es importante seguir el mantenimiento.",
      },
    ],
  },
};

/**
 * Devuelve detalles editoriales demo para un producto del catálogo.
 * Los productos creados desde Admin conservan una ficha básica y sin reseñas.
 * @param {import("../models.js").Product} product Producto del catálogo.
 */
export function getProductDetails(product) {
  if (product.details) return product.details;
  return (
    PRODUCT_DETAILS[product.id] || {
      description: product.detail,
      ingredients: "Consulta la etiqueta del producto para conocer ingredientes y alérgenos.",
      package: "Consulta el envase para conocer el contenido y la presentación.",
      rating: 0,
      reviewCount: 0,
      benefits: [
        `Producto de la categoría ${product.category}.`,
        product.detail,
        "Consulta el envase para conocer sus características completas.",
      ],
      instructions: "Sigue las instrucciones indicadas en el envase del producto.",
      reviews: [],
    }
  );
}

/**
 * Devuelve recomendaciones configuradas o, si no existen, productos de la
 * misma categoría antes que el resto del catálogo.
 * @param {import("../models.js").Product} product Producto de la ficha.
 * @param {import("../models.js").Product[]} products Catálogo disponible.
 */
export function getRecommendedProducts(product, products) {
  const configuredIds = product.details?.recommendedProductIds;
  if (Array.isArray(configuredIds)) {
    return configuredIds
      .map((id) => products.find((item) => item.id === id))
      .filter(
        (item, index, items) => item && item.id !== product.id && items.indexOf(item) === index
      )
      .slice(0, 4);
  }
  return [
    ...products.filter((item) => item.id !== product.id && item.category === product.category),
    ...products.filter((item) => item.id !== product.id && item.category !== product.category),
  ].slice(0, 4);
}
