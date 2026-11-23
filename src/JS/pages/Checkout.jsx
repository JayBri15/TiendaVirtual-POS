import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CART_KEY, CATALOG_CHANGE_KEY, loadCart, saveCart } from "../services/catalogStorage.js";
import { fetchPublicCatalog } from "../services/catalogApi.js";
import {
  createCustomerOrder,
  readCustomerAddresses,
  readCustomerSession,
} from "../services/customerApi.js";
import { getProvinceMunicipalities, PROVINCES } from "dominican-republic-geodata";
import { quoteDelivery } from "../../../shared/deliverySettings.js";
import { EPS_LOCATIONS } from "../../../shared/epsLocations.js";
import { readDeliverySettings } from "../services/deliveryApi.js";
import { money } from "../shared/format.js";
import { Brand, useCrossTabStorage, useNotice } from "../shared/ui.jsx";

const emptyAddress = {
  name: "",
  street: "",
  city: "",
  region: "",
  municipality: "",
  sector: "",
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
function SummaryCard({ items, subtotal, shippingCost = null }) {
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
          <dd>{shippingCost === null ? "Por calcular" : money(shippingCost)}</dd>
        </div>
      </dl>
      <div className="mt-5 flex justify-between border-t border-line pt-5">
        <strong>Total estimado</strong>
        <strong className="text-lg">
          {shippingCost === null ? "Por calcular" : money(subtotal + shippingCost)}
        </strong>
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
  const [deliverySettings, setDeliverySettings] = useState(null);
  const [deliverySettingsStatus, setDeliverySettingsStatus] = useState("loading");
  const [customerAddresses, setCustomerAddresses] = useState({ primary: null, alternate: null });
  const [addressChoice, setAddressChoice] = useState("primary");
  const [epsLocationId, setEpsLocationId] = useState("");
  const [saveAlternateAddress, setSaveAlternateAddress] = useState(true);
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
  const municipalities = useMemo(() => {
    const province = PROVINCES.find((item) => item.name === address.region);
    return province ? getProvinceMunicipalities(province.id) : [];
  }, [address.region]);
  const selectedEpsLocation = EPS_LOCATIONS.find((location) => location.id === epsLocationId);
  const deliveryMethod = addressChoice === "eps" ? "eps" : "address";
  const deliveryQuote =
    deliverySettings &&
    (deliveryMethod !== "eps" || deliverySettings.availableEpsLocationIds.includes(epsLocationId))
      ? quoteDelivery(deliverySettings, deliveryMethod, address)
      : null;

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
      const savedAddresses = profile
        ? await readCustomerAddresses()
        : { primary: null, alternate: null };
      setCustomer(profile);
      setCustomerAddresses(savedAddresses);
      setAddressChoice(savedAddresses.primary ? "primary" : "alternate");
      setCustomerStatus(profile ? "authenticated" : "unauthenticated");
      if (profile) {
        const primaryAddress = savedAddresses.primary;
        setAddress((current) => ({
          ...emptyAddress,
          ...(primaryAddress || current),
          name: current.name || primaryAddress?.name || profile.name,
          phone: current.phone || primaryAddress?.phone || profile.phone,
        }));
      }
    } catch (error) {
      console.error("No se pudo comprobar la sesión de cliente en Checkout.", error);
      setCustomerStatus("error");
    }
  }, []);

  const refreshDeliverySettings = useCallback(async () => {
    setDeliverySettingsStatus("loading");
    try {
      setDeliverySettings(await readDeliverySettings());
      setDeliverySettingsStatus("ready");
    } catch (error) {
      console.error("No se pudieron leer las tarifas de entrega.", error);
      setDeliverySettingsStatus("error");
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
    refreshCustomerSession();
    refreshDeliverySettings();
  }, [refreshCatalog, refreshCustomerSession, refreshDeliverySettings]);

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

  const setCartQuantity = (id, quantity) => {
    const product = catalog.products.find((item) => item.id === id);
    const nextQuantity = Math.min(product?.stock || 1, Math.max(1, Math.floor(quantity)));
    const nextCart = cart.map((item) =>
      item.id === id ? { ...item, quantity: nextQuantity } : item
    );
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
      const isEpsPickup = addressChoice === "eps";
      const savedOrder = await createCustomerOrder({
        address: isEpsPickup ? { name: address.name, phone: address.phone } : address,
        deliveryMethod: isEpsPickup ? "eps" : "address",
        ...(isEpsPickup ? { epsLocationId } : {}),
        saveAsAlternate:
          Boolean(customerAddresses.primary) &&
          !isEpsPickup &&
          addressChoice === "alternate" &&
          saveAlternateAddress,
        items: items.map(({ id, quantity }) => ({ productId: id, quantity })),
      });
      if (!isEpsPickup) {
        if (!customerAddresses.primary) {
          setCustomerAddresses((current) => ({ ...current, primary: { ...address } }));
        } else if (addressChoice === "alternate" && saveAlternateAddress) {
          setCustomerAddresses((current) => ({ ...current, alternate: { ...address } }));
        }
      }
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
            <a
              href="./#todos-productos"
              className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-leaf transition hover:bg-paper"
            >
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
          <a
            href="./#todos-productos"
            className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-leaf transition hover:bg-paper"
          >
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
            {order.shippingAddress.deliveryMethod === "eps" && (
              <div className="mt-5 rounded bg-paper p-4 text-left text-sm">
                <strong className="block">Retiro en sucursal EPS</strong>
                <span className="mt-1 block">
                  {order.shippingAddress.epsLocation.name} —{" "}
                  {[
                    order.shippingAddress.epsLocation.address,
                    order.shippingAddress.epsLocation.city,
                    order.shippingAddress.epsLocation.region,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
            <dl className="mx-auto mt-6 grid max-w-sm gap-2 text-sm">
              <div className="flex justify-between">
                <dt>Productos</dt>
                <dd>{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Envío</dt>
                <dd>{money(order.shippingCost)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-3 font-semibold">
                <dt>
                  {order.items.reduce((count, item) => count + item.quantity, 0)} artículos · Total
                </dt>
                <dd>{money(order.total)}</dd>
              </div>
            </dl>
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
                                <input
                                  className="cart-quantity-input"
                                  type="number"
                                  min="1"
                                  max={item.stock}
                                  value={item.quantity}
                                  onChange={(event) =>
                                    setCartQuantity(item.id, Number(event.target.value) || 1)
                                  }
                                  aria-label={`Cantidad de ${item.name}`}
                                />
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
                            <div className="flex flex-col items-end justify-between">
                              <strong className="text-sm">
                                {money(item.price * item.quantity)}
                              </strong>
                              <button
                                type="button"
                                className="grid h-9 w-9 place-items-center rounded-full text-[#9d5144] transition hover:bg-[#f8ece9]"
                                onClick={() => updateCart(item.id, 0)}
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
                      <h2 className="font-display text-2xl">Opciones de entrega</h2>
                      <p className="mt-2 text-sm text-muted">
                        Recibirás un pedido pendiente. No se te cobrará en este paso.
                      </p>
                      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
                        <legend className="label">Ubicación de entrega</legend>
                        {customerAddresses.primary && (
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded border p-4 ${
                              addressChoice === "primary"
                                ? "border-leaf bg-[#eff2e7]"
                                : "border-line"
                            }`}
                          >
                            <input
                              type="radio"
                              name="addressChoice"
                              value="primary"
                              checked={addressChoice === "primary"}
                              onChange={() => {
                                setAddressChoice("primary");
                                setSaveAlternateAddress(Boolean(customerAddresses.alternate));
                                setAddress(customerAddresses.primary);
                              }}
                            />
                            <span className="text-sm">
                              <strong className="block">Dirección predeterminada</strong>
                              <span className="mt-1 block text-muted">
                                {[
                                  customerAddresses.primary.street,
                                  customerAddresses.primary.sector,
                                  customerAddresses.primary.municipality,
                                  customerAddresses.primary.city,
                                  customerAddresses.primary.region,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </span>
                          </label>
                        )}
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded border p-4 ${
                            addressChoice === "eps" ? "border-leaf bg-[#eff2e7]" : "border-line"
                          }`}
                        >
                          <input
                            type="radio"
                            name="addressChoice"
                            value="eps"
                            checked={addressChoice === "eps"}
                            onChange={() => {
                              setAddressChoice("eps");
                              setAddress((current) => ({
                                ...current,
                                name: current.name || customer.name,
                                phone: current.phone || customer.phone,
                              }));
                            }}
                          />
                          <span className="text-sm">
                            <strong className="block">Retirar en sucursal EPS</strong>
                            <span className="mt-1 block text-muted">
                              Elige una ubicación disponible en República Dominicana.
                            </span>
                          </span>
                        </label>
                        <button
                          className={`inline-flex min-h-12 items-center gap-2 self-start rounded-full border px-5 py-3 text-sm font-semibold transition-colors ${
                            addressChoice === "alternate"
                              ? "border-leaf bg-[#eff2e7] text-leaf"
                              : "border-line bg-white text-ink hover:border-leaf"
                          }`}
                          type="button"
                          aria-pressed={addressChoice === "alternate"}
                          onClick={() => {
                            setAddressChoice("alternate");
                            setAddress(
                              customerAddresses.alternate || {
                                ...emptyAddress,
                                name: customer.name,
                                phone: customer.phone,
                              }
                            );
                          }}
                        >
                          <span aria-hidden="true" className="text-lg leading-none">
                            +
                          </span>
                          Otra dirección
                        </button>
                      </fieldset>
                      {addressChoice === "eps" && (
                        <div className="mt-5">
                          <label className="label" htmlFor="checkout-eps-location">
                            Sucursal EPS
                          </label>
                          <select
                            id="checkout-eps-location"
                            className="input"
                            value={epsLocationId}
                            required
                            onChange={(event) => setEpsLocationId(event.target.value)}
                          >
                            <option value="">Selecciona una sucursal</option>
                            {EPS_LOCATIONS.filter((location) =>
                              deliverySettings?.availableEpsLocationIds.includes(location.id)
                            ).map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name} — {location.city}, {location.region}
                              </option>
                            ))}
                          </select>
                          {selectedEpsLocation && (
                            <p className="mt-2 text-sm text-muted">{selectedEpsLocation.address}</p>
                          )}
                        </div>
                      )}
                      {deliverySettingsStatus === "error" && (
                        <p className="mt-4 text-sm text-[#9d5144]" role="alert">
                          No se pudieron cargar las tarifas. Vuelve a cargar la página o contacta al
                          administrador.
                        </p>
                      )}
                      {deliverySettingsStatus === "ready" && !deliveryQuote && (
                        <p
                          className="mt-4 rounded bg-[#fff4e5] p-3 text-sm text-[#8c5727]"
                          role="alert"
                        >
                          {deliveryMethod === "eps"
                            ? !epsLocationId
                              ? "Selecciona una sucursal EPS para calcular el costo de retiro."
                              : "La sucursal seleccionada ya no está disponible. Elige otra o contacta al administrador."
                            : !address.region || !address.municipality
                              ? "Selecciona la provincia y el municipio para calcular el envío."
                              : "Esta ubicación no tiene una zona de entrega asignada. Contacta al administrador para revisar la cobertura."}
                        </p>
                      )}
                      {deliveryQuote && (
                        <p className="mt-4 rounded bg-[#eff2e7] p-3 text-sm text-leaf">
                          {deliveryQuote.zone
                            ? `${deliveryQuote.zone.name} · envío ${money(deliveryQuote.fee)}`
                            : `Retiro en sucursal EPS · ${money(deliveryQuote.fee)}`}
                        </p>
                      )}
                      {(addressChoice === "alternate" ||
                        (!customerAddresses.primary && addressChoice !== "eps")) && (
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          {[
                            ["name", "Nombre completo", "text", "name", 120],
                            ["street", "Calle y número", "text", "street-address", 200],
                            ["region", "Provincia/Estado", "select", "address-level1", 100],
                            ["municipality", "Municipio", "select", "", 100],
                            ["city", "Ciudad", "text", "address-level2", 100],
                            ["sector", "Sector", "text", "", 100],
                            ["postalCode", "Código postal", "text", "postal-code", 20],
                            ["phone", "Teléfono de contacto", "tel", "tel", 40],
                          ].map(([field, label, type, autoComplete, maxLength]) => (
                            <div
                              key={field}
                              className={
                                field === "name" || field === "street" ? "sm:col-span-2" : ""
                              }
                            >
                              <label className="label" htmlFor={`checkout-${field}`}>
                                {label}
                              </label>
                              {field === "region" ? (
                                <select
                                  id="checkout-region"
                                  className="input"
                                  autoComplete="address-level1"
                                  value={address.region}
                                  required
                                  onChange={(event) =>
                                    setAddress((current) => ({
                                      ...current,
                                      region: event.target.value,
                                      municipality: "",
                                    }))
                                  }
                                >
                                  <option value="">Selecciona una provincia</option>
                                  {PROVINCES.toSorted((a, b) =>
                                    a.name.localeCompare(b.name, "es")
                                  ).map((province) => (
                                    <option key={province.id} value={province.name}>
                                      {province.name}
                                    </option>
                                  ))}
                                </select>
                              ) : field === "municipality" ? (
                                <select
                                  id="checkout-municipality"
                                  className="input"
                                  value={address.municipality}
                                  required
                                  disabled={!address.region}
                                  onChange={(event) =>
                                    setAddress((current) => ({
                                      ...current,
                                      municipality: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">
                                    {address.region
                                      ? "Selecciona un municipio"
                                      : "Primero selecciona una provincia"}
                                  </option>
                                  {municipalities.map((municipality) => (
                                    <option key={municipality.id} value={municipality.name}>
                                      {municipality.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  id={`checkout-${field}`}
                                  className="input"
                                  type={type}
                                  autoComplete={autoComplete || undefined}
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
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {addressChoice === "eps" && (
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          {[
                            ["name", "Nombre completo", "text", "name", 120],
                            ["phone", "Teléfono de contacto", "tel", "tel", 40],
                          ].map(([field, label, type, autoComplete, maxLength]) => (
                            <div key={field}>
                              <label className="label" htmlFor={`checkout-${field}`}>
                                {label}
                              </label>
                              <input
                                id={`checkout-${field}`}
                                className="input"
                                type={type}
                                autoComplete={autoComplete || undefined}
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
                            </div>
                          ))}
                        </div>
                      )}
                      {customerAddresses.primary && addressChoice === "alternate" && (
                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded bg-paper p-4 text-sm">
                          <input
                            className="mt-1 accent-[#25483b]"
                            type="checkbox"
                            checked={saveAlternateAddress}
                            onChange={(event) => setSaveAlternateAddress(event.target.checked)}
                          />
                          <span>
                            Guardar esta ubicación aparte de la dirección predeterminada para
                            futuras compras.
                          </span>
                        </label>
                      )}
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
                        <button
                          className="btn-primary"
                          type="submit"
                          disabled={busy || deliverySettingsStatus !== "ready" || !deliveryQuote}
                        >
                          {busy ? "Guardando pedido..." : "Crear pedido"}{" "}
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </form>
                    <SummaryCard
                      items={items}
                      subtotal={subtotal}
                      shippingCost={deliveryQuote?.fee ?? null}
                    />
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
