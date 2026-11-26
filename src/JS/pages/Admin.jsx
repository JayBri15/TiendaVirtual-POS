import React, { useCallback, useEffect, useState } from "react";
import {
  CATALOG_CHANGE_KEY,
  DATA_KEY,
  ADMIN_DATA_CHANGE_KEY,
  isValidImage,
  saveCatalog,
} from "../services/catalogStorage.js";
import { readAdminData } from "../services/adminStorage.js";
import {
  createAdminCustomer,
  createAdminCategory,
  createAdminProduct,
  createAdminSale,
  cancelAdminOrder,
  confirmAdminOrder,
  deleteAdminCustomer,
  deleteAdminCategory,
  deleteAdminProduct,
  loginAdmin,
  readAdminCustomers,
  readAdminOrders,
  readAdminSales,
  logoutAdmin,
  readAdminSession,
  updateAdminCustomer,
  updateAdminCategory,
  updateAdminProduct,
  voidAdminSale,
} from "../services/adminApi.js";
import { fetchPublicCatalog } from "../services/catalogApi.js";
import { makeId, money } from "../shared/format.js";
import { DEFAULT_PRODUCTS } from "../data/defaultCatalog.js";
import { getProductDetails, getRecommendedProducts } from "../data/productDetails.js";
import { ProductDetail } from "../shared/ProductDetail.jsx";
import { Brand, Field, SelectMenu, useCrossTabStorage, useNotice } from "../shared/ui.jsx";
import { getProvinceMunicipalities, PROVINCES } from "dominican-republic-geodata";
import { EPS_LOCATIONS } from "../../../shared/epsLocations.js";
import { readAdminDeliverySettings, updateAdminDeliverySettings } from "../services/deliveryApi.js";

/** Reglas de negocio usadas por las operaciones del portal Admin. */
const LOW_STOCK = 5;
const PAYMENT_METHODS = ["Efectivo", "Tarjeta"];
const NAVIGATION = [
  ["dashboard", "▦", "Resumen"],
  ["pos", "▣", "Punto de venta"],
  ["products", "◇", "Productos"],
  ["inventory", "▤", "Inventario"],
  ["categories", "▧", "Categorías"],
  ["customers", "♙", "Clientes"],
  ["orders", "▣", "Pedidos"],
  ["shipping", "⌖", "Envíos"],
  ["sales", "↗", "Ventas"],
  ["admins", "♧", "Administradores"],
];

function SalesTrendChart({ days, onNavigate }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const activeDay = days.find((day) => day.key === hoveredDay);
  const activeDayIndex = days.findIndex((day) => day.key === hoveredDay);
  const maxRevenue = Math.max(1, ...days.map((day) => day.revenue));
  const hasSales = days.some((day) => day.revenue > 0);
  const activeBarHeight =
    activeDay && activeDay.revenue > 0 ? (activeDay.revenue / maxRevenue) * 128 : 2;
  const tooltipTop = activeDay
    ? Math.max(36, Math.min(190, 36 + ((170 - activeBarHeight / 2) * 224) / 220 - 40))
    : 36;
  const tooltipLeftPercent =
    activeDayIndex >= 0 ? ((43 + activeDayIndex * 98 + 42) / 700) * 100 : 0;

  return (
    <figure className="relative">
      <figcaption className="mb-4 text-sm text-muted">
        Ingresos de ventas completadas por día
      </figcaption>
      {hasSales ? (
        <svg
          className="h-56 w-full"
          viewBox="0 0 700 220"
          role="group"
          aria-label={`Ingresos por día: ${days.map((day) => `${day.label}, ${money(day.revenue)}`).join("; ")}`}
          preserveAspectRatio="none"
        >
          <line x1="20" y1="170" x2="680" y2="170" stroke="#dedfd6" />
          {days.map((day, index) => {
            const x = 43 + index * 98;
            const height = day.revenue > 0 ? (day.revenue / maxRevenue) * 128 : 2;
            const y = 170 - height;
            const isHovered = hoveredDay === day.key;
            return (
              <g
                key={day.key}
                role="button"
                tabIndex={0}
                aria-label={`${day.label}: ${money(day.revenue)}, ${day.count} transacciones. Abrir ventas.`}
                className="cursor-pointer"
                onClick={() => onNavigate("sales")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNavigate("sales");
                  }
                }}
                onMouseEnter={() => setHoveredDay(day.key)}
                onMouseLeave={() => setHoveredDay(null)}
                onFocus={() => setHoveredDay(day.key)}
                onBlur={() => setHoveredDay(null)}
              >
                <rect
                  x={x}
                  y={y}
                  width="42"
                  height={height}
                  rx="5"
                  fill={isHovered ? "#25483b" : day.revenue > 0 ? "#78905f" : "#e4e6df"}
                  stroke={isHovered ? "#d9e976" : "transparent"}
                  strokeWidth="3"
                  style={{ filter: isHovered ? "drop-shadow(0 3px 4px #1b29234d)" : "none" }}
                />
                <text
                  x={x + 21}
                  y="195"
                  textAnchor="middle"
                  fill={isHovered ? "#25483b" : "#69746d"}
                  fontSize="11"
                  fontWeight={isHovered ? "700" : "400"}
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="grid h-56 place-items-center rounded bg-paper text-sm text-muted">
          No hay ventas completadas en los últimos 7 días.
        </p>
      )}
      {activeDay && (
        <div
          className="pointer-events-none absolute z-10 w-48 rounded-lg border border-line bg-white p-3 text-xs shadow-lg"
          role="status"
          aria-live="polite"
          style={{
            left: `min(calc(${tooltipLeftPercent}% + 8px), calc(100% - 12rem))`,
            top: `${tooltipTop}px`,
          }}
        >
          <strong className="block text-sm text-ink">{activeDay.label}</strong>
          <dl className="mt-2 grid gap-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Ingresos</dt>
              <dd className="font-semibold">{money(activeDay.revenue)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Ventas</dt>
              <dd className="font-semibold">{activeDay.count}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Promedio por venta</dt>
              <dd className="font-semibold">
                {money(activeDay.count ? activeDay.revenue / activeDay.count : 0)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </figure>
  );
}

function MonthlySalesChart({ revenue, comparison, salesByPaymentMethod, saleCount }) {
  const [activeMethod, setActiveMethod] = useState(null);
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const colors = ["#25483b", "#9cad42", "#6f9c84", "#c9785b", "#7d789f"];
  const activePaymentMethod = salesByPaymentMethod.find((item) => item.name === activeMethod);
  let offset = 0;
  const centerLabel = money(revenue).replace(/^USD\s?/, "$");

  return (
    <figure className="relative flex flex-col items-center justify-center self-start py-2">
      <figcaption className="mb-2 text-sm text-muted">Ingresos del mes</figcaption>
      <div className="relative">
        <svg
          className="h-40 w-40 shrink-0"
          viewBox="0 0 160 160"
          role="img"
          aria-label={`Ingresos del mes: ${centerLabel}. Distribución por método de pago: ${salesByPaymentMethod.map((item) => `${item.name}, ${item.count} ventas, ${money(item.revenue)}`).join("; ") || "sin ventas"}.`}
        >
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#e8e9e2" strokeWidth="30" />
          {salesByPaymentMethod.map((item, index) => {
            const length = (item.count / saleCount) * circumference;
            const isActive = item.name === activeMethod;
            const segment = (
              <circle
                key={item.name}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth={isActive ? "30" : "22"}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
                role="button"
                tabIndex={0}
                aria-label={`${item.name}: ${item.count} ventas, ${money(item.revenue)}. Resaltar método de pago.`}
                className="cursor-pointer outline-none transition-[stroke-width,filter] duration-150 focus-visible:stroke-[#d9e976]"
                style={{
                  filter: isActive ? "drop-shadow(0 2px 3px #1b29234d)" : "none",
                }}
                onMouseEnter={() => setActiveMethod(item.name)}
                onMouseLeave={() => setActiveMethod(null)}
                onClick={() => setActiveMethod(item.name)}
                onFocus={() => setActiveMethod(item.name)}
                onBlur={() => setActiveMethod(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveMethod(item.name);
                  }
                  if (event.key === "Escape") setActiveMethod(null);
                }}
              />
            );
            offset += length;
            return segment;
          })}
          <text
            x="80"
            y="86"
            textAnchor="middle"
            fill="#1b2923"
            fontSize={centerLabel.length > 10 ? "20" : "25"}
            fontWeight="700"
          >
            {centerLabel}
          </text>
        </svg>
        {activePaymentMethod && (
          <div
            className="pointer-events-none absolute right-0 top-2 z-20 w-40 rounded-lg border border-line bg-white p-3 text-xs shadow-lg"
            role="status"
            aria-live="polite"
          >
            <strong className="block truncate text-sm text-ink">{activePaymentMethod.name}</strong>
            <span className="mt-1 block text-muted">
              {activePaymentMethod.count} {activePaymentMethod.count === 1 ? "venta" : "ventas"} ·{" "}
              {Math.round((activePaymentMethod.count / saleCount) * 100)}%
            </span>
            <span className="mt-1 block font-semibold text-leaf">
              {money(activePaymentMethod.revenue)}
            </span>
          </div>
        )}
      </div>
      {comparison && <p className="mt-2 text-center text-xs text-muted">{comparison}</p>}
    </figure>
  );
}

function DeliverySettingsPanel({ settings, error, busy, onChange, onSave }) {
  const [provinceId, setProvinceId] = useState(PROVINCES[0]?.id || "");
  const [municipalitySearch, setMunicipalitySearch] = useState("");
  const [bulkZoneId, setBulkZoneId] = useState("zone-6");
  const [locationSearch, setLocationSearch] = useState("");
  const province = PROVINCES.find((item) => item.id === provinceId);
  const municipalities = province ? getProvinceMunicipalities(province.id) : [];
  const filteredMunicipalities = municipalities.filter((item) =>
    item.name.toLocaleLowerCase("es").includes(municipalitySearch.toLocaleLowerCase("es"))
  );
  const dispatchLocation = EPS_LOCATIONS.find(
    (location) => location.id === settings.dispatchEpsLocationId
  );
  const filteredEpsLocations = EPS_LOCATIONS.filter((location) =>
    `${location.name} ${location.city} ${location.region}`
      .toLocaleLowerCase("es")
      .includes(locationSearch.toLocaleLowerCase("es"))
  );

  const updateZone = (zoneId, fee) =>
    onChange({
      ...settings,
      zones: settings.zones.map((zone) =>
        zone.id === zoneId ? { ...zone, fee: Number(fee) } : zone
      ),
    });

  const assignMunicipality = (municipalityId, zoneId) => {
    const municipalityZones = { ...settings.municipalityZones };
    if (zoneId) municipalityZones[municipalityId] = zoneId;
    else delete municipalityZones[municipalityId];
    onChange({ ...settings, municipalityZones });
  };

  const assignProvince = () => {
    const municipalityZones = { ...settings.municipalityZones };
    for (const municipality of municipalities) {
      if (bulkZoneId) municipalityZones[municipality.id] = bulkZoneId;
      else delete municipalityZones[municipality.id];
    }
    onChange({ ...settings, municipalityZones });
  };

  return (
    <form className="grid gap-6" onSubmit={onSave}>
      <section className="card p-5 sm:p-6">
        <h3 className="font-display text-xl">Punto de despacho EPS</h3>
        <p className="mt-1 text-sm text-muted">
          Origen operativo para ambas modalidades; no cambia la sucursal elegida para retiro.
        </p>
        <label className="label mt-4" htmlFor="dispatch-eps-location">
          Sucursal de origen
        </label>
        <select
          id="dispatch-eps-location"
          className="input"
          value={settings.dispatchEpsLocationId}
          onChange={(event) => onChange({ ...settings, dispatchEpsLocationId: event.target.value })}
        >
          {EPS_LOCATIONS.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} — {location.city}, {location.region}
            </option>
          ))}
        </select>
        {dispatchLocation && <p className="mt-2 text-xs text-muted">{dispatchLocation.address}</p>}
        <label className="label mt-5" htmlFor="eps-pickup-fee">
          Tarifa fija de retiro en sucursal EPS (USD)
        </label>
        <input
          id="eps-pickup-fee"
          className="input max-w-xs"
          type="number"
          min="0"
          max="10000"
          step="0.01"
          required
          value={settings.epsPickupFee}
          onChange={(event) => onChange({ ...settings, epsPickupFee: Number(event.target.value) })}
        />
      </section>

      <section className="card p-5 sm:p-6">
        <h3 className="font-display text-xl">Sucursales disponibles para retiro</h3>
        <p className="mt-1 text-sm text-muted">
          El cliente solo podrá elegir sucursales marcadas como disponibles.
        </p>
        <label className="mt-4 block max-w-sm">
          <span className="label">Buscar sucursal</span>
          <input
            className="input"
            value={locationSearch}
            onChange={(event) => setLocationSearch(event.target.value)}
          />
        </label>
        <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto rounded border border-line p-3 sm:grid-cols-2">
          {filteredEpsLocations.map((location) => (
            <label className="flex items-start gap-2 text-sm" key={location.id}>
              <input
                className="mt-1 accent-[#25483b]"
                type="checkbox"
                checked={settings.availableEpsLocationIds.includes(location.id)}
                onChange={(event) => {
                  const availableEpsLocationIds = event.target.checked
                    ? [...settings.availableEpsLocationIds, location.id]
                    : settings.availableEpsLocationIds.filter((id) => id !== location.id);
                  onChange({ ...settings, availableEpsLocationIds });
                }}
              />
              <span>
                <strong className="block">{location.name}</strong>
                <span className="text-xs text-muted">
                  {location.city}, {location.region}
                </span>
              </span>
            </label>
          ))}
        </div>
        {!settings.availableEpsLocationIds.length && (
          <p className="mt-3 text-sm text-[#9d5144]" role="alert">
            Debe permanecer al menos una sucursal EPS disponible.
          </p>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h3 className="font-display text-xl">Tarifas de entrega a domicilio</h3>
        <p className="mt-1 text-sm text-muted">
          Tarifas provisionales en USD. Asigna cada municipio a la zona que corresponda.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {settings.zones.map((zone) => {
            const assignedCount = Object.values(settings.municipalityZones).filter(
              (zoneId) => zoneId === zone.id
            ).length;
            return (
              <label className="rounded border border-line p-4" key={zone.id}>
                <strong className="block text-sm">{zone.name}</strong>
                <span className="mt-1 block text-xs text-muted">
                  {assignedCount} municipios asignados
                </span>
                <span className="label mt-3" aria-hidden="true">
                  Costo (USD)
                </span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  required
                  aria-label={`Costo de ${zone.name} en USD`}
                  value={zone.fee}
                  onChange={(event) => updateZone(zone.id, event.target.value)}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h3 className="font-display text-xl">Cobertura por provincia y municipio</h3>
        <p className="mt-1 text-sm text-muted">
          Las ubicaciones sin zona asignada no podrán cotizarse ni completar el pedido.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label>
            <span className="label">Provincia</span>
            <select
              className="input"
              value={provinceId}
              onChange={(event) => setProvinceId(event.target.value)}
            >
              {PROVINCES.toSorted((a, b) => a.name.localeCompare(b.name, "es")).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Asignar toda la provincia</span>
            <select
              className="input"
              value={bulkZoneId}
              onChange={(event) => setBulkZoneId(event.target.value)}
            >
              <option value="">Sin asignar</option>
              {settings.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-secondary w-full" type="button" onClick={assignProvince}>
              Aplicar a todos los municipios
            </button>
          </div>
        </div>
        <label className="mt-4 block max-w-sm">
          <span className="label">Buscar municipio</span>
          <input
            className="input"
            value={municipalitySearch}
            onChange={(event) => setMunicipalitySearch(event.target.value)}
          />
        </label>
        <div className="mt-4 divide-y divide-line">
          {filteredMunicipalities.map((municipality) => (
            <label
              className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_18rem] sm:items-center"
              key={municipality.id}
            >
              <span>{municipality.name}</span>
              <select
                className="input"
                value={settings.municipalityZones[municipality.id] || ""}
                onChange={(event) => assignMunicipality(municipality.id, event.target.value)}
                aria-label={`Zona de ${municipality.name}, ${province?.name}`}
              >
                <option value="">Sin zona asignada</option>
                {settings.zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>
      {error && (
        <p className="rounded bg-[#fff4e5] p-3 text-sm text-[#8c5727]" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          className="btn-primary"
          type="submit"
          disabled={busy || settings.availableEpsLocationIds.length === 0}
        >
          {busy ? "Guardando tarifas…" : "Guardar configuración de envíos"}
        </button>
      </div>
    </form>
  );
}

/**
 * Campos editoriales del producto y previsualización en vivo de la ficha pública.
 * @param {{record: import("../models.js").Product|null, categories: import("../models.js").Category[], products: import("../models.js").Product[]}} props
 */
function ProductFields({ record, categories, products }) {
  const initialDetails = getProductDetails(
    record || {
      id: "",
      name: "",
      sku: "",
      category: categories[0]?.name || "",
      detail: "",
      price: 1,
      stock: 0,
    }
  );
  const recommendationSource = record || {
    id: "product-preview",
    category: categories[0]?.name || "",
  };
  const initialRecommendations =
    initialDetails.recommendedProductIds ||
    getRecommendedProducts(recommendationSource, products).map((product) => product.id);
  const [showPreview, setShowPreview] = useState(false);
  // Los campos permanecen como texto; se convierten al modelo al guardar.
  const [draft, setDraft] = useState(() => ({
    name: record?.name || "",
    sku: record?.sku || "",
    category: record?.category || categories[0]?.name || "",
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
            <option key={category.name}>{category.name}</option>
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
 * @param {{form: import("../models.js").AdminFormState|null, close: () => void, save: (type: import("../models.js").AdminFormType, record: import("../models.js").Product|import("../models.js").Category|import("../models.js").Customer|import("../models.js").AdminUser|null, values: Record<string, FormDataEntryValue>) => Promise<void>, data: import("../models.js").AdminData}} props
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
      <>
        <Field
          label="Nombre de categoría"
          name="name"
          defaultValue={record?.name || ""}
          required
          maxLength={60}
        />
        <Field
          label="Orden en la tienda"
          name="sortOrder"
          type="number"
          min="1"
          step="1"
          defaultValue={record?.sortOrder ?? data.categories.length + 1}
          required
        />
        <Field
          label="URL de imagen"
          name="image"
          type="url"
          defaultValue={record?.image?.startsWith("http") ? record.image : ""}
          maxLength={3 * 1024 * 1024}
        />
        <label>
          <span className="label">Subir imagen (máximo 2 MB)</span>
          <input
            className="input file:mr-4 file:rounded-full file:border-0 file:bg-[#eef0e6] file:px-4 file:py-2"
            name="imageFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Descripción</span>
          <textarea
            className="input min-h-20"
            name="description"
            defaultValue={record?.description || ""}
            maxLength={600}
            rows={3}
          />
        </label>
      </>
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
 * Pantalla de acceso cuya contraseña se comprueba únicamente en el backend.
 * @param {{onLogin: (email: string, password: string) => Promise<string>, notice: React.ReactNode}} props
 */
function AdminLogin({ onLogin, notice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top_left,_#e8eadc,_#f5f4ed_55%)] px-5 py-10">
      <form
        className="w-full max-w-md rounded-xl border border-line bg-white p-7 shadow-xl sm:p-10"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsSubmitting(true);
          setError("");
          try {
            setError((await onLogin(email, password)) || "");
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        <Brand to="./" />
        <p className="mt-9 text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">
          Espacio de administración
        </p>
        <h1 className="mt-2 font-display text-4xl">Bienvenido de nuevo</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Ingresa con las credenciales configuradas en el servidor para abrir el panel.
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
        <button className="btn-primary mt-6 w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Validando..." : "Entrar al portal →"}
        </button>
        <a className="btn-secondary mt-3 w-full" href="./">
          ← Regresar a la página principal
        </a>
        <p className="mt-5 rounded bg-paper p-3 text-xs leading-5 text-muted">
          No existe una cuenta demo integrada. El servidor valida el acceso y mantiene la contraseña
          fuera del navegador.
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
  const [orders, setOrders] = useState([]);
  const [deliverySettings, setDeliverySettings] = useState(null);
  const [deliverySettingsError, setDeliverySettingsError] = useState("");
  const [deliverySettingsBusy, setDeliverySettingsBusy] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [posCart, setPosCart] = useState([]);
  const [posCustomer, setPosCustomer] = useState("");
  const [posPayment, setPosPayment] = useState(PAYMENT_METHODS[0]);
  const [saleBusy, setSaleBusy] = useState(false);
  const { notify, region } = useNotice();

  // Restaura la sesión solo si el servidor valida la cookie protegida.
  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const isAuthenticated = await readAdminSession();
        if (!active) return;
        if (isAuthenticated) {
          const [catalog, customers, sales, orders, settings] = await Promise.all([
            fetchPublicCatalog(),
            readAdminCustomers(),
            readAdminSales(),
            readAdminOrders(),
            readAdminDeliverySettings(),
          ]);
          if (!active) return;
          setData((current) => ({ ...current, ...catalog, customers, sales }));
          setOrders(orders);
          setDeliverySettings(settings);
          setAuthenticated(true);
        }
      } catch (error) {
        console.error("No se pudo restaurar la sesión de Admin.", error);
        if (active) setAuthNotice("No se pudo cargar la sesión o el catálogo del servidor.");
      } finally {
        if (active) setAuthReady(true);
      }
    };
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  // Mantiene este panel actualizado si otra pestaña cambia productos o ventas.
  const handleStorageChange = useCallback((event) => {
    if (event.key === CATALOG_CHANGE_KEY) {
      fetchPublicCatalog()
        .then((catalog) => setData((current) => ({ ...current, ...catalog })))
        .catch((error) =>
          console.error("No se pudo actualizar el catálogo desde el servidor.", error)
        );
      return;
    }
    if (event.key === ADMIN_DATA_CHANGE_KEY) {
      Promise.all([
        readAdminCustomers(),
        readAdminSales(),
        readAdminOrders(),
        readAdminDeliverySettings(),
      ])
        .then(([customers, sales, orders, settings]) => {
          setData((current) => ({ ...current, customers, sales }));
          setOrders(orders);
          setDeliverySettings(settings);
        })
        .catch((error) =>
          console.error("No se pudieron actualizar clientes y ventas desde el servidor.", error)
        );
      return;
    }
    if (event.key !== DATA_KEY && event.key !== null) return;
    const savedData = readAdminData();
    setData((current) => ({ ...savedData, products: current.products }));
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

  // Lee el catálogo y luego inicia sesión; nunca almacena la contraseña localmente.
  const login = async (email, password) => {
    try {
      const catalog = await fetchPublicCatalog();
      await loginAdmin(email, password);
      const [customers, sales, orders, settings] = await Promise.all([
        readAdminCustomers(),
        readAdminSales(),
        readAdminOrders(),
        readAdminDeliverySettings(),
      ]);
      setData((current) => ({ ...current, ...catalog, customers, sales }));
      setOrders(orders);
      setDeliverySettings(settings);
      setAuthNotice("");
      setAuthenticated(true);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    }
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
        !Number.isSafeInteger(stock) ||
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
            item.name.toLocaleLowerCase("es-MX") === name.toLocaleLowerCase("es-MX") &&
            item.name !== record?.name
        )
      )
        throw new Error("Ya existe una categoría con ese nombre.");
      const sortOrder = Number(values.sortOrder);
      if (!Number.isSafeInteger(sortOrder) || sortOrder < 1)
        throw new Error("El orden debe ser un entero igual o mayor que uno.");
      const image = values.image?.trim() || record?.image || "";
      if (image && !isValidImage(image))
        throw new Error("Escribe una URL HTTPS válida o selecciona una imagen permitida.");
      const category = {
        name,
        sortOrder,
        image,
        description: values.description.trim(),
      };
      const savedCategory = record
        ? await updateAdminCategory(record.name, category)
        : await createAdminCategory(category);
      next.categories = data.categories
        .map((item) => (item.name === record?.name ? savedCategory : item))
        .concat(record ? [] : [savedCategory])
        .sort((left, right) => left.sortOrder - right.sortOrder);
      if (record && record.name !== savedCategory.name) {
        next.products = data.products.map((item) =>
          item.category === record.name ? { ...item, category: savedCategory.name } : item
        );
      }
      setData({ ...data, ...next });
      notify(
        record
          ? "Categoría actualizada y visible en la tienda."
          : "Categoría creada y visible en la tienda."
      );
      return;
    } else if (type === "stock") {
      const stock = Number(values.stock);
      if (!Number.isSafeInteger(stock) || stock < 0)
        throw new Error("El stock debe ser un entero no negativo.");
      next.products = data.products.map((item) =>
        item.id === record.id ? { ...item, stock } : item
      );
    } else if (type === "customer") {
      const customer = {
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
      const savedCustomer = record
        ? await updateAdminCustomer(record.id, customer)
        : await createAdminCustomer(customer);
      const customers = record
        ? data.customers.map((item) => (item.id === savedCustomer.id ? savedCustomer : item))
        : [...data.customers, savedCustomer];
      setData({ ...data, customers });
      notify(record ? "Cliente actualizado en el backend." : "Cliente guardado en el backend.");
      return;
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
    if (type === "product" || type === "stock") {
      const productToSave = record
        ? next.products.find((item) => item.id === record.id)
        : next.products.at(-1);
      if (!productToSave) throw new Error("No se encontró el producto que intentas guardar.");

      const savedProduct = record
        ? await updateAdminProduct(record.id, productToSave)
        : await createAdminProduct(productToSave);
      const products = record
        ? data.products.map((item) => (item.id === savedProduct.id ? savedProduct : item))
        : [...data.products, savedProduct];
      setData({ ...data, products });
      notify(
        type === "stock"
          ? "Existencias actualizadas en el catálogo."
          : record
            ? "Producto actualizado en el catálogo."
            : "Producto creado y visible en la tienda."
      );
      return;
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
  const removeRecord = async (collection, id, label) => {
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
    if (
      collection === "products" &&
      orders.some(
        (order) =>
          ["pending", "confirmed"].includes(order.status) &&
          order.items.some((item) => item.productId === id)
      )
    ) {
      notify("No se puede eliminar un producto asociado a un pedido vigente.", "error");
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
      try {
        await deleteAdminProduct(id);
      } catch (error) {
        console.error("No se pudo eliminar el producto del backend.", error);
        notify(
          error instanceof Error ? error.message : "No se pudo eliminar el producto.",
          "error"
        );
        return;
      }
      setData(next);
      notify(`${label} eliminado.`);
      return;
    }
    if (collection === "customers") {
      try {
        await deleteAdminCustomer(id);
        setData((current) => ({
          ...current,
          customers: current.customers.filter((customer) => customer.id !== id),
          sales: current.sales.map((sale) =>
            sale.customerId === id ? { ...sale, customerId: null } : sale
          ),
        }));
        setOrders((current) =>
          current.map((order) => (order.customerId === id ? { ...order, customerId: null } : order))
        );
        notify(`${label} eliminado.`);
      } catch (error) {
        notify(error instanceof Error ? error.message : "No se pudo eliminar el cliente.", "error");
      }
      return;
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

  // El backend verifica stock, captura precios y registra la venta atómicamente.
  const completeSale = async () => {
    if (!posCart.length || saleBusy) return;
    if (
      posCart.some(
        (line) =>
          !data.products.some((product) => product.id === line.id && line.quantity <= product.stock)
      )
    ) {
      notify("El inventario cambió; revisa las cantidades.", "error");
      return;
    }
    setSaleBusy(true);
    try {
      const result = await createAdminSale({
        customerId: posCustomer || null,
        paymentMethod: posPayment,
        items: posCart.map(({ id, quantity }) => ({ productId: id, quantity })),
      });
      setData((current) => ({
        ...current,
        products: result.products,
        sales: [result.sale, ...current.sales],
      }));
      setPosCart([]);
      notify(`Venta confirmada por ${money(result.sale.total)}. El stock fue actualizado.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo registrar la venta.", "error");
    } finally {
      setSaleBusy(false);
    }
  };

  // El backend registra la anulación y devuelve al inventario las unidades.
  const voidSale = async (sale) => {
    if (
      sale.status !== "completed" ||
      !window.confirm(
        `¿Anular la venta ${sale.id.slice(-8).toUpperCase()}? Se devolverán las unidades al inventario.`
      )
    )
      return;
    try {
      const result = await voidAdminSale(sale.id);
      setData((current) => ({
        ...current,
        products: result.products,
        sales: current.sales.map((item) => (item.id === sale.id ? result.sale : item)),
      }));
      notify("Venta anulada; el inventario fue restaurado.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo anular la venta.", "error");
    }
  };

  const updateOrder = async (order, action) => {
    if (order.status !== "pending" && action === "confirm") return;
    if (order.status === "cancelled") return;
    const actionLabel = action === "confirm" ? "confirmar" : "cancelar";
    if (!window.confirm(`¿Deseas ${actionLabel} el pedido ${order.id.slice(-8).toUpperCase()}?`)) {
      return;
    }
    try {
      const result =
        action === "confirm" ? await confirmAdminOrder(order.id) : await cancelAdminOrder(order.id);
      setData((current) => ({ ...current, products: result.products }));
      setOrders((current) =>
        current.map((item) => (item.id === result.order.id ? result.order : item))
      );
      notify(
        action === "confirm"
          ? "Pedido confirmado y existencias descontadas."
          : order.status === "confirmed"
            ? "Pedido cancelado y existencias restauradas."
            : "Pedido cancelado."
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : `No se pudo ${actionLabel} el pedido.`,
        "error"
      );
    }
  };

  const saveDeliverySettings = async (event) => {
    event.preventDefault();
    if (!deliverySettings || deliverySettingsBusy) return;
    setDeliverySettingsBusy(true);
    setDeliverySettingsError("");
    try {
      const saved = await updateAdminDeliverySettings(deliverySettings);
      setDeliverySettings(saved);
      notify("La configuración de envíos se guardó.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar la configuración.";
      setDeliverySettingsError(message);
      notify(message, "error");
    } finally {
      setDeliverySettingsBusy(false);
    }
  };

  if (!authReady)
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <p className="text-sm text-muted" role="status">
          Comprobando la sesión de administrador...
        </p>
      </main>
    );

  if (!authenticated)
    return (
      <AdminLogin
        onLogin={login}
        notice={
          authNotice ? (
            <p className="mt-4 text-center text-sm text-[#9d5144]" role="alert">
              {authNotice}
            </p>
          ) : null
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

  // El resumen combina ingresos confirmados, actividad del negocio y accesos frecuentes.
  if (active === "dashboard") {
    const low = data.products.filter((product) => product.stock <= LOW_STOCK).length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const validSales = data.sales.filter(
      (sale) => sale.status === "completed" && Number.isFinite(new Date(sale.date).getTime())
    );
    const monthSales = validSales.filter((sale) => new Date(sale.date) >= monthStart);
    const salesByPaymentMethod = [
      ...monthSales.reduce((methods, sale) => {
        const name = sale.paymentMethod || "No especificado";
        const current = methods.get(name) || { name, count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += sale.total;
        methods.set(name, current);
        return methods;
      }, new Map()),
    ]
      .map(([, method]) => method)
      .sort((left, right) => right.count - left.count);
    const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.total, 0);
    const monthChange = monthSales.length === 0 ? "No hay ventas registradas este mes" : "";
    const trendDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const daySales = validSales.filter((sale) => {
        const saleDate = new Date(sale.date);
        return (
          saleDate.getFullYear() === date.getFullYear() &&
          saleDate.getMonth() === date.getMonth() &&
          saleDate.getDate() === date.getDate()
        );
      });
      return {
        key,
        label: date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }),
        revenue: daySales.reduce((sum, sale) => sum + sale.total, 0),
        count: daySales.length,
      };
    });
    const productSales = new Map();
    validSales.forEach((sale) =>
      sale.items.forEach((item) => {
        const current = productSales.get(item.productId) || { name: item.name, quantity: 0 };
        current.quantity += item.quantity;
        productSales.set(item.productId, current);
      })
    );
    const bestSellers = [...productSales.values()]
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5);
    const maxUnitsSold = Math.max(1, ...bestSellers.map((item) => item.quantity));
    const pendingOrders = orders.filter((order) => order.status === "pending").length;
    const recentActivities = [
      ...data.sales.map((sale) => ({
        ...sale,
        date: sale.voidedAt || sale.date,
        key: `sale-${sale.id}`,
        type: "Venta",
        customer: sale.customerName || "Venta de mostrador",
        statusLabel: sale.status === "voided" ? "Anulada" : "Completada",
        amountSign: sale.status === "voided" ? "-" : "+",
        amountClass:
          sale.status === "voided"
            ? "dashboard-activity-cancel font-semibold text-[#a33c32]"
            : "dashboard-activity-income font-semibold text-[#28623c]",
        statusClass:
          sale.status === "voided" ? "bg-[#fbe9e7] text-[#a33c32]" : "bg-[#e7f2e8] text-[#28623c]",
      })),
      ...orders.map((order) => ({
        ...order,
        date: order.cancelledAt || order.confirmedAt || order.date,
        key: `order-${order.id}`,
        type: "Pedido",
        customer: order.customerName,
        statusLabel:
          order.status === "pending"
            ? "Pendiente de confirmar"
            : order.status === "confirmed"
              ? "Confirmado"
              : "Cancelado",
        amountSign: order.status === "pending" ? "" : order.status === "confirmed" ? "+" : "-",
        amountClass:
          order.status === "pending"
            ? ""
            : order.status === "confirmed"
              ? "dashboard-activity-income font-semibold text-[#28623c]"
              : "dashboard-activity-cancel font-semibold text-[#a33c32]",
        statusClass:
          order.status === "pending"
            ? "bg-[#fff4d6] text-[#8a5a00]"
            : order.status === "confirmed"
              ? "bg-[#e7f2e8] text-[#28623c]"
              : "bg-[#fbe9e7] text-[#a33c32]",
      })),
    ]
      .sort((left, right) => new Date(right.date) - new Date(left.date))
      .slice(0, 5);
    const metrics = [
      { type: "monthlySales" },
      {
        label: "Ventas de hoy",
        value: money(todaySales.reduce((sum, sale) => sum + sale.total, 0)),
        foot: (
          <span>
            <strong className="bg-[#d9e976] px-1 text-ink">
              {todaySales.length} {todaySales.length === 1 ? "venta" : "ventas"}
            </strong>{" "}
            registradas
          </span>
        ),
        icon: "▥",
        destination: "sales",
      },
      {
        label: "Pedidos pendientes",
        value: pendingOrders,
        foot: "Esperando revisión en Admin",
        icon: "▣",
        destination: "orders",
      },
      {
        label: "Stock bajo",
        value: low,
        foot: `Umbral: ${LOW_STOCK} unidades o menos`,
        icon: "▤",
        destination: "inventory",
      },
    ];
    content = (
      <>
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72805a]">Resumen</p>
          <h2 className="mt-1 font-display text-3xl">Un vistazo a tu operación</h2>
          <p className="mt-2 text-sm text-muted">
            Ventas, productos más solicitados y alertas operativas.
          </p>
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            if (metric.type === "monthlySales") {
              return (
                <MonthlySalesChart
                  key="monthly-sales"
                  revenue={monthRevenue}
                  comparison={monthChange}
                  salesByPaymentMethod={salesByPaymentMethod}
                  saleCount={monthSales.length}
                />
              );
            }
            const { label, value, foot, icon, destination } = metric;
            const details = (
              <>
                <div className="flex justify-between text-sm text-muted transition-colors group-hover:text-white">
                  <span>{label}</span>
                  <span className="text-xl text-[#78905f] transition-colors group-hover:text-[#d9e976]">
                    {icon}
                  </span>
                </div>
                <strong className="mt-4 inline-block font-display text-3xl transition-colors group-hover:text-white">
                  {value}
                </strong>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted transition-colors group-hover:text-white">
                  <span>{foot}</span>
                  {destination && (
                    <span className="shrink-0 font-semibold text-leaf opacity-0 transition-opacity group-hover:text-[#d9e976] group-hover:opacity-100 group-focus-visible:opacity-100">
                      Ver →
                    </span>
                  )}
                </span>
              </>
            );
            if (!destination) {
              return (
                <article className="card p-5" key={label}>
                  {details}
                </article>
              );
            }
            const destinationLabel = NAVIGATION.find(([id]) => id === destination)?.[2];
            return (
              <button
                type="button"
                className="card admin-metric-card group w-full cursor-pointer p-5 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
                key={label}
                onClick={() => setActive(destination)}
                aria-label={`${label}: ${value}. Abrir ${destinationLabel}.`}
                title={`Abrir ${destinationLabel}`}
              >
                {details}
              </button>
            );
          })}
        </div>
        <div className="mt-7 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
          <section className="card p-5 sm:p-6">
            <h3 className="font-display text-xl">Volumen de ventas</h3>
            <p className="mt-1 text-xs text-muted">
              Promedio por venta este mes:{" "}
              <strong className="bg-[#d9e976] px-1 text-ink">
                {money(monthSales.length ? monthRevenue / monthSales.length : 0)}
              </strong>
            </p>
            <div className="mt-4">
              <SalesTrendChart days={trendDays} onNavigate={setActive} />
            </div>
          </section>
          <section className="card p-5 sm:p-6">
            <h3 className="font-display text-xl">Productos más vendidos</h3>
            <p className="mt-1 text-xs text-muted">Unidades en ventas completadas</p>
            {bestSellers.length ? (
              <ol className="mt-5 grid gap-4">
                {bestSellers.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <button
                      type="button"
                      className="group w-full cursor-pointer rounded p-2 text-left transition hover:bg-[#f8f9f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
                      onClick={() => setActive("products")}
                      aria-label={`${item.name}: ${item.quantity} unidades vendidas. Abrir productos.`}
                      title="Abrir productos"
                    >
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="truncate">{item.name}</span>
                        <strong className="transition-colors group-hover:text-leaf">
                          {item.quantity}
                        </strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-paper" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-[#78905f] transition-colors group-hover:bg-leaf"
                          style={{ width: `${(item.quantity / maxUnitsSold) * 100}%` }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 rounded bg-paper p-4 text-sm text-muted">
                Aún no hay ventas completadas para mostrar.
              </p>
            )}
          </section>
        </div>
        <div className="mt-7 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
          <section className="card p-5 sm:p-6">
            <h3 className="mb-3 font-display text-xl">Actividad reciente</h3>
            {table(
              ["Registro", "Fecha", "Cliente", "Total", "Estado"],
              recentActivities.map((activity) => (
                <tr className="dashboard-activity-row" key={activity.key}>
                  <td>
                    <span className="block font-semibold">
                      {activity.id.slice(-8).toUpperCase()}
                    </span>
                    <span className="block text-xs text-muted">{activity.type}</span>
                  </td>
                  <td>{new Date(activity.date).toLocaleDateString("es-MX")}</td>
                  <td>{activity.customer}</td>
                  <td className={activity.amountClass}>
                    {activity.amountSign === "-"
                      ? `-${money(Math.abs(activity.total))}`
                      : activity.amountSign === "+"
                        ? `+${money(Math.abs(activity.total))}`
                        : money(activity.total)}
                  </td>
                  <td>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${activity.statusClass}`}
                    >
                      {activity.statusLabel}
                    </span>
                  </td>
                </tr>
              )),
              "Aún no hay ventas ni pedidos recientes."
            )}
          </section>
          <section className="card p-5 sm:p-6">
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
          ["Categoría", "Orden", "Productos", "Acciones"],
          visible(data.categories).map((category) => (
            <tr key={category.name}>
              <td>
                <div className="flex items-center gap-3">
                  {category.image && (
                    <img className="h-11 w-11 rounded object-cover" src={category.image} alt="" />
                  )}
                  <div>
                    <strong>{category.name}</strong>
                    {category.description && (
                      <p className="mt-1 max-w-sm text-xs text-muted">{category.description}</p>
                    )}
                  </div>
                </div>
              </td>
              <td>{category.sortOrder}</td>
              <td>
                {data.products.filter((product) => product.category === category.name).length}
              </td>
              <td>
                {actions(
                  () => openForm("category", category),
                  async () => {
                    if (data.products.some((product) => product.category === category.name)) {
                      notify(
                        "No se puede eliminar una categoría que tiene productos asignados.",
                        "error"
                      );
                      return;
                    }
                    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
                    try {
                      await deleteAdminCategory(category.name);
                      setData((current) => ({
                        ...current,
                        categories: current.categories.filter(
                          (item) => item.name !== category.name
                        ),
                      }));
                      notify("Categoría eliminada del catálogo.");
                    } catch (error) {
                      notify(
                        error instanceof Error
                          ? error.message
                          : "No se pudo eliminar la categoría.",
                        "error"
                      );
                    }
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
  } else if (active === "orders") {
    content = (
      <>
        {cardHeading(
          "Pedidos en línea",
          "Los pedidos pendientes no reservan existencias. Confirma solo después de revisar que aún haya stock."
        )}
        {toolbar("Buscar por pedido, cliente o dirección")}
        {table(
          ["Pedido", "Fecha", "Cliente", "Entrega", "Artículos", "Total", "Estado", "Acciones"],
          visible(orders).map((order) => (
            <tr key={order.id}>
              <td className="font-semibold">{order.id.slice(-8).toUpperCase()}</td>
              <td>
                {new Date(order.date).toLocaleString("es-MX", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </td>
              <td>
                {order.customerName}
                <span className="block text-xs text-muted">{order.shippingAddress.phone}</span>
              </td>
              <td>
                {order.shippingAddress.name}
                <span className="block text-xs text-muted">
                  {order.shippingAddress.deliveryMethod === "eps" ? (
                    <>
                      Retiro en EPS: {order.shippingAddress.epsLocation.name}
                      <br />
                      {[
                        order.shippingAddress.epsLocation.address,
                        order.shippingAddress.epsLocation.city,
                        order.shippingAddress.epsLocation.region,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </>
                  ) : (
                    [
                      order.shippingAddress.street,
                      order.shippingAddress.sector,
                      order.shippingAddress.municipality,
                      order.shippingAddress.city,
                      order.shippingAddress.region,
                      order.shippingAddress.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  )}
                </span>
              </td>
              <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
              <td>
                {money(order.total)}
                <span className="block text-xs text-muted">
                  {money(order.subtotal)} + {money(order.shippingCost)} envío
                  {order.deliveryZone ? ` · ${order.deliveryZone.name}` : " · Tarifa EPS"}
                </span>
              </td>
              <td>
                {order.status === "pending"
                  ? "Pendiente"
                  : order.status === "confirmed"
                    ? "Confirmado"
                    : "Cancelado"}
              </td>
              <td>
                <div className="flex gap-3 whitespace-nowrap">
                  {order.status === "pending" && (
                    <button
                      className="text-xs font-semibold text-leaf underline"
                      onClick={() => updateOrder(order, "confirm")}
                    >
                      Confirmar
                    </button>
                  )}
                  {order.status !== "cancelled" && (
                    <button
                      className="text-xs font-semibold text-[#9d5144] underline"
                      onClick={() => updateOrder(order, "cancel")}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )),
          "Aún no hay pedidos en línea."
        )}
      </>
    );
  } else if (active === "shipping") {
    content = (
      <>
        {cardHeading(
          "Configuración de envíos",
          "Administra las tarifas provisionales, la sucursal de despacho y la cobertura por municipio."
        )}
        {deliverySettings ? (
          <DeliverySettingsPanel
            settings={deliverySettings}
            error={deliverySettingsError}
            busy={deliverySettingsBusy}
            onChange={(next) => {
              setDeliverySettings(next);
              setDeliverySettingsError("");
            }}
            onSave={saveDeliverySettings}
          />
        ) : (
          <section className="card p-5 text-sm text-muted">
            No se pudieron cargar los ajustes de entrega. Verifica la sesión del servidor y vuelve a
            iniciar sesión.
          </section>
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
                <button
                  type="button"
                  className="card group w-full overflow-hidden text-left transition duration-150 active:scale-[.98] active:bg-[#e9f1e4] hover:-translate-y-0.5 hover:border-[#78905f] hover:shadow-[0_10px_28px_rgba(37,72,59,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
                  key={product.id}
                  disabled={!product.stock}
                  onClick={() => addPos(product.id, 1)}
                  aria-label={`Agregar ${product.name} a la venta`}
                >
                  <img
                    className="h-36 w-full object-cover"
                    src={product.image || DEFAULT_PRODUCTS[0].image}
                    alt={product.name}
                    loading="lazy"
                  />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[.68rem] text-muted">{product.category}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[.65rem] font-semibold ${
                          product.stock <= LOW_STOCK
                            ? "bg-[#fbe9e7] text-[#a33c32]"
                            : product.stock <= LOW_STOCK + 5
                              ? "bg-[#fff4d6] text-[#8a5a00]"
                              : "bg-[#e7f2e8] text-[#28623c]"
                        }`}
                      >
                        Stock: {product.stock}
                      </span>
                    </div>
                    <h3 className="mt-1 min-h-10 font-semibold">{product.name}</h3>
                    <p className="mt-1 text-xs text-muted">{product.sku}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <strong>{money(product.price)}</strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="card h-max p-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto">
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
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        className="h-12 w-12 shrink-0 rounded object-cover"
                        src={product.image || DEFAULT_PRODUCTS[0].image}
                        alt=""
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <strong className="block truncate text-sm">{product.name}</strong>
                        <p className="text-xs text-muted">{money(product.price)} c/u</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="text-sm">{money(product.price * line.quantity)}</strong>
                      <div
                        className="mt-2 flex items-center justify-end gap-1.5"
                        aria-label={`Cantidad de ${product.name}`}
                      >
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-lg font-semibold text-ink transition hover:border-leaf hover:bg-[#eff2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={line.quantity <= 1}
                          onClick={() => addPos(product.id, -1)}
                          aria-label={`Reducir cantidad de ${product.name}`}
                          title="Reducir cantidad"
                        >
                          −
                        </button>
                        <span
                          className="min-w-8 text-center text-base font-bold tabular-nums"
                          aria-live="polite"
                        >
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-lg font-semibold text-ink transition hover:border-leaf hover:bg-[#eff2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={line.quantity >= product.stock}
                          onClick={() => addPos(product.id, 1)}
                          aria-label={`Aumentar cantidad de ${product.name}`}
                          title="Aumentar cantidad"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="ml-1 grid h-9 w-9 place-items-center rounded-full text-lg text-[#9d5144] transition hover:bg-[#fbe9e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9d5144]"
                          onClick={() => addPos(product.id, 0)}
                          aria-label={`Quitar ${product.name} de la venta`}
                          title="Quitar producto"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <path d="M5 5l14 14M19 5 5 19" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <label className="label" htmlFor="pos-customer">
                Cliente (opcional)
              </label>
              <SelectMenu
                id="pos-customer"
                value={posCustomer}
                options={[
                  {
                    value: "",
                    label: "Venta de mostrador",
                    detail: "No asignar un cliente a esta venta",
                  },
                  ...data.customers.map((customer) => ({
                    value: customer.id,
                    label: customer.name,
                    detail: customer.email,
                  })),
                ]}
                onChange={setPosCustomer}
              />
            </div>
            <fieldset className="mt-4">
              <legend className="label mb-2">Método de pago</legend>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((method) => {
                  const isCash = method === PAYMENT_METHODS[0];
                  const selected = posPayment === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      className={`flex min-h-16 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf ${
                        selected
                          ? "border-leaf bg-leaf text-white shadow-sm"
                          : "border-line bg-white text-ink hover:border-leaf hover:bg-[#eff2e7]"
                      }`}
                      aria-pressed={selected}
                      onClick={() => setPosPayment(method)}
                    >
                      <svg
                        aria-hidden="true"
                        className="h-6 w-6 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {isCash ? (
                          <>
                            <rect x="2.5" y="5" width="19" height="14" rx="2" />
                            <circle cx="12" cy="12" r="3" />
                            <path d="M6 9h.01M18 15h.01" />
                          </>
                        ) : (
                          <>
                            <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
                            <path d="M2.5 9h19M6 15h4" />
                          </>
                        )}
                      </svg>
                      {isCash ? "Efectivo" : "Tarjeta"}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="mt-5 flex justify-between border-t border-line pt-4">
              <strong>Total</strong>
              <strong className="rounded bg-[#d9e976] px-2 py-1 text-lg text-ink">
                {money(totalPos)}
              </strong>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="btn-secondary w-full"
                disabled={!posCart.length || saleBusy}
                onClick={() => {
                  setPosCart([]);
                  setPosCustomer("");
                  setPosPayment(PAYMENT_METHODS[0]);
                }}
              >
                Limpiar pedido
              </button>
              <button
                className="btn-primary w-full"
                disabled={!posCart.length || saleBusy}
                onClick={completeSale}
              >
                {saleBusy ? "Registrando venta…" : "Confirmar venta"}
              </button>
            </div>
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
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-leaf transition hover:bg-paper"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={async () => {
                try {
                  await logoutAdmin();
                  setAuthenticated(false);
                } catch (error) {
                  console.error("No se pudo cerrar la sesión de Admin.", error);
                  notify("No se pudo cerrar la sesión con el servidor.", "error");
                }
              }}
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
                <path d="M12 3v9" />
                <path d="M18.36 6.64a9 9 0 1 1-12.72 0" />
              </svg>
            </button>
          </div>
        </header>
        <div className="flex items-start gap-3 border-b border-[#eadcc3] bg-[#fbf3e4] px-5 py-3 text-xs leading-5 text-[#755a30] sm:px-8">
          <span>ⓘ</span>
          <p>
            <strong>Sesión validada por el servidor.</strong> Los datos del panel todavía se guardan
            en este navegador y no se sincronizan con otros clientes.
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
