import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CART_KEY, CATALOG_CHANGE_KEY, loadCart, saveCart } from "../services/catalogStorage.js";
import { fetchPublicCatalog } from "../services/catalogApi.js";
import { createCustomerOrder, readCustomerSession } from "../services/customerApi.js";
import { money } from "../shared/format.js";
import { Brand, useCrossTabStorage, useNotice } from "../shared/ui.jsx";

const emptyAddress = {
  name: "",
  street: "",
  city: "",
  region: "",
  postalCode: "",
  phone: "",
};

const steps = [
  { id: "review", title: "Resumen" },
  { id: "address", title: "Entrega" },
];

/**
 * Resume el importe de los productos. El backend calculará el valor final al recibir el pedido.
 */
function SummaryCard({ items, subtotal }) {
  return (
    <aside className="card h-max p-5 sm:p-6">
      <h2 className="font-display text-xl">Resumen del pedido</h2>
      <dl className="mt-5 grid gap-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Productos</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Envío</dt>
          <dd>Por confirmar</dd>
        </div>
      </dl>
      <div className="mt-5 flex justify-between border-t border-line pt-5">
        <strong>Total estimado</strong>
        <strong className="text-lg">{money(subtotal)}</strong>
      </div>
      <p className="mt-4 rounded bg-paper p-3 text-xs leading-5 text-muted">
        Este pedido no genera un cobro ni reserva existencias. Admin confirmará la disponibilidad
        antes de descontar el inventario.
      </p>
      <p className="mt-3 text-xs leading-5 text-muted">
        No ingreses datos de tarjeta: esta tienda aún no procesa pagos.
      </p>
    </aside>
  );
}

/** Revisa el carrito y registra un pedido pendiente, sin procesar pagos ni reservar existencias. */
export function Checkout() {
  const [catalog, setCatalog] = useState({ products: [], categories: [] });
  const [catalogStatus, setCatalogStatus] = useState("loading");
  const [cart, setCart] = useState([]);
  const [customerStatus, setCustomerStatus] = useState("checking");
  const [customer, setCustomer] = useState(null);
  const [step, setStep] = useState("review");
  const [confirmed, setConfirmed] = useState(false);
  const [address, setAddress] = useState(emptyAddress);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { notify, region: noticeRegion } = useNotice();

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

  const refreshCatalog = useCallback(async () => {
    setCatalogStatus("loading");
    try {
      const nextCatalog = await fetchPublicCatalog();
      const nextCart = loadCart(nextCatalog.products);
      setCatalog(nextCatalog);
      setCart(nextCart);
      setCatalogStatus("ready");
    } catch (error) {
      console.error("No se pudo cargar el catálogo del backend para Checkout.", error);
      setCatalogStatus("error");
    }
  }, []);

  const refreshCustomerSession = useCallback(async () => {
    setCustomerStatus("checking");
    try {
      const profile = await readCustomerSession();
      setCustomer(profile);
      setCustomerStatus(profile ? "authenticated" : "unauthenticated");
      if (profile) {
        setAddress((current) => ({
          ...current,
          name: current.name || profile.name,
          phone: current.phone || profile.phone,
        }));
      }
    } catch (error) {
      console.error("No se pudo comprobar la sesión de cliente en Checkout.", error);
      setCustomerStatus("error");
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
    refreshCustomerSession();
  }, [refreshCatalog, refreshCustomerSession]);

  const handleStorageChange = useCallback(
    (event) => {
      if (event.key === CART_KEY || event.key === CATALOG_CHANGE_KEY || event.key === null) {
        refreshCatalog();
      }
    },
    [refreshCatalog]
  );
  useCrossTabStorage(handleStorageChange);

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
    setErrorMessage("");
  };

  const createOrder = async (event) => {
    event.preventDefault();
    if (!customer || busy || items.length === 0) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const savedOrder = await createCustomerOrder({
        address,
        items: items.map(({ id, quantity }) => ({ productId: id, quantity })),
      });
      if (!saveCart([])) {
        notify("El pedido se guardó, pero no se pudo vaciar el carrito local.", "error");
      }
      setCart([]);
      setOrder(savedOrder);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el pedido.");
    } finally {
      setBusy(false);
    }
  };

  const goToLogin = () => {
    sessionStorage.setItem("amway-checkout-after-login", "true");
    window.location.href = "./#iniciar-sesion";
  };

  if (customerStatus === "checking" || customerStatus === "error") {
    return (
      <div className="min-h-screen bg-paper">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Brand to="./#inicio" />
            <a href="./#todos-productos" className="text-xs font-semibold text-leaf">
              Seguir comprando
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          {customerStatus === "checking" ? (
            <p className="text-sm text-muted" role="status">
              Comprobando tu sesión...
            </p>
          ) : (
            <>
              <h1 className="font-display text-3xl">No pudimos comprobar tu sesión</h1>
              <p className="mt-3 text-sm text-muted">
                Comprueba que el backend esté ejecutándose y vuelve a intentar.
              </p>
              <button className="btn-primary mt-6" onClick={refreshCustomerSession}>
                Intentar de nuevo
              </button>
            </>
          )}
        </main>
        {noticeRegion}
      </div>
    );
  }

  if (customerStatus === "unauthenticated") {
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
            Para crear un pedido necesitas una cuenta. Tu carrito se conservará al iniciar sesión.
          </p>
          <button className="btn-primary mt-7" onClick={goToLogin}>
            Iniciar sesión <span aria-hidden="true">→</span>
          </button>
          <p className="mt-5 text-sm text-muted">
            ¿Aún no tienes cuenta?{" "}
            <button
              className="font-semibold text-leaf underline underline-offset-4"
              onClick={() => {
                sessionStorage.setItem("amway-checkout-after-login", "true");
                window.location.href = "./#crear-cuenta";
              }}
            >
              Crear cuenta
            </button>
          </p>
        </main>
        {noticeRegion}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-leaf px-4 py-2 text-center text-[.7rem] tracking-widest text-white">
        PEDIDO EN LÍNEA · SIN PROCESAMIENTO DE PAGO
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Brand to="./#inicio" />
          <span className="hidden text-xs text-muted sm:block">Sesión: {customer?.name}</span>
          <a href="./#todos-productos" className="text-xs font-semibold text-leaf">
            Seguir comprando
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        {order ? (
          <section className="card mx-auto max-w-2xl p-8 text-center sm:p-12">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e8f2e9] text-2xl text-[#2f855a]">
              ✓
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">
              Pedido registrado
            </p>
            <h1 className="mt-2 font-display text-3xl">Gracias, {order.shippingAddress.name}</h1>
            <p className="mt-4 text-sm leading-6 text-muted">
              Tu pedido <strong>{order.id.slice(-8).toUpperCase()}</strong> está pendiente de
              confirmación. El equipo revisará existencias antes de confirmarlo. Todavía no se
              realizó ningún cobro y el inventario no se ha descontado.
            </p>
            <div className="mt-6 flex justify-center gap-8 text-sm">
              <span>{order.items.reduce((count, item) => count + item.quantity, 0)} artículos</span>
              <strong>{money(order.total)}</strong>
            </div>
            <a href="./#inicio" className="btn-primary mt-8">
              Volver a la tienda
            </a>
          </section>
        ) : (
          <>
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">
                Finaliza tu compra
              </p>
              <h1 className="mt-2 font-display text-4xl">
                {steps.find((item) => item.id === step)?.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Revisa tus artículos y los datos de entrega para registrar un pedido pendiente.
              </p>
            </div>
            <ol className="mb-8 grid grid-cols-2 border-b border-line pb-5">
              {steps.map((item, index) => {
                const activeIndex = steps.findIndex((current) => current.id === step);
                return (
                  <li
                    key={item.id}
                    className={`flex items-center gap-2 text-xs sm:gap-3 sm:text-sm ${
                      index <= activeIndex ? "font-semibold text-leaf" : "text-muted"
                    }`}
                    aria-current={item.id === step ? "step" : undefined}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full border ${
                        index <= activeIndex ? "border-leaf bg-leaf text-white" : "border-line"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {item.title}
                  </li>
                );
              })}
            </ol>
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
                              <strong className="text-sm">
                                {money(item.price * item.quantity)}
                              </strong>
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
                        <span>Confirmo que revisé los artículos y el total estimado.</span>
                      </label>
                      <button
                        className="btn-primary mt-5 w-full sm:w-auto"
                        disabled={!confirmed}
                        onClick={() => setStep("address")}
                      >
                        Continuar a entrega <span aria-hidden="true">→</span>
                      </button>
                    </section>
                    <SummaryCard items={items} subtotal={subtotal} />
                  </div>
                )}
                {step === "address" && (
                  <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                    <form className="card p-5 sm:p-7" onSubmit={createOrder}>
                      <h2 className="font-display text-2xl">Dirección de entrega</h2>
                      <p className="mt-2 text-sm text-muted">
                        Recibirás un pedido pendiente. No se te cobrará en este paso.
                      </p>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {[
                          ["name", "Nombre completo", "text", "name", 120],
                          ["street", "Calle y número", "text", "street-address", 200],
                          ["city", "Ciudad", "text", "address-level2", 100],
                          ["region", "Estado o provincia", "text", "address-level1", 100],
                          ["postalCode", "Código postal", "text", "postal-code", 20],
                          ["phone", "Teléfono de contacto", "tel", "tel", 40],
                        ].map(([field, label, type, autoComplete, maxLength]) => (
                          <label
                            key={field}
                            className={
                              field === "name" || field === "street" ? "sm:col-span-2" : ""
                            }
                          >
                            <span className="label">{label}</span>
                            <input
                              className="input"
                              type={type}
                              autoComplete={autoComplete}
                              value={address[field]}
                              maxLength={maxLength}
                              required
                              onChange={(event) =>
                                setAddress((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                      {errorMessage && (
                        <p className="mt-4 text-sm text-[#9d5144]" role="alert">
                          {errorMessage}
                        </p>
                      )}
                      <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => setStep("review")}
                          disabled={busy}
                        >
                          ← Volver al resumen
                        </button>
                        <button className="btn-primary" type="submit" disabled={busy}>
                          {busy ? "Guardando pedido..." : "Crear pedido"}{" "}
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </form>
                    <SummaryCard items={items} subtotal={subtotal} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      {noticeRegion}
    </div>
  );
}
