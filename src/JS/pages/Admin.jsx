import React, { useCallback, useState } from "react";
import { DATA_KEY, isValidImage, saveCatalog } from "../services/catalogStorage.js";
import { readAdminData } from "../services/adminStorage.js";
import { makeId, money } from "../shared/format.js";
import { DEFAULT_PRODUCTS } from "../data/defaultCatalog.js";
import { getProductDetails, getRecommendedProducts } from "../data/productDetails.js";
import { ProductDetail } from "../shared/ProductDetail.jsx";
import { Brand, Field, useCrossTabStorage, useNotice } from "../shared/ui.jsx";

/** Claves y reglas de negocio usadas por las operaciones del portal Admin. */
const SESSION_KEY = "amway-admin-demo-session-v1";
const LOW_STOCK = 5;
const PAYMENT_METHODS = ["Efectivo", "Tarjeta (registro demo)", "Transferencia (registro demo)"];
const NAVIGATION = [
  ["dashboard", "▦", "Resumen"],
  ["pos", "▣", "Punto de venta"],
  ["products", "◇", "Productos"],
  ["inventory", "▤", "Inventario"],
  ["categories", "▧", "Categorías"],
  ["customers", "♙", "Clientes"],
  ["sales", "↗", "Ventas"],
  ["admins", "♧", "Administradores"],
];

/**
 * Campos editoriales del producto y previsualización en vivo de la ficha pública.
 * @param {{record: import("../models.js").Product|null, categories: string[], products: import("../models.js").Product[]}} props
 */
function ProductFields({ record, categories, products }) {
  const initialDetails = getProductDetails(
    record || {
      id: "",
      name: "",
      sku: "",
      category: categories[0] || "",
      detail: "",
      price: 1,
      stock: 0,
    }
  );
  const recommendationSource = record || {
    id: "product-preview",
    category: categories[0] || "",
  };
  const initialRecommendations =
    initialDetails.recommendedProductIds ||
    getRecommendedProducts(recommendationSource, products).map((product) => product.id);
  const [showPreview, setShowPreview] = useState(false);
  // Los campos permanecen como texto; se convierten al modelo al guardar.
  const [draft, setDraft] = useState(() => ({
    name: record?.name || "",
    sku: record?.sku || "",
    category: record?.category || categories[0] || "",
    detail: record?.detail || "",
    price: String(record?.price ?? ""),
    stock: String(record?.stock ?? 0),
    badge: record?.badge || "",
    image: record?.image?.startsWith("http") ? record.image : "",
    description: initialDetails.description,
    ingredients: initialDetails.ingredients,
    package: initialDetails.package,
    instructions: initialDetails.instructions,
    benefits: initialDetails.benefits.join("\n"),
    rating: String(initialDetails.rating),
    reviewCount: String(initialDetails.reviewCount),
    reviews: initialDetails.reviews.map((review) => ({ ...review })),
    recommendedProductIds: initialRecommendations,
  }));
  const update = (event) =>
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
  // Construye el producto público con el borrador para previsualizar sin guardar.
  const previewProduct = {
    ...record,
    id: record?.id || "product-preview",
    name: draft.name || "Nombre del producto",
    sku: draft.sku || "SKU",
    category: draft.category,
    detail: draft.detail,
    price: Number(draft.price) || 0,
    stock: Number(draft.stock) || 0,
    image: draft.image || record?.image || DEFAULT_PRODUCTS[0].image,
    badge: draft.badge,
    details: {
      description: draft.description,
      ingredients: draft.ingredients,
      package: draft.package,
      instructions: draft.instructions,
      benefits: draft.benefits
        .split("\n")
        .map((benefit) => benefit.trim())
        .filter(Boolean),
      rating: Number(draft.rating) || 0,
      reviewCount: Number(draft.reviewCount) || 0,
      reviews: draft.reviews,
      ...(draft.recommendedProductIds.length
        ? { recommendedProductIds: draft.recommendedProductIds }
        : {}),
    },
  };
  const previewProducts = record
    ? products.map((product) => (product.id === record.id ? previewProduct : product))
    : [...products, previewProduct];

  return (
    <>
      <Field
        label="Nombre del producto"
        name="name"
        value={draft.name}
        onChange={update}
        required
        maxLength={100}
      />
      <Field label="SKU" name="sku" value={draft.sku} onChange={update} required maxLength={30} />
      <label>
        <span className="label">Categoría</span>
        <select className="input" name="category" value={draft.category} onChange={update} required>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
      <Field
        label="Descripción breve"
        name="detail"
        value={draft.detail}
        onChange={update}
        maxLength={120}
      />
      <Field
        label="Etiqueta de producto (opcional)"
        name="badge"
        value={draft.badge}
        onChange={update}
        maxLength={40}
      />
      <Field
        label="Precio (USD)"
        name="price"
        type="number"
        min="0.01"
        step="0.01"
        value={draft.price}
        onChange={update}
        required
      />
      <Field
        label="Existencias"
        name="stock"
        type="number"
        min="0"
        step="1"
        value={draft.stock}
        onChange={update}
        required
      />
      <Field
        label="URL de imagen"
        name="image"
        type="url"
        value={draft.image}
        onChange={update}
        className="sm:col-span-2"
      />
      <label className="sm:col-span-2">
        <span className="label">Subir imagen (máximo 2 MB)</span>
        <input
          className="input file:mr-4 file:rounded-full file:border-0 file:bg-[#eef0e6] file:px-4 file:py-2"
          name="imageFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            // Previsualiza el archivo; el envío vuelve a validar el archivo antes de guardarlo.
            const reader = new FileReader();
            reader.onload = () =>
              setDraft((current) => ({ ...current, image: String(reader.result) }));
            reader.onerror = () =>
              console.error("No se pudo preparar la vista previa de la imagen.", reader.error);
            reader.readAsDataURL(file);
          }}
        />
        <span className="mt-1 block text-xs text-muted">
          Al subir un archivo se usará en lugar de la URL.
        </span>
      </label>
      <div className="sm:col-span-2">
        <h3 className="font-display text-xl">Información detallada de la ficha</h3>
        <p className="mt-1 text-xs text-muted">
          Esta información se guarda en el producto y aparece en su página pública.
        </p>
      </div>
      {[
        ["description", "Descripción del producto", 600],
        ["ingredients", "Ingredientes", 600],
        ["package", "Presentación o cantidad", 240],
        ["instructions", "Instrucciones de uso", 600],
      ].map(([name, label, maxLength]) => (
        <label key={name} className="sm:col-span-2">
          <span className="label">{label}</span>
          <textarea
            className="input min-h-20"
            name={name}
            value={draft[name]}
            onChange={update}
            maxLength={maxLength}
            rows={3}
          />
        </label>
      ))}
      <label className="sm:col-span-2">
        <span className="label">Beneficios (un beneficio por línea)</span>
        <textarea
          className="input min-h-24"
          name="benefits"
          value={draft.benefits}
          onChange={update}
          maxLength={1200}
          rows={4}
        />
      </label>
      <Field
        label="Promedio de calificación (0 a 5)"
        name="rating"
        type="number"
        min="0"
        max="5"
        step="0.1"
        value={draft.rating}
        onChange={update}
        required
      />
      <Field
        label="Número total de reseñas"
        name="reviewCount"
        type="number"
        min="0"
        step="1"
        value={draft.reviewCount}
        onChange={update}
        required
      />
      <fieldset className="sm:col-span-2">
        <legend className="label">Productos recomendados</legend>
        <p className="mb-3 text-xs text-muted">
          Selecciona hasta cuatro productos. Sin selecciones se recomiendan automáticamente
          productos de la misma categoría.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {products
            .filter((product) => product.id !== record?.id)
            .map((product, index) => (
              <label key={product.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`recommendedProductId-${index}`}
                  value={product.id}
                  checked={draft.recommendedProductIds.includes(product.id)}
                  disabled={
                    !draft.recommendedProductIds.includes(product.id) &&
                    draft.recommendedProductIds.length >= 4
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      recommendedProductIds: event.target.checked
                        ? [...current.recommendedProductIds, product.id]
                        : current.recommendedProductIds.filter((id) => id !== product.id),
                    }))
                  }
                  className="accent-[#25483b]"
                />
                {product.name}
              </label>
            ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl">Reseñas que se mostrarán</h3>
          <button
            className="btn-secondary"
            type="button"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                reviews: [...current.reviews, { author: "", rating: 5, date: "", text: "" }],
              }))
            }
          >
            ＋ Agregar reseña
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          El total puede incluir reseñas que no se muestran en esta lista.
        </p>
        <div className="mt-4 grid gap-4">
          {draft.reviews.map((review, index) => (
            <fieldset key={index} className="rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-semibold">Reseña {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["author", "Nombre del cliente"],
                  ["rating", "Estrellas (1 a 5)"],
                  ["date", "Fecha o antigüedad"],
                ].map(([field, label]) => (
                  <label key={field}>
                    <span className="label">{label}</span>
                    <input
                      className="input"
                      type={field === "rating" ? "number" : "text"}
                      name={`review-${field}-${index}`}
                      min={field === "rating" ? "1" : undefined}
                      max={field === "rating" ? "5" : undefined}
                      step={field === "rating" ? "1" : undefined}
                      value={review[field]}
                      onChange={(event) => {
                        const { value } = event.target;
                        setDraft((current) => ({
                          ...current,
                          reviews: current.reviews.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, [field]: value } : item
                          ),
                        }));
                      }}
                      required={field !== "date"}
                      maxLength={field === "author" ? 80 : 40}
                    />
                  </label>
                ))}
                <label className="sm:col-span-2">
                  <span className="label">Comentario</span>
                  <textarea
                    className="input min-h-20"
                    name={`review-text-${index}`}
                    value={review.text}
                    onChange={(event) => {
                      const { value } = event.target;
                      setDraft((current) => ({
                        ...current,
                        reviews: current.reviews.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, text: value } : item
                        ),
                      }));
                    }}
                    maxLength={500}
                    required
                    rows={2}
                  />
                </label>
                <button
                  className="text-left text-sm font-semibold text-[#9d5144] underline underline-offset-4 sm:col-span-2"
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      reviews: current.reviews.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  Eliminar reseña
                </button>
              </div>
            </fieldset>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <button
          className="btn-secondary"
          type="button"
          aria-expanded={showPreview}
          onClick={() => setShowPreview((visible) => !visible)}
        >
          {showPreview ? "Ocultar vista previa" : "Vista previa de la ficha pública"}
        </button>
        {showPreview && (
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
            <ProductDetail product={previewProduct} products={previewProducts} preview />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Diálogo reutilizable que construye y valida formularios de entidades Admin.
 * @param {{form: import("../models.js").AdminFormState|null, close: () => void, save: (type: import("../models.js").AdminFormType, record: import("../models.js").Product|import("../models.js").Customer|import("../models.js").AdminUser|string|null, values: Record<string, FormDataEntryValue>) => Promise<void>, data: import("../models.js").AdminData}} props
 */
function AdminModal({ form, close, save, data }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!form) return null;
  const { type, record } = form;
  const titles = {
    product: record ? "Editar producto" : "Nuevo producto",
    category: record ? "Editar categoría" : "Nueva categoría",
    customer: record ? "Editar cliente" : "Nuevo cliente",
    admin: record ? "Editar administrador" : "Nuevo administrador",
    stock: "Ajustar existencias",
  };
  // Valida el archivo de imagen, convierte su contenido y delega el guardado.
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const file = values.imageFile;
      if (file instanceof File && file.size > 0) {
        if (
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) ||
          file.size > 2 * 1024 * 1024
        ) {
          setError("La imagen debe ser PNG, JPEG, WebP o GIF y no superar 2 MB.");
          return;
        }
        values.image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
          reader.readAsDataURL(file);
        });
      }
      await save(type, record, values);
      close();
    } catch (saveError) {
      console.error("No se pudo guardar el registro.", saveError);
      setError(saveError.message || "No se pudo guardar. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  let fields;
  if (type === "product")
    fields = data.categories.length ? (
      <ProductFields record={record} categories={data.categories} products={data.products} />
    ) : (
      <p className="rounded bg-[#fbf1e8] p-3 text-sm text-[#8d542c]">
        Primero crea una categoría para asignarla al producto.
      </p>
    );
  else if (type === "category")
    fields = (
      <Field
        label="Nombre de categoría"
        name="name"
        defaultValue={record || ""}
        required
        maxLength={60}
      />
    );
  else if (type === "stock")
    fields = (
      <Field
        label={`Existencias · ${record.name}`}
        name="stock"
        type="number"
        min="0"
        step="1"
        defaultValue={record.stock}
        required
      />
    );
  else if (type === "customer")
    fields = (
      <>
        <Field label="Nombre completo" name="name" defaultValue={record?.name || ""} required />
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          defaultValue={record?.email || ""}
          required
        />
        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          defaultValue={record?.phone || ""}
          required
        />
      </>
    );
  else
    fields = (
      <>
        <Field label="Nombre completo" name="name" defaultValue={record?.name || ""} required />
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          defaultValue={record?.email || ""}
          required
        />
        <label>
          <span className="label">Rol</span>
          <select name="role" className="input" defaultValue={record?.role || "Operador"}>
            <option>Administrador</option>
            <option>Gerente</option>
            <option>Operador</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked={record?.active ?? true}
            className="accent-[#25483b]"
          />
          Cuenta activa
        </label>
      </>
    );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/45 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        className={`my-5 w-full rounded-xl bg-white p-5 shadow-2xl sm:p-7 ${type === "product" ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[.68rem] font-bold uppercase tracking-[.18em] text-[#72805a]">
              Gestión de datos
            </p>
            <h2 id="admin-dialog-title" className="mt-1 font-display text-2xl">
              {titles[type]}
            </h2>
          </div>
          <button className="icon-button text-xl" type="button" onClick={close} aria-label="Cerrar">
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">{fields}</div>
          {error && (
            <p className="mt-4 rounded bg-[#f9ece9] p-3 text-sm text-[#8d382b]" role="alert">
              {error}
            </p>
          )}
          <div className="mt-7 flex justify-end gap-3">
            <button className="btn-secondary" type="button" onClick={close}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              type="submit"
              disabled={busy || (type === "product" && !data.categories.length)}
            >
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Pantalla de acceso local al portal; sus credenciales son solo de demostración.
 * @param {{onLogin: (email: string, password: string) => string, notice: React.ReactNode}} props
 */
function AdminLogin({ onLogin, notice }) {
  const [email, setEmail] = useState("admin@amway.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top_left,_#e8eadc,_#f5f4ed_55%)] px-5 py-10">
      <form
        className="w-full max-w-md rounded-xl border border-line bg-white p-7 shadow-xl sm:p-10"
        onSubmit={(event) => {
          event.preventDefault();
          const result = onLogin(email, password);
          setError(result || "");
        }}
      >
        <Brand to="./" />
        <p className="mt-9 text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">
          Espacio de administración
        </p>
        <h1 className="mt-2 font-display text-4xl">Bienvenido de nuevo</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Ingresa para abrir el panel de control de la tienda.
        </p>
        <div className="mt-7 grid gap-4">
          <Field
            label="Correo electrónico"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Field
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error && (
          <p className="mt-4 text-sm text-[#9d5144]" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary mt-6 w-full" type="submit">
          Entrar al portal →
        </button>
        <a className="btn-secondary mt-3 w-full" href="./">
          ← Regresar a la página principal
        </a>
        <p className="mt-5 rounded bg-paper p-3 text-xs leading-5 text-muted">
          <strong className="text-ink">Acceso demo</strong>
          <br />
          admin@amway.demo · amway123
          <br />
          Solo demostración local. No uses credenciales ni datos reales.
        </p>
        {notice}
      </form>
    </main>
  );
}

/** Coordina las vistas, las acciones administrativas y el punto de venta local. */
export function Admin() {
  // Datos de dominio y estado efímero de las vistas, diálogo y carrito POS.
  const [data, setData] = useState(readAdminData);
  const [active, setActive] = useState("dashboard");
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "active"
  );
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [posCart, setPosCart] = useState([]);
  const [posCustomer, setPosCustomer] = useState("");
  const [posPayment, setPosPayment] = useState(PAYMENT_METHODS[0]);
  const { notify, region } = useNotice();

  // Mantiene este panel actualizado si otra pestaña cambia productos o ventas.
  const handleStorageChange = useCallback((event) => {
    if (event.key !== DATA_KEY && event.key !== null) return;
    setData(readAdminData());
  }, []);
  useCrossTabStorage(handleStorageChange);

  // Guarda el modelo completo y solo actualiza React después de persistirlo.
  const persist = (next) => {
    try {
      saveCatalog(next);
      setData(next);
      return true;
    } catch (error) {
      console.error("No se pudieron guardar los datos de administración.", error);
      notify("No se pudieron guardar los cambios en este navegador.", "error");
      return false;
    }
  };

  // Valida las credenciales demo y conserva la sesión solo en esta pestaña.
  const login = (email, password) => {
    if (email.toLocaleLowerCase("es-MX") !== "admin@amway.demo" || password !== "amway123")
      return "El correo o la contraseña no son correctos.";
    sessionStorage.setItem(SESSION_KEY, "active");
    setAuthenticated(true);
    return "";
  };

  // Abre el formulario solicitado, evitando productos sin una categoría válida.
  const openForm = (type, record = null) => {
    if (type === "product" && !data.categories.length) {
      notify("Primero crea una categoría.", "error");
      return;
    }
    setForm({ type, record });
  };

  // Aplica las validaciones de dominio y crea el siguiente modelo inmutable.
  const saveForm = async (type, record, values) => {
    let next = { ...data };
    if (type === "product") {
      const name = values.name.trim();
      const sku = values.sku.trim();
      const price = Number(values.price);
      const stock = Number(values.stock);
      if (
        !name ||
        !sku ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isInteger(stock) ||
        stock < 0
      )
        throw new Error(
          "Completa los campos: el precio debe ser mayor que cero y el stock un entero no negativo."
        );
      if (
        data.products.some(
          (item) =>
            item.sku.toLocaleLowerCase("es-MX") === sku.toLocaleLowerCase("es-MX") &&
            item.id !== record?.id
        )
      )
        throw new Error("Ya existe un producto con ese SKU.");
      const image = values.image?.trim() || record?.image || "";
      if (image && !isValidImage(image))
        throw new Error("Escribe una URL HTTPS válida o selecciona una imagen permitida.");
      const rating = Number(values.rating);
      const reviewCount = Number(values.reviewCount);
      // Los nombres llevan el índice para reconstruir cada reseña desde FormData.
      const reviewsByIndex = new Map();
      Object.entries(values).forEach(([key, value]) => {
        const match = key.match(/^review-(author|rating|date|text)-(\d+)$/);
        if (!match) return;
        const [, field, index] = match;
        const review = reviewsByIndex.get(index) || {
          author: "",
          rating: "",
          date: "",
          text: "",
        };
        review[field] = value;
        reviewsByIndex.set(index, review);
      });
      const reviews = [...reviewsByIndex.values()].map((review) => ({
        author: review.author.trim(),
        rating: Number(review.rating),
        date: review.date.trim(),
        text: review.text.trim(),
      }));
      const benefits = values.benefits
        .split("\n")
        .map((benefit) => benefit.trim())
        .filter(Boolean);
      const recommendedProductIds = Object.entries(values)
        .filter(([key]) => key.startsWith("recommendedProductId-"))
        .map(([, id]) => id);
      // Valida el contenido editorial y las relaciones antes de persistir el producto.
      if (
        !values.description.trim() ||
        !values.ingredients.trim() ||
        !values.package.trim() ||
        !values.instructions.trim() ||
        !benefits.length
      )
        throw new Error("Completa la descripción, ingredientes, presentación, uso y beneficios.");
      if (!Number.isFinite(rating) || rating < 0 || rating > 5)
        throw new Error("El promedio de calificación debe estar entre 0 y 5.");
      if (!Number.isInteger(reviewCount) || reviewCount < reviews.length)
        throw new Error(
          "El total de reseñas debe ser un entero igual o mayor a las reseñas listadas."
        );
      if (
        recommendedProductIds.length > 4 ||
        new Set(recommendedProductIds).size !== recommendedProductIds.length ||
        recommendedProductIds.some(
          (id) => id === record?.id || !data.products.some((item) => item.id === id)
        )
      )
        throw new Error("Selecciona hasta cuatro productos recomendados válidos.");
      if (
        reviews.some(
          (review) =>
            !review.author ||
            !review.text ||
            !Number.isInteger(review.rating) ||
            review.rating < 1 ||
            review.rating > 5
        )
      )
        throw new Error("Completa el nombre, comentario y calificación (1 a 5) de cada reseña.");
      const product = {
        ...record,
        id: record?.id || makeId("product"),
        name,
        sku,
        category: values.category,
        detail: values.detail.trim(),
        price,
        stock,
        details: {
          description: values.description.trim(),
          ingredients: values.ingredients.trim(),
          package: values.package.trim(),
          instructions: values.instructions.trim(),
          benefits,
          rating,
          reviewCount,
          reviews,
          ...(recommendedProductIds.length ? { recommendedProductIds } : {}),
        },
        badge: values.badge.trim(),
        ...(image ? { image } : {}),
      };
      next.products = record
        ? data.products.map((item) => (item.id === record.id ? product : item))
        : [...data.products, product];
    } else if (type === "category") {
      const name = values.name.trim();
      if (!name) throw new Error("Escribe el nombre de la categoría.");
      if (
        data.categories.some(
          (item) =>
            item.toLocaleLowerCase("es-MX") === name.toLocaleLowerCase("es-MX") && item !== record
        )
      )
        throw new Error("Ya existe una categoría con ese nombre.");
      next.categories = record
        ? data.categories.map((item) => (item === record ? name : item))
        : [...data.categories, name];
      if (record)
        next.products = data.products.map((item) =>
          item.category === record ? { ...item, category: name } : item
        );
    } else if (type === "stock") {
      const stock = Number(values.stock);
      if (!Number.isInteger(stock) || stock < 0)
        throw new Error("El stock debe ser un entero no negativo.");
      next.products = data.products.map((item) =>
        item.id === record.id ? { ...item, stock } : item
      );
    } else if (type === "customer") {
      const customer = {
        ...record,
        id: record?.id || makeId("customer"),
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      };
      if (!customer.name || !customer.email || !customer.phone)
        throw new Error("Completa todos los campos.");
      if (
        data.customers.some(
          (item) =>
            item.email.toLocaleLowerCase("es-MX") === customer.email.toLocaleLowerCase("es-MX") &&
            item.id !== record?.id
        )
      )
        throw new Error("Ese correo ya está registrado.");
      next.customers = record
        ? data.customers.map((item) => (item.id === record.id ? customer : item))
        : [...data.customers, customer];
    } else if (type === "admin") {
      const admin = {
        ...record,
        id: record?.id || makeId("admin"),
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        active: values.active === "true",
      };
      if (!admin.name || !admin.email) throw new Error("Completa el nombre y correo.");
      if (
        data.admins.some(
          (item) =>
            item.email.toLocaleLowerCase("es-MX") === admin.email.toLocaleLowerCase("es-MX") &&
            item.id !== record?.id
        )
      )
        throw new Error("Ese correo ya está asignado.");
      next.admins = record
        ? data.admins.map((item) => (item.id === record.id ? admin : item))
        : [...data.admins, admin];
    }
    if (!persist(next)) throw new Error("No se guardaron los cambios. Inténtalo de nuevo.");
    notify(
      type === "product" && !record
        ? "Producto creado y visible en la tienda."
        : type === "category" && !record
          ? "Categoría creada y visible en la tienda."
          : "Cambios guardados correctamente."
    );
  };

  // Elimina entidades solo cuando sus relaciones no dejan registros huérfanos.
  const removeRecord = (collection, id, label) => {
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    if (
      collection === "products" &&
      data.sales.some(
        (sale) => sale.status === "completed" && sale.items.some((item) => item.productId === id)
      )
    ) {
      notify("No se puede eliminar un producto asociado a una venta vigente.", "error");
      return;
    }
    if (collection === "products" && posCart.some((item) => item.id === id)) {
      notify("Quita el producto del punto de venta antes de eliminarlo.", "error");
      return;
    }
    const next = { ...data, [collection]: data[collection].filter((item) => item.id !== id) };
    if (collection === "products") {
      next.products = next.products.map((product) => {
        if (!product.details?.recommendedProductIds?.includes(id)) return product;
        const recommendedProductIds = product.details.recommendedProductIds.filter(
          (productId) => productId !== id
        );
        const details = { ...product.details };
        delete details.recommendedProductIds;
        return {
          ...product,
          details: recommendedProductIds.length ? { ...details, recommendedProductIds } : details,
        };
      });
    }
    if (persist(next)) notify(`${label} eliminado.`);
  };

  // Filtra colecciones por sus valores serializados para reutilizar la búsqueda.
  const visible = (items) =>
    items.filter((item) =>
      JSON.stringify(item)
        .toLocaleLowerCase("es-MX")
        .includes(search.trim().toLocaleLowerCase("es-MX"))
    );
  const totalPos = posCart.reduce(
    (sum, line) =>
      sum + (data.products.find((product) => product.id === line.id)?.price || 0) * line.quantity,
    0
  );

  // Añade, reduce o quita productos del carrito local del punto de venta.
  const addPos = (id, amount) => {
    const product = data.products.find((item) => item.id === id);
    const quantity = posCart.find((item) => item.id === id)?.quantity || 0;
    if (!product || quantity + amount > product.stock) {
      notify(`Existencias disponibles: ${product?.stock || 0}.`, "error");
      return;
    }
    const next =
      amount === 0
        ? posCart.filter((item) => item.id !== id)
        : quantity
          ? posCart.map((item) =>
              item.id === id ? { ...item, quantity: quantity + amount } : item
            )
          : [...posCart, { id, quantity: 1 }];
    setPosCart(next.filter((item) => item.quantity > 0));
  };

  // Verifica existencias, crea la instantánea de venta y descuenta inventario.
  const completeSale = () => {
    if (!posCart.length) return;
    if (
      posCart.some(
        (line) =>
          !data.products.some((product) => product.id === line.id && line.quantity <= product.stock)
      )
    ) {
      notify("El inventario cambió; revisa las cantidades.", "error");
      return;
    }
    const customer = data.customers.find((item) => item.id === posCustomer);
    const items = posCart.map((line) => {
      const product = data.products.find((item) => item.id === line.id);
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: line.quantity,
      };
    });
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const next = {
      ...data,
      products: data.products.map((product) => {
        const line = posCart.find((item) => item.id === product.id);
        return line ? { ...product, stock: product.stock - line.quantity } : product;
      }),
      sales: [
        ...data.sales,
        {
          id: makeId("sale"),
          date: new Date().toISOString(),
          customerId: customer?.id || null,
          customerName: customer?.name || "",
          paymentMethod: posPayment,
          items,
          total,
          status: "completed",
        },
      ],
    };
    if (persist(next)) {
      setPosCart([]);
      notify(`Venta confirmada por ${money(total)}. El stock fue actualizado.`);
    }
  };

  // Anula una venta y devuelve las unidades al inventario vigente.
  const voidSale = (sale) => {
    if (
      sale.status !== "completed" ||
      !window.confirm(
        `¿Anular la venta ${sale.id.slice(-8).toUpperCase()}? Se devolverán las unidades al inventario.`
      )
    )
      return;
    const next = {
      ...data,
      products: data.products.map((product) => {
        const line = sale.items.find((item) => item.productId === product.id);
        return line ? { ...product, stock: product.stock + line.quantity } : product;
      }),
      sales: data.sales.map((item) =>
        item.id === sale.id
          ? { ...item, status: "voided", voidedAt: new Date().toISOString() }
          : item
      ),
    };
    if (persist(next)) notify("Venta anulada; el inventario fue restaurado.");
  };

  if (!authenticated)
    return (
      <AdminLogin
        onLogin={login}
        notice={
          <p className="mt-4 text-center text-[.68rem] text-muted">
            Prototipo local: esta sesión no ofrece seguridad real.
          </p>
        }
      />
    );

  const heading = NAVIGATION.find(([id]) => id === active)?.[2] || "Resumen";
  const today = new Date().toDateString();
  const todaySales = data.sales.filter(
    (sale) => sale.status === "completed" && new Date(sale.date).toDateString() === today
  );

  // Constructores visuales reutilizados para mantener las vistas Admin consistentes.
  const cardHeading = (title, description, action) => (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72805a]">{heading}</p>
        <h2 className="mt-1 font-display text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
  const toolbar = (placeholder) => (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <input
        className="input max-w-lg"
        type="search"
        placeholder={placeholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <span className="text-xs text-muted">Los cambios se guardan en este navegador</span>
    </div>
  );
  const table = (headers, rows, empty) => (
    <div className="card table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows
          ) : (
            <tr>
              <td colSpan={headers.length} className="py-12 text-center text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
  const actions = (onEdit, onDelete) => (
    <div className="flex gap-3 whitespace-nowrap">
      <button
        className="text-xs font-semibold text-leaf underline underline-offset-4"
        onClick={onEdit}
      >
        Editar
      </button>
      <button
        className="text-xs font-semibold text-[#9d5144] underline underline-offset-4"
        onClick={onDelete}
      >
        Eliminar
      </button>
    </div>
  );
  let content;

  // El resumen muestra métricas operativas, ventas recientes y accesos frecuentes.
  if (active === "dashboard") {
    const low = data.products.filter((product) => product.stock <= LOW_STOCK).length;
    const metrics = [
      [
        "Ventas de hoy",
        money(todaySales.reduce((sum, sale) => sum + sale.total, 0)),
        `${todaySales.length} transacciones`,
        "↗",
      ],
      ["Productos", data.products.length, `${data.categories.length} categorías`, "◇"],
      ["Stock bajo", low, `Umbral: ${LOW_STOCK} unidades o menos`, "▤"],
      ["Clientes", data.customers.length, "Registrados en el portal", "♙"],
    ];
    content = (
      <>
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72805a]">Resumen</p>
          <h2 className="mt-1 font-display text-3xl">Un vistazo a tu operación</h2>
          <p className="mt-2 text-sm text-muted">
            Resumen de actividad y accesos rápidos al portal.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, foot, icon]) => (
            <article className="card p-5" key={label}>
              <div className="flex justify-between text-sm text-muted">
                <span>{label}</span>
                <span className="text-xl text-[#78905f]">{icon}</span>
              </div>
              <strong className="mt-4 block font-display text-3xl">{value}</strong>
              <span className="mt-1 block text-xs text-muted">{foot}</span>
            </article>
          ))}
        </div>
        <div className="mt-7 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
          <section className="card p-5">
            <h3 className="mb-3 font-display text-xl">Actividad reciente</h3>
            {table(
              ["Venta", "Fecha", "Cliente", "Total", "Estado"],
              data.sales
                .slice()
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
                .map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.id.slice(-8).toUpperCase()}</td>
                    <td>{new Date(sale.date).toLocaleDateString("es-MX")}</td>
                    <td>{sale.customerName || "Venta de mostrador"}</td>
                    <td>{money(sale.total)}</td>
                    <td>{sale.status === "voided" ? "Anulada" : "Completada"}</td>
                  </tr>
                )),
              "Aún no hay ventas. Registra una desde el punto de venta."
            )}
          </section>
          <section className="card p-5">
            <h3 className="font-display text-xl">Accesos rápidos</h3>
            <div className="mt-4 grid gap-2">
              {[
                ["pos", "Iniciar una venta"],
                ["products", "Agregar producto"],
                ["customers", "Registrar cliente"],
              ].map(([view, label]) => (
                <button
                  key={view}
                  className="flex justify-between rounded bg-paper p-3 text-left text-sm font-semibold hover:bg-[#e9ebdf]"
                  onClick={() =>
                    view === "products"
                      ? openForm("product")
                      : view === "customers"
                        ? openForm("customer")
                        : setActive("pos")
                  }
                >
                  {label}
                  <span>→</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </>
    );
  } else if (active === "products") {
    // La vista de productos expone el CRUD que alimenta el catálogo público.
    content = (
      <>
        {cardHeading(
          "Catálogo de productos",
          "Administra nombres, SKU, precios, categorías y existencias.",
          <button className="btn-primary" onClick={() => openForm("product")}>
            ＋ Nuevo producto
          </button>
        )}
        {toolbar("Buscar por nombre, SKU o categoría")}
        {table(
          ["Producto", "SKU", "Categoría", "Precio", "Stock", "Acciones"],
          visible(data.products).map((product) => (
            <tr key={product.id}>
              <td>
                <div className="flex items-center gap-3">
                  <img
                    className="h-11 w-11 rounded object-cover"
                    src={product.image || DEFAULT_PRODUCTS[0].image}
                    alt=""
                  />
                  <strong>{product.name}</strong>
                </div>
              </td>
              <td>{product.sku}</td>
              <td>{product.category}</td>
              <td>{money(product.price)}</td>
              <td className={product.stock <= LOW_STOCK ? "font-semibold text-[#a25836]" : ""}>
                {product.stock}
              </td>
              <td>
                {actions(
                  () => openForm("product", product),
                  () => removeRecord("products", product.id, "el producto")
                )}
              </td>
            </tr>
          )),
          "No hay productos en el catálogo."
        )}
      </>
    );
  } else if (active === "inventory") {
    // La vista de inventario permite ajustar existencias sin editar el resto del producto.
    const low = data.products.filter((item) => item.stock <= LOW_STOCK).length;
    content = (
      <>
        {cardHeading(
          "Control de inventario",
          "Consulta existencias y ajusta el stock físico de cada producto."
        )}
        {toolbar(`${low} productos con stock bajo (≤ ${LOW_STOCK})`)}
        {table(
          ["Producto", "SKU", "Categoría", "Estado", "Acciones"],
          visible(data.products).map((product) => (
            <tr key={product.id}>
              <td className="font-semibold">{product.name}</td>
              <td>{product.sku}</td>
              <td>{product.category}</td>
              <td className={product.stock <= LOW_STOCK ? "text-[#a25836]" : "text-[#536d40]"}>
                {product.stock} · {product.stock <= LOW_STOCK ? "Reponer" : "Disponible"}
              </td>
              <td>
                <button
                  className="text-xs font-semibold text-leaf underline"
                  onClick={() => openForm("stock", product)}
                >
                  Ajustar stock
                </button>
              </td>
            </tr>
          )),
          "Agrega productos para administrar las existencias."
        )}
      </>
    );
  } else if (active === "categories") {
    // Renombrar una categoría actualiza también los productos relacionados.
    content = (
      <>
        {cardHeading(
          "Categorías",
          "Organiza el catálogo para facilitar la navegación.",
          <button className="btn-primary" onClick={() => openForm("category")}>
            ＋ Nueva categoría
          </button>
        )}
        {table(
          ["Categoría", "Productos", "Acciones"],
          visible(data.categories.map((name) => ({ name }))).map(({ name }) => (
            <tr key={name}>
              <td className="font-semibold">{name}</td>
              <td>{data.products.filter((product) => product.category === name).length}</td>
              <td>
                {actions(
                  () => openForm("category", name),
                  () => {
                    if (data.products.some((product) => product.category === name)) {
                      notify(
                        "No se puede eliminar una categoría que tiene productos asignados.",
                        "error"
                      );
                      return;
                    }
                    if (!window.confirm(`¿Eliminar la categoría "${name}"?`)) return;
                    persist({
                      ...data,
                      categories: data.categories.filter((item) => item !== name),
                    });
                  }
                )}
              </td>
            </tr>
          )),
          "Aún no hay categorías."
        )}
      </>
    );
  } else if (active === "customers") {
    // Clientes son registros privados del panel y no se exponen en la tienda.
    content = (
      <>
        {cardHeading(
          "Clientes",
          "Consulta y administra los registros del portal.",
          <button className="btn-primary" onClick={() => openForm("customer")}>
            ＋ Nuevo cliente
          </button>
        )}
        {toolbar("Buscar por nombre, correo o teléfono")}
        {table(
          ["Nombre", "Correo", "Teléfono", "Acciones"],
          visible(data.customers).map((customer) => (
            <tr key={customer.id}>
              <td className="font-semibold">{customer.name}</td>
              <td>{customer.email}</td>
              <td>{customer.phone}</td>
              <td>
                {actions(
                  () => openForm("customer", customer),
                  () => removeRecord("customers", customer.id, "el cliente")
                )}
              </td>
            </tr>
          )),
          "Aún no hay clientes."
        )}
      </>
    );
  } else if (active === "admins") {
    // Administradores locales solo documentan el prototipo; no son autenticación real.
    content = (
      <>
        {cardHeading(
          "Administradores",
          "Gestiona los usuarios de demostración del portal.",
          <button className="btn-primary" onClick={() => openForm("admin")}>
            ＋ Nuevo administrador
          </button>
        )}
        {toolbar("Buscar por nombre, correo o rol")}
        {table(
          ["Nombre", "Correo", "Rol", "Estado", "Acciones"],
          visible(data.admins).map((admin) => (
            <tr key={admin.id}>
              <td className="font-semibold">{admin.name}</td>
              <td>{admin.email}</td>
              <td>{admin.role}</td>
              <td>{admin.active ? "Activo" : "Inactivo"}</td>
              <td>
                {actions(
                  () => openForm("admin", admin),
                  () =>
                    admin.id === "admin-demo"
                      ? notify("No se puede eliminar el usuario demo.", "error")
                      : removeRecord("admins", admin.id, "el administrador")
                )}
              </td>
            </tr>
          )),
          "Aún no hay administradores."
        )}
      </>
    );
  } else if (active === "sales") {
    // El historial conserva instantáneas y permite devolver inventario al anular ventas.
    content = (
      <>
        {cardHeading("Ventas", "Consulta transacciones y restaura inventario al anular una venta.")}
        {toolbar("Buscar por venta, cliente o método de pago")}
        {table(
          ["Venta", "Fecha", "Cliente", "Pago", "Artículos", "Total", "Estado", "Acciones"],
          visible(data.sales).map((sale) => (
            <tr key={sale.id}>
              <td>{sale.id.slice(-8).toUpperCase()}</td>
              <td>
                {new Date(sale.date).toLocaleString("es-MX", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </td>
              <td>{sale.customerName || "Venta de mostrador"}</td>
              <td>{sale.paymentMethod}</td>
              <td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
              <td>{money(sale.total)}</td>
              <td>{sale.status === "voided" ? "Anulada" : "Completada"}</td>
              <td>
                {sale.status === "completed" && (
                  <button
                    className="text-xs font-semibold text-[#9d5144] underline"
                    onClick={() => voidSale(sale)}
                  >
                    Anular
                  </button>
                )}
              </td>
            </tr>
          )),
          "Aún no hay ventas."
        )}
      </>
    );
  } else {
    // El POS valida existencias y conecta cada transacción con el inventario.
    const posItems = data.products.filter((product) =>
      `${product.name} ${product.sku} ${product.category}`
        .toLocaleLowerCase("es-MX")
        .includes(search.toLocaleLowerCase("es-MX"))
    );
    content = (
      <>
        {cardHeading(
          "Punto de venta",
          "Registra ventas y actualiza automáticamente las existencias."
        )}
        <div className="grid gap-5 xl:grid-cols-[1.35fr_.8fr]">
          <section>
            <input
              className="input mb-4"
              type="search"
              placeholder="Buscar producto por nombre o SKU"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {posItems.map((product) => (
                <article className="card p-4" key={product.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[.68rem] text-muted">
                        {product.category} · Stock: {product.stock}
                      </p>
                      <h3 className="mt-2 font-semibold">{product.name}</h3>
                      <p className="mt-1 text-xs text-muted">{product.sku}</p>
                    </div>
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-leaf text-xl text-white"
                      disabled={!product.stock}
                      onClick={() => addPos(product.id, 1)}
                      aria-label={`Agregar ${product.name}`}
                    >
                      +
                    </button>
                  </div>
                  <strong className="mt-4 block">{money(product.price)}</strong>
                </article>
              ))}
            </div>
          </section>
          <section className="card h-max p-5">
            <h3 className="font-display text-xl">
              Venta actual · {posCart.reduce((sum, line) => sum + line.quantity, 0)} artículos
            </h3>
            {!posCart.length && (
              <p className="py-8 text-center text-sm text-muted">
                Agrega productos para iniciar la venta.
              </p>
            )}
            <div className="mt-3 divide-y divide-line">
              {posCart.map((line) => {
                const product = data.products.find((item) => item.id === line.id);
                if (!product) return null;
                return (
                  <div key={line.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <strong className="text-sm">{product.name}</strong>
                      <p className="text-xs text-muted">{money(product.price)} c/u</p>
                    </div>
                    <div className="text-right">
                      <strong className="text-sm">{money(product.price * line.quantity)}</strong>
                      <div className="mt-1 flex items-center gap-2">
                        <button className="text-sm" onClick={() => addPos(product.id, -1)}>
                          −
                        </button>
                        <span className="text-xs">{line.quantity}</span>
                        <button
                          className="text-sm"
                          disabled={line.quantity >= product.stock}
                          onClick={() => addPos(product.id, 1)}
                        >
                          +
                        </button>
                        <button
                          className="ml-1 text-xs text-[#9d5144]"
                          onClick={() => addPos(product.id, 0)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <label className="mt-4 block">
              <span className="label">Cliente (opcional)</span>
              <select
                className="input"
                value={posCustomer}
                onChange={(event) => setPosCustomer(event.target.value)}
              >
                <option value="">Venta de mostrador</option>
                {data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="label">Método de pago</span>
              <select
                className="input"
                value={posPayment}
                onChange={(event) => setPosPayment(event.target.value)}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-between border-t border-line pt-4">
              <strong>Total</strong>
              <strong>{money(totalPos)}</strong>
            </div>
            <button
              className="btn-primary mt-4 w-full"
              disabled={!posCart.length}
              onClick={completeSale}
            >
              Confirmar venta
            </button>
          </section>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f2] lg:flex">
      <aside className="bg-[#1e382e] text-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center justify-between px-5 py-5 lg:block lg:pb-8">
          <Brand inverse to="?page=admin" />
          <span className="ml-2 rounded bg-white/10 px-2 py-1 text-[.6rem] font-bold tracking-widest text-lime">
            ADMIN
          </span>
          <a href="./" className="text-xs text-white/70 hover:text-white lg:hidden">
            Tienda ↗
          </a>
        </div>
        <p className="hidden px-5 pb-2 text-[.62rem] font-semibold tracking-[.2em] text-white/45 lg:block">
          GESTIÓN
        </p>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-y-auto">
          {NAVIGATION.map(([id, icon, label]) => (
            <button
              key={id}
              className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition lg:w-full lg:text-sm ${active === id ? "bg-white/12 text-lime" : "text-white/70 hover:bg-white/8 hover:text-white"}`}
              onClick={() => {
                setActive(id);
                setSearch("");
              }}
            >
              <span className="w-5 text-center text-base">{icon}</span>
              {label}
              {id === "pos" && (
                <span className="ml-auto hidden rounded bg-lime/15 px-1.5 py-0.5 text-[.55rem] text-lime lg:inline">
                  POS
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden px-5 py-5 text-xs text-white/55 lg:block">
          <p>Panel local de demostración</p>
          <a href="./" className="mt-3 inline-block hover:text-white">
            ← Volver a la tienda
          </a>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e4e6df] bg-white/90 px-5 py-4 backdrop-blur sm:px-8">
          <div>
            <p className="text-[.63rem] font-bold uppercase tracking-[.18em] text-[#78836e]">
              Operaciones · Amway
            </p>
            <h1 className="mt-1 font-display text-2xl">{heading}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-[#eff2e7] px-3 py-2 text-xs text-leaf sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#84933c]" />
              Modo demo
            </span>
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-[#e5eadf] text-xs font-bold text-leaf"
              aria-label="Cerrar sesión"
              onClick={() => {
                sessionStorage.removeItem(SESSION_KEY);
                setAuthenticated(false);
              }}
            >
              AD
            </button>
          </div>
        </header>
        <div className="flex items-start gap-3 border-b border-[#eadcc3] bg-[#fbf3e4] px-5 py-3 text-xs leading-5 text-[#755a30] sm:px-8">
          <span>ⓘ</span>
          <p>
            <strong>Prototipo local.</strong> Esta sesión no ofrece seguridad real; los datos se
            guardan en este navegador y no se sincronizan con otros clientes.
          </p>
        </div>
        <main className="mx-auto max-w-[1500px] p-5 sm:p-8">{content}</main>
        <footer className="border-t border-line px-5 py-5 text-center text-xs text-muted sm:px-8">
          Amway · Portal de administración · Prototipo
        </footer>
      </div>
      <AdminModal form={form} close={() => setForm(null)} save={saveForm} data={data} />
      {region}
    </div>
  );
}
