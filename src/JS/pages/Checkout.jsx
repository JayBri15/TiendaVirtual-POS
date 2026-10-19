import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CART_KEY, CATALOG_CHANGE_KEY, loadCart, saveCart } from "../services/catalogStorage.js";
import { fetchPublicCatalog } from "../services/catalogApi.js";
import { money } from "../shared/format.js";
import { Brand, useCrossTabStorage, useNotice } from "../shared/ui.jsx";

/** Pasos disponibles del checkout y su etiqueta para la barra de progreso. */
const steps = [
  { id: "review", title: "Resumen" },
  { id: "address", title: "Dirección" },
  { id: "payment", title: "Pago" },
];

/**
 * Muestra el paso activo y los pasos siguientes del proceso de compra.
 * @param {{active: string}} props Identificador del paso actual.
 */
function StepProgress({ active }) {
  const activeIndex = steps.findIndex((step) => step.id === active);
  return (
    <ol className="mb-8 grid grid-cols-3 border-b border-line pb-5">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={`flex items-center gap-2 text-xs sm:gap-3 sm:text-sm ${index <= activeIndex ? "font-semibold text-leaf" : "text-muted"}`}
          aria-current={step.id === active ? "step" : undefined}
        >
          <span
            className={`grid h-8 w-8 place-items-center rounded-full border ${index <= activeIndex ? "border-leaf bg-leaf text-white" : "border-line"}`}
          >
            {index + 1}
          </span>
          {step.title}
        </li>
      ))}
    </ol>
  );
}

/**
 * Presenta subtotales e informa cuáles cargos se calculan fuera del prototipo.
 * @param {{items: Array<import("../models.js").Product & {quantity: number}>, subtotal: number}} props Importe y artículos.
 */
function SummaryCard({ items, subtotal }) {
  return (
    <aside className="card h-max p-5 sm:p-6">
      <h2 className="font-display text-xl">Resumen de cobro</h2>
      <dl className="mt-5 grid gap-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal de artículos</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Envío</dt>
          <dd>Por calcular</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Impuestos</dt>
          <dd>Por calcular</dd>
        </div>
      </dl>
      <div className="mt-5 flex justify-between border-t border-line pt-5">
        <strong>Total de artículos</strong>
        <strong className="text-lg">{money(subtotal)}</strong>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">
        El total final se confirmará con la dirección y los cargos aplicables.
      </p>
      <p className="mt-4 rounded bg-paper p-3 text-[.7rem] leading-5 text-muted">
        Prototipo visual: no se recopilan ni transmiten datos bancarios y no se realiza ningún
        cobro.
      </p>
    </aside>
  );
}

/** Gestiona revisión del carrito, dirección y validación visual del método de pago. */
export function Checkout() {
  const [catalog, setCatalog] = useState({ products: [], categories: [] });
  const [catalogStatus, setCatalogStatus] = useState("loading");
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState("review");
  const [confirmed, setConfirmed] = useState(false);
  const [address, setAddress] = useState({
    name: "",
    street: "",
    city: "",
    region: "",
    postalCode: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [expiry, setExpiry] = useState("");
  const [message, setMessage] = useState("");
  const { notify, region } = useNotice();
  // Una marca de sesión local solo controla la vista; no reemplaza autenticación real.
  const authenticated = sessionStorage.getItem("amway-customer-authenticated") === "true";
  const items = useMemo(
    () =>
      cart
        .map((line) => ({
          ...catalog.products.find((product) => product.id === line.id),
          quantity: line.quantity,
        }))
        .filter((item) => item.id),
    [cart, catalog.products]
  );
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Consulta al backend y limita el carrito a los productos e inventario vigentes.
  const refreshCatalog = useCallback(async () => {
    setCatalogStatus("loading");
    try {
      const nextCatalog = await fetchPublicCatalog();
      const nextCart = loadCart(nextCatalog.products);
      setCatalog(nextCatalog);
      setCart(nextCart);
      setConfirmed(false);
      if (!nextCart.length) setStep("review");
      setCatalogStatus("ready");
    } catch (error) {
      console.error("No se pudo cargar el catálogo del backend para Checkout.", error);
      setCatalogStatus("error");
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // Recarga el catálogo si el carrito cambia en otra pestaña.
  const handleStorageChange = useCallback(
    (event) => {
      if (event.key === CART_KEY || event.key === CATALOG_CHANGE_KEY || event.key === null) {
        refreshCatalog();
      }
    },
    [refreshCatalog]
  );
  useCrossTabStorage(handleStorageChange);

  // Ajusta o elimina una línea y exige confirmar de nuevo el resumen si cambia.
  const updateCart = (id, amount) => {
    const product = catalog.products.find((item) => item.id === id);
    const quantity = cart.find((item) => item.id === id)?.quantity || 0;
    if (amount > 0 && (!product || quantity >= product.stock)) {
      notify("No hay más unidades disponibles de este producto.", "error");
      return;
    }
    const updated =
      amount === 0
        ? cart.filter((item) => item.id !== id)
        : cart.map((item) => (item.id === id ? { ...item, quantity: quantity + amount } : item));
    const nextCart = amount > 0 && quantity === 0 ? [...cart, { id, quantity: 1 }] : updated;
    if (!saveCart(nextCart)) {
      notify("No se pudo guardar el cambio al carrito.", "error");
      return;
    }
    setCart(nextCart);
    setConfirmed(false);
  };

  // Inserta automáticamente la diagonal al escribir el vencimiento MM/AA.
  const formatExpiry = (value, cursor) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    const formatted = digits.length >= 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    const count = value.slice(0, cursor).replace(/\D/g, "").length;
    return {
      formatted,
      position: Math.min(count + (count >= 2 && digits.length >= 2 ? 1 : 0), formatted.length),
    };
  };

  if (!authenticated)
    return (
      <div className="min-h-screen bg-paper px-5 py-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between">
          <Brand to="./#inicio" />
          <a href="./#inicio" className="text-sm text-muted hover:text-ink">
            ← Volver a la tienda
          </a>
        </header>
        <main className="mx-auto mt-16 max-w-xl rounded-xl border border-line bg-white p-8 text-center shadow-sm sm:p-12">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eef0e6] text-2xl text-leaf">
            ♙
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">
            Tu compra
          </p>
          <h1 className="mt-2 font-display text-3xl">Inicia sesión para continuar</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Necesitas una cuenta y una sesión verificada para acceder al checkout. La autenticación
            aún no está conectada; no ingreses contraseñas hasta que esté habilitada.
          </p>
          <a href="./#iniciar-sesion" className="btn-primary mt-7">
            Ir a iniciar sesión <span aria-hidden="true">→</span>
          </a>
          <p className="mt-5 text-xs leading-5 text-muted">
            Este prototipo no procesa pagos reales ni transmite datos personales.
          </p>
        </main>
        {region}
      </div>
    );

  // Cada sección aparece de acuerdo con el paso del flujo de compra seleccionado.
  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-leaf px-4 py-2 text-center text-[.7rem] tracking-widest text-white">
        COMPRA SEGURA · PROTOTIPO
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Brand to="./#inicio" />
          <span className="hidden text-xs text-muted sm:block">Finaliza tu compra</span>
          <a href="./#todos-productos" className="text-xs font-semibold text-leaf">
            Seguir comprando
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">
            Finaliza tu compra
          </p>
          <h1 className="mt-2 font-display text-4xl">
            {steps.find((item) => item.id === step)?.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Revisa tus artículos, confirma la entrega y elige cómo deseas pagar.
          </p>
        </div>
        <StepProgress active={step} />
        {catalogStatus === "loading" ? (
          <p className="card p-10 text-center text-muted" role="status">
            Comprobando productos y existencias...
          </p>
        ) : catalogStatus === "error" ? (
          <div className="card p-10 text-center" role="alert">
            <h2 className="font-display text-2xl">No pudimos comprobar los productos</h2>
            <p className="mt-2 text-sm text-muted">
              Verifica que el backend esté ejecutándose antes de continuar.
            </p>
            <button className="btn-primary mt-5" onClick={refreshCatalog}>
              Intentar de nuevo
            </button>
          </div>
        ) : !items.length ? (
          <div className="card p-10 text-center">
            <h2 className="font-display text-2xl">Tu carrito está vacío</h2>
            <p className="mt-2 text-sm text-muted">Agrega productos antes de continuar.</p>
            <a href="./#todos-productos" className="btn-primary mt-5">
              Explorar productos
            </a>
          </div>
        ) : (
          <>
            {step === "review" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <section className="card p-5 sm:p-7">
                  <h2 className="font-display text-2xl">Resumen de artículos</h2>
                  <div className="mt-4 divide-y divide-line">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="grid grid-cols-[4.5rem_1fr_auto] gap-4 py-4"
                      >
                        <img
                          className="h-[4.5rem] w-[4.5rem] rounded object-cover"
                          src={item.image}
                          alt=""
                        />
                        <div>
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="mt-1 text-xs text-muted">{money(item.price)} c/u</p>
                          <div className="mt-2 inline-flex items-center border border-line">
                            <button
                              className="h-7 w-8"
                              disabled={item.quantity <= 1}
                              onClick={() => updateCart(item.id, -1)}
                              aria-label="Quitar una unidad"
                            >
                              −
                            </button>
                            <span className="min-w-7 text-center text-sm">{item.quantity}</span>
                            <button
                              className="h-7 w-8"
                              disabled={item.quantity >= item.stock}
                              onClick={() => updateCart(item.id, 1)}
                              aria-label="Agregar una unidad"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          <strong className="text-sm">{money(item.price * item.quantity)}</strong>
                          <button
                            className="mt-3 block text-xs text-[#9d5144] underline"
                            onClick={() => updateCart(item.id, 0)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded bg-paper p-4 text-sm">
                    <input
                      className="mt-1 accent-[#25483b]"
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span>Confirmo que revisé los artículos y el resumen de cobro.</span>
                  </label>
                  <button
                    className="btn-primary mt-5 w-full sm:w-auto"
                    disabled={!confirmed}
                    onClick={() => setStep("address")}
                  >
                    Continuar a dirección <span aria-hidden="true">→</span>
                  </button>
                </section>
                <SummaryCard items={items} subtotal={subtotal} />
              </div>
            )}
            {step === "address" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <form
                  className="card p-5 sm:p-7"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setStep("payment");
                  }}
                >
                  <h2 className="font-display text-2xl">Dirección de entrega</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {[
                      ["name", "Nombre completo", "text"],
                      ["street", "Calle y número", "text"],
                      ["city", "Ciudad", "text"],
                      ["region", "Estado o provincia", "text"],
                      ["postalCode", "Código postal", "text"],
                      ["phone", "Teléfono de contacto", "tel"],
                    ].map(([field, label, type]) => (
                      <label
                        key={field}
                        className={field === "name" || field === "street" ? "sm:col-span-2" : ""}
                      >
                        <span className="label">{label}</span>
                        <input
                          className="input"
                          type={type}
                          autoComplete={
                            field === "street"
                              ? "street-address"
                              : field === "postalCode"
                                ? "postal-code"
                                : field
                          }
                          value={address[field]}
                          required
                          onChange={(event) =>
                            setAddress({ ...address, [field]: event.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => setStep("review")}
                    >
                      ← Volver al resumen
                    </button>
                    <button className="btn-primary" type="submit">
                      Continuar al pago →
                    </button>
                  </div>
                </form>
                <SummaryCard items={items} subtotal={subtotal} />
              </div>
            )}
            {step === "payment" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <form
                  className="card p-5 sm:p-7"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setMessage(
                      "Datos validados en este prototipo. No se guardaron ni enviaron datos y no se realizó ningún cobro."
                    );
                  }}
                >
                  <h2 className="font-display text-2xl">Método de pago</h2>
                  <fieldset className="mt-5 grid gap-3">
                    <legend className="label mb-3">Selecciona cómo deseas pagar</legend>
                    {[
                      ["card", "Tarjeta de crédito o débito"],
                      ["transfer", "Transferencia bancaria"],
                      ["cash", "Pago contra entrega"],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-center gap-3 rounded border border-line p-4 hover:bg-paper"
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={value}
                          checked={paymentMethod === value}
                          required
                          onChange={() => setPaymentMethod(value)}
                          className="accent-[#25483b]"
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    ))}
                  </fieldset>
                  {paymentMethod === "card" && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="label">Nombre en la tarjeta</span>
                        <input className="input" autoComplete="cc-name" required />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="label">Número de tarjeta</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          maxLength="19"
                          required
                        />
                      </label>
                      <label>
                        <span className="label">Vencimiento (MM/AA)</span>
                        <input
                          className="input"
                          value={expiry}
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          placeholder="MM/AA"
                          maxLength="5"
                          required
                          onChange={(event) => {
                            const cursor = event.target.selectionStart || 0;
                            const result = formatExpiry(event.target.value, cursor);
                            setExpiry(result.formatted);
                            requestAnimationFrame(() =>
                              event.target.setSelectionRange(result.position, result.position)
                            );
                          }}
                        />
                      </label>
                      <label>
                        <span className="label">CVV</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          maxLength="4"
                          required
                        />
                      </label>
                    </div>
                  )}
                  <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => setStep("address")}
                    >
                      ← Volver a dirección
                    </button>
                    <button className="btn-primary" type="submit">
                      Confirmar datos de pago
                    </button>
                  </div>
                  {message && (
                    <p className="mt-4 rounded bg-[#eff2e7] p-4 text-sm text-leaf" role="status">
                      {message}
                    </p>
                  )}
                </form>
                <SummaryCard items={items} subtotal={subtotal} />
              </div>
            )}
          </>
        )}
      </main>
      {region}
    </div>
  );
}
