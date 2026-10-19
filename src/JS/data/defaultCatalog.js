/**
 * Catálogo base del prototipo.
 * Admin, tienda y checkout comparten estas referencias como valores iniciales.
 */
export const DEFAULT_PRODUCTS = [
  {
    id: "nutrilite-daily",
    name: "Nutrilite Daily",
    sku: "NUT-001",
    category: "Nutrición",
    detail: "Vitaminas y suplementos",
    price: 28.5,
    stock: 24,
    badge: "Favorito",
    image:
      "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "artistry-skin",
    name: "Artistry Skin Nutrition",
    sku: "ART-001",
    category: "Belleza",
    detail: "Cuidado de la piel",
    price: 42,
    stock: 14,
    badge: "Nuevo",
    image:
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "body-series",
    name: "Geles de baño Body Series",
    sku: "BODY-001",
    category: "Cuidado personal",
    detail: "Baño y cuidado del cuerpo",
    price: 16.75,
    stock: 18,
    badge: "Esencial",
    image:
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "dish-drops",
    name: "Concentrado Dish Drops",
    sku: "HOME-001",
    category: "En casa",
    detail: "Artículos de limpieza",
    price: 12.9,
    stock: 31,
    badge: "Concentrado",
    image:
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "protein",
    name: "Nutrilite All Plant Protein",
    sku: "NUT-002",
    category: "Nutrición",
    detail: "Nutrición deportiva",
    price: 35.5,
    stock: 9,
    badge: "Nuevo",
    image:
      "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "artistry-lip",
    name: "Artistry Go Vibrant",
    sku: "ART-002",
    category: "Belleza",
    detail: "Maquillaje",
    price: 24,
    stock: 11,
    badge: "Color nuevo",
    image:
      "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "glister",
    name: "Pasta dental Glister",
    sku: "CARE-001",
    category: "Cuidado personal",
    detail: "Cuidado bucal",
    price: 9.5,
    stock: 27,
    badge: "Diario",
    image:
      "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "e-spring",
    name: "Sistema eSpring",
    sku: "HOME-002",
    category: "En casa",
    detail: "Tratamiento de agua",
    price: 289,
    stock: 4,
    badge: "Hogar",
    image:
      "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=700&q=80",
  },
];

/** Registros iniciales de categorías con el mismo contrato que la API. */
export const DEFAULT_CATEGORIES = [
  ...new Set(DEFAULT_PRODUCTS.map((product) => product.category)),
].map((name, sortOrder) => ({
  name,
  sortOrder: sortOrder + 1,
  image: "",
  description: "",
}));
