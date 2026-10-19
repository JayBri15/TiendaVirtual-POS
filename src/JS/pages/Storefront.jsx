import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { CART_KEY, DATA_KEY, loadCart, readCatalog, saveCart } from "../services/catalogStorage.js";
import { DEFAULT_PRODUCTS } from "../data/defaultCatalog.js";
import { getProductDetails } from "../data/productDetails.js";
import { money } from "../shared/format.js";
import { ProductDetail } from "../shared/ProductDetail.jsx";
import {
  Brand,
  SectionTitle,
  useBodyScrollLock,
  useCrossTabStorage,
  useNotice,
} from "../shared/ui.jsx";

const categoryArt = ["bg-[#dfe7d6]", "bg-[#eedfd9]", "bg-[#d9e3de]", "bg-[#e9e5d6]"];

/**
 * Presenta un producto, su inventario y la acción para añadirlo al carrito.
 * @param {{product: import("../models.js").Product, onAdd: (product: import("../models.js").Product) => void}} props
 */
function ProductCard({ product, onAdd }) {
  const unavailable = product.stock <= 0;
  const details = getProductDetails(product);
  return (
    <article className="group relative overflow-hidden rounded-lg border border-[#e5e5dc] bg-white transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/4.5] overflow-hidden bg-[#f1f0e9]">
        <img
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          src={product.image || DEFAULT_PRODUCTS[0].image}
          alt={product.name}
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[.68rem] font-semibold uppercase tracking-wider">
          {product.badge || product.category}
        </span>
        {unavailable && (
          <span className="absolute inset-0 grid place-items-center bg-black/35 text-sm font-semibold text-white">
            Agotado
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-xs text-muted">
          {product.category} <span className="px-1">·</span> {product.detail}
        </p>
        <h3 className="mt-2 min-h-12 font-display text-lg leading-snug">{product.name}</h3>
        <div
          className="mt-2 flex items-center gap-2 text-sm"
          aria-label={`Calificación ${details.rating} de 5, ${details.reviewCount} reseñas`}
        >
          <span className={details.rating ? "text-[#c89a31]" : "text-[#a8aca3]"} aria-hidden="true">
            {details.rating ? "★".repeat(Math.round(details.rating)) : "☆☆☆☆☆"}
          </span>
          <span>{details.rating ? details.rating.toFixed(1) : "Sin reseñas"}</span>
          <span className="text-muted">({details.reviewCount})</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <strong>{money(product.price)}</strong>
          <span className={`text-xs ${product.stock <= 5 ? "text-[#a25836]" : "text-muted"}`}>
            {product.stock} disponibles
          </span>
        </div>
      </div>
      <a
        href={`#producto/${encodeURIComponent(product.id)}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        aria-label={`Ver detalles de ${product.name}`}
      >
        <span className="sr-only">Ver detalles de {product.name}</span>
      </a>
      {!unavailable && (
        <button
          onClick={() => onAdd(product)}
          className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full bg-leaf text-2xl text-white shadow-lg transition hover:bg-[#17372b]"
          aria-label={`Agregar ${product.name} al carrito`}
        >
          +
        </button>
      )}
    </article>
  );
}

/**
 * Barra de búsqueda con sugerencias visuales y navegación por teclado.
 * @param {{query: string, onQueryChange: (value: string) => void, products: import("../models.js").Product[], onSelect: (product: import("../models.js").Product) => void}} props
 */
function ProductSearch({ query, onQueryChange, products, onSelect }) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = query.trim() ? products.slice(0, 5) : [];

  // Cierra la lista al hacer clic fuera y evita dejarla abierta tras desmontar.
  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!event.target.closest("[data-product-search]")) setIsOpen(false);
    };
    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, []);

  // Permite recorrer sugerencias, seleccionar con Enter o cerrar con Escape.
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      onSelect(suggestions[activeIndex]);
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative" data-product-search>
      <label className="block">
        <span className="sr-only">Buscar productos</span>
        <input
          className="input rounded-full"
          type="search"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="¿Qué estás buscando?"
        />
      </label>
      {isOpen && query.trim() && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-96 overflow-y-auto rounded-lg border border-line bg-white p-2 shadow-xl"
          role="listbox"
          aria-label="Productos coincidentes"
        >
          {suggestions.length ? (
            suggestions.map((product, index) => (
              <button
                id={`${listId}-option-${index}`}
                key={product.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-md p-2 text-left transition ${
                  index === activeIndex ? "bg-[#eff2e7]" : "hover:bg-[#f5f4ed]"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onSelect(product);
                  setIsOpen(false);
                  setActiveIndex(-1);
                }}
              >
                <img
                  className="h-14 w-14 rounded object-cover"
                  src={product.image || DEFAULT_PRODUCTS[0].image}
                  alt=""
                />
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{product.name}</strong>
                  <span className="block truncate text-xs text-muted">
                    {product.category} · {product.detail}
                  </span>
                </span>
                <span className="whitespace-nowrap text-xs font-semibold">
                  {money(product.price)}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted" role="status">
              No encontramos productos coincidentes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Muestra el carrito lateral, sus controles de cantidad y el subtotal calculado.
 * @param {{open: boolean, onClose: () => void, cart: import("../models.js").CartLine[], products: import("../models.js").Product[], onChange: (id: string, delta: number) => void, onCheckout: () => void}} props
 */
function CartDrawer({ open, onClose, cart, products, onChange, onCheckout }) {
  useBodyScrollLock(open);
  const items = cart
    .map((line) => ({ ...products.find((item) => item.id === line.id), quantity: line.quantity }))
    .filter((item) => item.id);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink/40 transition-opacity ${open ? "visible opacity-100" : "invisible opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-paper p-5 shadow-2xl transition-transform duration-300 sm:p-7 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Carrito de compras"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex items-start justify-between border-b border-line pb-5">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-muted">Tu selección</p>
            <h2 className="mt-1 font-display text-3xl">
              Tu carrito{" "}
              <span className="text-lg text-muted">
                ({items.reduce((sum, item) => sum + item.quantity, 0)})
              </span>
            </h2>
          </div>
          <button className="icon-button text-xl" onClick={onClose} aria-label="Cerrar carrito">
            ×
          </button>
        </div>
        {!items.length ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <span className="text-5xl text-[#82936f]">◴</span>
              <p className="mt-4 font-display text-xl">Tu carrito está esperando algo especial.</p>
              <button
                className="mt-4 text-sm font-semibold underline underline-offset-4"
                onClick={onClose}
              >
                Seguir explorando
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="grid grid-cols-[4.5rem_1fr_auto] gap-3 border-b border-line py-5"
                >
                  <img
                    className="h-[4.5rem] w-[4.5rem] rounded object-cover"
                    src={item.image}
                    alt=""
                  />
                  <div>
                    <h3 className="font-display leading-snug">{item.name}</h3>
                    <p className="mt-1 text-xs text-muted">{money(item.price)} c/u</p>
                    <div className="mt-2 inline-flex items-center border border-line">
                      <button
                        className="h-7 w-8"
                        onClick={() => onChange(item.id, -1)}
                        aria-label="Quitar una unidad"
                      >
                        −
                      </button>
                      <span className="min-w-7 text-center text-sm">{item.quantity}</span>
                      <button
                        className="h-7 w-8"
                        disabled={item.quantity >= item.stock}
                        onClick={() => onChange(item.id, 1)}
                        aria-label="Agregar una unidad"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <strong className="whitespace-nowrap text-sm">
                      {money(item.price * item.quantity)}
                    </strong>
                    <button
                      className="grid h-9 w-9 place-items-center rounded-full text-[#9d5144] transition hover:bg-[#f8ece9]"
                      onClick={() => onChange(item.id, 0)}
                      aria-label={`Eliminar ${item.name} del carrito`}
                      title="Eliminar del carrito"
                    >
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="m19 6-1 14H6L5 6" />
                        <path d="M10 11v5M14 11v5" />
                      </svg>
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="border-t border-line pt-5">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <p className="my-3 text-xs text-muted">Envío e impuestos se calculan al finalizar.</p>
              <button className="btn-primary w-full" onClick={onCheckout}>
                Continuar compra <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/** Explica el requisito de cuenta y mantiene deshabilitado el acceso no autenticado. */
function AccountGate({ mode, onBack }) {
  const signup = mode === "crear-cuenta";
  const [password, setPassword] = useState("");
  const passwordRequirements = [
    { label: "Al menos 8 caracteres", met: password.length >= 8 },
    { label: "Una letra mayúscula", met: /[A-Z]/.test(password) },
    { label: "Una letra minúscula", met: /[a-z]/.test(password) },
    { label: "Un número", met: /\d/.test(password) },
    { label: "Un carácter especial (por ejemplo: !, @ o #)", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const metRequirements = passwordRequirements.filter((requirement) => requirement.met).length;
  const progressColor =
    metRequirements === passwordRequirements.length
      ? "bg-[#2f855a]"
      : metRequirements >= Math.ceil(passwordRequirements.length / 2)
        ? "bg-[#d69e2e]"
        : "bg-[#c53030]";
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center px-5 py-16 lg:grid-cols-[.9fr_1fr]">
      <button
        className="fixed left-5 top-5 z-40 rounded-full border border-line bg-white/90 px-4 py-2 text-sm font-semibold text-muted shadow-sm transition hover:bg-white hover:text-ink"
        onClick={onBack}
      >
        ← Volver a la página principal
      </button>
      <div className="hidden h-full min-h-[32rem] flex-col justify-between rounded-l-xl bg-leaf p-10 text-white lg:flex">
        <p className="text-xs uppercase tracking-[.25em] text-lime">Bienestar para cada día</p>
        <p className="font-display text-5xl leading-tight">
          Tu próxima
          <br />
          <em className="text-lime">buena elección</em>
          <br />
          empieza aquí.
        </p>
        <span className="text-xs tracking-widest">AMWAY · DESDE 1959</span>
      </div>
      <section className="rounded-xl border border-line bg-white p-7 shadow-sm sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">
          Tu cuenta Amway
        </p>
        <h1 className="mt-2 font-display text-4xl">{signup ? "Crear cuenta" : "Iniciar sesión"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {signup
            ? "Crea una cuenta para poder comprar. "
            : "Inicia sesión en tu cuenta para poder comprar. "}
          El servicio de cuentas aún no está conectado. Para proteger tus datos, no guardamos
          contraseñas en este navegador.
        </p>
        <form className="mt-7 grid gap-4" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span className="label">Correo electrónico</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              required
            />
          </label>
          <label>
            <span className="label">Contraseña</span>
            <input
              className="input"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder="Tu contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {signup && (
            <div aria-live="polite" className="-mt-2">
              <div
                className="h-2 overflow-hidden rounded-full bg-[#e7e7e0]"
                role="progressbar"
                aria-label="Seguridad de la contraseña"
                aria-valuemin={0}
                aria-valuemax={passwordRequirements.length}
                aria-valuenow={metRequirements}
              >
                <div
                  className={`h-full rounded-full transition-[width,background-color] duration-300 ${progressColor}`}
                  style={{
                    width: `${(metRequirements / passwordRequirements.length) * 100}%`,
                  }}
                />
              </div>
              <ul className="mt-3 grid gap-1.5 text-xs">
                {passwordRequirements.map((requirement) => (
                  <li
                    key={requirement.label}
                    className={`flex items-center gap-2 ${
                      requirement.met ? "text-[#2f855a]" : "text-[#c53030]"
                    }`}
                  >
                    <span aria-hidden="true" className="w-4 text-center font-bold">
                      {requirement.met ? "✓" : "×"}
                    </span>
                    {requirement.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {signup && (
            <label>
              <span className="label">Confirmar contraseña</span>
              <input className="input" type="password" autoComplete="new-password" required />
            </label>
          )}
          <button className="btn-primary mt-2 w-full" type="submit" disabled>
            {signup ? "Crear cuenta" : "Iniciar sesión"} <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="mt-5 text-sm text-muted">
          {signup ? "¿Ya tienes una cuenta?" : "¿No tienes una cuenta?"}{" "}
          <a
            className="font-semibold text-leaf underline underline-offset-4"
            href={`#${signup ? "iniciar-sesion" : "crear-cuenta"}`}
          >
            {signup ? "Iniciar sesión" : "Crear cuenta"}
          </a>
        </p>
        <p className="mt-6 rounded bg-[#f5f4ed] p-3 text-xs leading-5 text-muted">
          Las compras requieren una cuenta y una sesión verificada. La conexión segura con
          autenticación debe configurarse antes de habilitar esta acción.
        </p>
      </section>
    </main>
  );
}

/** Pantalla principal: sincroniza catálogo, filtros, carrito, cuenta y checkout. */
export function Storefront() {
  const [catalog, setCatalog] = useState(readCatalog);
  const [cart, setCart] = useState(() => loadCart(catalog.products));
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 40);
  const [route, setRoute] = useState(window.location.hash.replace("#", ""));
  const { notify, region } = useNotice();
  const accountMode = ["iniciar-sesion", "crear-cuenta"].includes(route);
  const productRouteId = route.startsWith("producto/")
    ? route.slice("producto/".length).split("/")[0]
    : "";
  const selectedProduct = catalog.products.find(
    (product) => encodeURIComponent(product.id) === productRouteId
  );
  const isProduct = Boolean(selectedProduct);
  const isCategory = catalog.categories.includes(decodeURIComponent(route));

  // Reduce el header fijo al desplazarse para dejar más espacio al contenido.
  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  // Lee la fuente compartida y ajusta el carrito tras cambios de inventario.
  const refresh = useCallback(() => {
    const nextCatalog = readCatalog();
    setCatalog(nextCatalog);
    setCart((current) => {
      const nextCart = loadCart(nextCatalog.products);
      if (JSON.stringify(nextCart) !== JSON.stringify(current)) saveCart(nextCart);
      return nextCart;
    });
  }, []);

  // Actualiza productos y carrito cuando Admin o una pestaña vecina modifica datos.
  const handleStorageChange = useCallback(
    (event) => {
      if (event.key === null || event.key === DATA_KEY) refresh();
      if (event.key === CART_KEY) setCart(loadCart(readCatalog().products));
    },
    [refresh]
  );

  useCrossTabStorage(handleStorageChange);

  // Sincroniza el hash de navegación y carga el catálogo al abrir la pantalla.
  useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash.replace("#", ""));
    window.addEventListener("hashchange", syncRoute);
    refresh();
    return () => {
      window.removeEventListener("hashchange", syncRoute);
    };
  }, [refresh]);

  useEffect(() => {
    if (!isProduct) return;
    if (route.endsWith("/resenas")) {
      document.getElementById("resenas")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isProduct, route]);

  // Aplica categoría y texto de búsqueda sin modificar el catálogo original.
  const filteredProducts = useMemo(() => {
    const selectedCategory = isCategory ? decodeURIComponent(route) : activeCategory;
    return catalog.products.filter((product) => {
      const categoryMatch = selectedCategory === "Todos" || product.category === selectedCategory;
      const queryMatch = `${product.name} ${product.category} ${product.detail} ${product.sku}`
        .toLocaleLowerCase("es-MX")
        .includes(query.trim().toLocaleLowerCase("es-MX"));
      return categoryMatch && queryMatch;
    });
  }, [activeCategory, catalog.products, isCategory, query, route]);

  // Busca sugerencias en todo el catálogo, independiente del filtro de categoría.
  const searchMatches = useMemo(() => {
    const searchTerm = query.trim().toLocaleLowerCase("es-MX");
    if (!searchTerm) return [];
    return catalog.products.filter((product) =>
      `${product.name} ${product.category} ${product.detail} ${product.sku}`
        .toLocaleLowerCase("es-MX")
        .includes(searchTerm)
    );
  }, [catalog.products, query]);

  // Seleccionar una sugerencia muestra su categoría y lleva al resultado filtrado.
  const selectSearchResult = (product) => {
    setQuery(product.name);
    setActiveCategory("Todos");
    window.location.hash = "todos-productos";
    document.getElementById("todos-productos")?.scrollIntoView({ behavior: "smooth" });
  };

  // Modifica una unidad del carrito, verifica inventario y persiste antes de actualizar la UI.
  const changeCart = (productId, difference) => {
    const product = catalog.products.find((item) => item.id === productId);
    const current = cart.find((item) => item.id === productId)?.quantity || 0;
    if (difference === 0 || current + difference <= 0) {
      const updated = cart.filter((item) => item.id !== productId);
      if (!saveCart(updated)) {
        notify("No se pudo guardar el carrito.", "error");
        return;
      }
      setCart(updated);
      return;
    }
    if (!product || current + difference > product.stock) {
      notify(
        `Existencias disponibles de ${product?.name || "este producto"}: ${product?.stock || 0}.`,
        "error"
      );
      return;
    }
    const updated = current
      ? cart.map((item) =>
          item.id === productId ? { ...item, quantity: current + difference } : item
        )
      : [...cart, { id: productId, quantity: 1 }];
    if (!saveCart(updated)) {
      notify("No se pudo guardar el carrito.", "error");
      return;
    }
    setCart(updated);
    if (difference > 0) notify(`${product.name} se agregó al carrito.`);
  };

  // Requiere una marca de sesión antes de abrir checkout; conserva el carrito local.
  const goCheckout = () => {
    if (!cart.length) return;
    setCartOpen(false);
    if (!sessionStorage.getItem("amway-customer-authenticated")) {
      window.location.href = "./#iniciar-sesion";
      return;
    }
    window.location.href = "?page=checkout";
  };

  const accountScreen = accountMode;
  // Renderiza cabecera, contenido de tienda o cuenta, avisos y carrito compartido.
  return (
    <div className="page-shell">
      {!accountScreen && (
        <>
          <div className="bg-leaf px-4 py-2 text-center text-[.7rem] tracking-[.12em] text-white sm:text-xs">
            Bienestar que se siente. Calidad en la que puedes confiar.
          </div>
          <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-7">
              <Brand to="./#inicio" />
              <div className="min-w-0 max-w-xl flex-1">
                <ProductSearch
                  query={query}
                  onQueryChange={setQuery}
                  products={searchMatches}
                  onSelect={selectSearchResult}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-5">
                <a
                  href="#iniciar-sesion"
                  className="whitespace-nowrap text-xs font-semibold sm:text-sm"
                >
                  <span className="sm:hidden">Entrar</span>
                  <span className="hidden sm:inline">Iniciar sesión</span>
                </a>
                <button
                  className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-xl"
                  onClick={() => setCartOpen(true)}
                  aria-label="Abrir carrito"
                >
                  ♧
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-leaf px-1 text-[.65rem] text-white">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </button>
              </div>
            </div>
            <div
              className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
                isScrolled ? "max-h-0 opacity-0" : "max-h-20 opacity-100"
              }`}
              aria-hidden={isScrolled}
              inert={isScrolled}
            >
              <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-7">
                {["Todos", ...catalog.categories].map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setActiveCategory(category);
                      window.location.hash =
                        category === "Todos" ? "todos-productos" : encodeURIComponent(category);
                      if (category !== "Todos") window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${(isCategory && decodeURIComponent(route) === category) || (!isCategory && activeCategory === category) ? "bg-leaf text-white" : "text-muted hover:bg-white"}`}
                  >
                    {category}
                  </button>
                ))}
                <a
                  className="ml-auto hidden whitespace-nowrap px-2 py-2 text-xs font-semibold text-muted hover:text-leaf lg:block"
                  href="?page=admin"
                >
                  Portal de administración ↗
                </a>
              </div>
            </div>
          </header>
        </>
      )}

      {accountScreen ? (
        <AccountGate
          mode={route}
          onBack={() => {
            window.location.hash = "inicio";
          }}
        />
      ) : (
        <>
          <main>
            {isProduct ? (
              <ProductDetail
                product={selectedProduct}
                products={catalog.products}
                onAdd={(item) => changeCart(item.id, 1)}
              />
            ) : (
              <>
                {isCategory ? (
                  <section className="bg-[#e8ebe0] px-5 py-12 sm:px-8 sm:py-16">
                    <div className="mx-auto max-w-7xl">
                      <a
                        href="./#inicio"
                        className="text-sm font-semibold text-leaf underline underline-offset-4"
                      >
                        ← Volver a la página principal
                      </a>
                      <p className="mt-10 text-xs font-bold uppercase tracking-[.2em] text-[#66764e]">
                        Explora la categoría
                      </p>
                      <h1 className="mt-3 font-display text-4xl sm:text-6xl">
                        {decodeURIComponent(route)}
                      </h1>
                      <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                        Encuentra productos seleccionados de {decodeURIComponent(route)} para
                        acompañarte cada día.
                      </p>
                    </div>
                  </section>
                ) : (
                  <>
                    <section id="inicio" className="relative isolate overflow-hidden bg-[#e8ebe0]">
                      <div className="absolute inset-0 -z-10 bg-[url('https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=1800&q=85')] bg-cover bg-center opacity-20" />
                      <div className="mx-auto grid min-h-[33rem] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_.8fr] lg:py-20">
                        <div className="max-w-2xl">
                          <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-[#66764e]">
                            <span className="h-px w-8 bg-[#66764e]" />
                            Bienestar, a tu manera
                          </p>
                          <h1 className="font-display text-5xl leading-[1.08] sm:text-6xl lg:text-7xl">
                            Pequeñas elecciones.
                            <br />
                            <em className="text-leaf">Una vida más plena.</em>
                          </h1>
                          <p className="mt-6 max-w-lg text-base leading-7 text-muted">
                            Encuentra tus esenciales para sentirte bien, cuidar de los tuyos y hacer
                            de cada día algo mejor.
                          </p>
                          <a href="#todos-productos" className="btn-primary mt-8">
                            Explorar productos <span aria-hidden="true">→</span>
                          </a>
                          <div className="mt-12 flex items-center gap-3 text-xs text-muted">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-lime font-display text-lg font-bold">
                              A
                            </span>
                            Calidad pensada para acompañarte
                            <br />
                            en cada momento.
                          </div>
                        </div>
                        <div className="relative hidden aspect-[4/4.2] overflow-hidden rounded-[45%_45%_8px_8px] bg-[#c5cbb4] lg:block">
                          <img
                            className="h-full w-full object-cover mix-blend-multiply"
                            src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1000&q=85"
                            alt="Productos de cuidado y bienestar"
                          />
                          <div className="absolute bottom-5 left-5 rounded bg-white/90 px-4 py-3 text-xs">
                            <strong className="block uppercase tracking-widest">AMWAY</strong>
                            Bienestar desde 1959
                          </div>
                        </div>
                      </div>
                    </section>
                    <section
                      id="categorias"
                      className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24"
                    >
                      <SectionTitle
                        eyebrow="Encuentra tu favorito"
                        title={
                          <>
                            Un mundo de <em>posibilidades</em>
                          </>
                        }
                        description="Explora las categorías y encuentra aquello que acompaña tu bienestar."
                        action={
                          <a
                            href="#todos-productos"
                            className="hidden text-sm font-semibold text-leaf underline underline-offset-4 sm:block"
                          >
                            Ver todos los productos →
                          </a>
                        }
                      />
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {catalog.categories.map((category, index) => (
                          <a
                            key={category}
                            href={`#${encodeURIComponent(category)}`}
                            onClick={() => setActiveCategory(category)}
                            className={`group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-lg p-6 ${categoryArt[index % categoryArt.length]} transition hover:-translate-y-1`}
                          >
                            <span className="text-xs font-bold uppercase tracking-[.15em] text-leaf">
                              0{index + 1}
                            </span>
                            <span className="font-display text-2xl">{category}</span>
                            <span className="absolute right-5 top-5 text-4xl text-leaf/25 transition group-hover:translate-x-1">
                              ↗
                            </span>
                          </a>
                        ))}
                      </div>
                    </section>
                  </>
                )}
                <section id="todos-productos" className="scroll-mt-28 bg-white py-16 sm:py-24">
                  <div className="mx-auto max-w-7xl px-5 sm:px-8">
                    <SectionTitle
                      eyebrow="Lo nuevo para ti"
                      title={
                        isCategory ? (
                          <>
                            {decodeURIComponent(route)} <em>para cada día</em>
                          </>
                        ) : (
                          <>
                            Esenciales <em>para sentirte bien</em>
                          </>
                        )
                      }
                      description="Productos seleccionados para acompañar tus rutinas y momentos."
                    />
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-2 overflow-x-auto">
                        {["Todos", ...catalog.categories].map((category) => (
                          <button
                            key={category}
                            onClick={() => {
                              setActiveCategory(category);
                              if (isCategory)
                                window.location.hash =
                                  category === "Todos"
                                    ? "todos-productos"
                                    : encodeURIComponent(category);
                            }}
                            className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs ${(isCategory ? decodeURIComponent(route) : activeCategory) === category ? "border-leaf bg-leaf text-white" : "border-line hover:bg-paper"}`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-muted">
                        {filteredProducts.length} productos
                      </span>
                    </div>
                    <div className="mb-6 md:hidden">
                      <ProductSearch
                        query={query}
                        onQueryChange={setQuery}
                        products={searchMatches}
                        onSelect={selectSearchResult}
                      />
                    </div>
                    {filteredProducts.length ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {filteredProducts.map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onAdd={(item) => changeCart(item.id, 1)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-paper p-12 text-center text-muted">
                        No encontramos productos con esa búsqueda.
                      </div>
                    )}
                  </div>
                </section>
                {!isCategory && (
                  <section className="bg-leaf px-5 py-16 text-center text-white sm:py-20">
                    <p className="text-xs uppercase tracking-[.22em] text-lime">Nuestra promesa</p>
                    <h2 className="mt-3 font-display text-4xl sm:text-5xl">AMWAYPROMISE</h2>
                    <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/75">
                      La satisfacción siempre será nuestro objetivo y la protección, nuestra
                      promesa.
                    </p>
                  </section>
                )}
              </>
            )}
          </main>
          <footer className="flex flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted sm:flex-row sm:px-10">
            <Brand to="./#inicio" />
            <span>© 2026 Amway · Bienestar para cada día</span>
            <a href="?page=admin" className="text-xs underline underline-offset-4">
              Administración
            </a>
          </footer>
        </>
      )}
      {region}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        products={catalog.products}
        onChange={changeCart}
        onCheckout={goCheckout}
      />
    </div>
  );
}
