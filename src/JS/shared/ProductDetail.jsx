import React from "react";
import { DEFAULT_PRODUCTS } from "../data/defaultCatalog.js";
import { getProductDetails, getRecommendedProducts } from "../data/productDetails.js";
import { money } from "./format.js";

/**
 * Ficha pública de producto, reutilizable en la tienda y en la vista previa de Admin.
 * @param {{product: import("../models.js").Product, products: import("../models.js").Product[], onAdd?: (product: import("../models.js").Product) => void, preview?: boolean}} props
 */
export function ProductDetail({ product, products, onAdd, preview = false }) {
  const details = getProductDetails(product);
  const recommendations = getRecommendedProducts(product, products);
  const unavailable = product.stock <= 0;

  return (
    <>
      <section className="bg-white px-5 py-8 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <a
            href="#todos-productos"
            className="text-sm font-semibold text-leaf underline underline-offset-4"
            onClick={(event) => {
              if (preview) {
                event.preventDefault();
                return;
              }
              window.setTimeout(
                () =>
                  document
                    .getElementById("todos-productos")
                    ?.scrollIntoView({ behavior: "smooth" }),
                0
              );
            }}
          >
            ← Volver a los productos
          </a>
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="overflow-hidden rounded-xl bg-[#f1f0e9]">
              <img
                className="aspect-square h-full w-full object-cover"
                src={product.image || DEFAULT_PRODUCTS[0].image}
                alt={product.name}
              />
            </div>
            <div className="py-2">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72805a]">
                {product.category} <span aria-hidden="true">·</span> {product.sku}
              </p>
              {product.badge && (
                <span className="mt-3 inline-block rounded-full bg-[#eef0e6] px-3 py-1 text-xs font-semibold text-leaf">
                  {product.badge}
                </span>
              )}
              <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
                {product.name}
              </h1>
              <p className="mt-4 text-lg leading-7 text-muted">{details.description}</p>
              <p className="mt-5 text-3xl font-bold">{money(product.price)}</p>
              <p
                className={`mt-3 inline-flex items-center gap-2 text-sm font-semibold ${unavailable ? "text-[#b23b32]" : "text-[#287348]"}`}
                role="status"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
                {unavailable ? "Sin stock disponible" : `En stock · ${product.stock} disponibles`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  className={`text-lg tracking-[.12em] ${details.rating ? "text-[#c89a31]" : "text-[#a8aca3]"}`}
                  aria-label={`${details.rating} de 5 estrellas`}
                >
                  {details.rating ? "★".repeat(Math.round(details.rating)) : "☆☆☆☆☆"}
                  <span className="sr-only">{` ${details.rating} de 5 estrellas`}</span>
                </span>
                <strong>{details.rating ? details.rating.toFixed(1) : "Sin calificación"}</strong>
                <span className="text-muted">|</span>
                <a
                  href={`#producto/${encodeURIComponent(product.id)}/resenas`}
                  className="font-semibold text-leaf underline underline-offset-4"
                  onClick={(event) => {
                    if (preview) {
                      event.preventDefault();
                      document
                        .getElementById("resenas")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      return;
                    }
                    window.setTimeout(
                      () =>
                        document.getElementById("resenas")?.scrollIntoView({ behavior: "smooth" }),
                      0
                    );
                  }}
                >
                  {details.reviewCount} reseñas
                </a>
              </div>
              <button
                type="button"
                className="btn-primary mt-7 w-full sm:w-auto"
                onClick={() => onAdd?.(product)}
                disabled={unavailable || preview || !onAdd}
              >
                {unavailable ? "Agotado" : "Agregar al carrito"}
              </button>
              <p className="mt-5 text-sm text-muted">{product.detail}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f7f2] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72805a]">
              Conoce más
            </p>
            <h2 className="mt-2 font-display text-3xl">Detalles del producto</h2>
            <dl className="mt-6 divide-y divide-line">
              <div className="py-4">
                <dt className="font-semibold">Presentación</dt>
                <dd className="mt-1 text-sm leading-6 text-muted">{details.package}</dd>
              </div>
              <div className="py-4">
                <dt className="font-semibold">Ingredientes</dt>
                <dd className="mt-1 text-sm leading-6 text-muted">{details.ingredients}</dd>
              </div>
              <div className="py-4">
                <dt className="font-semibold">Instrucciones de uso</dt>
                <dd className="mt-1 text-sm leading-6 text-muted">{details.instructions}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted">
              Confirma ingredientes, contenido, indicaciones y advertencias en el envase oficial.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72805a]">
              Lo que aporta
            </p>
            <h2 className="mt-2 font-display text-3xl">Beneficios y características</h2>
            <ul className="mt-6 space-y-4">
              {details.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-sm leading-6 text-muted">
                  <span className="font-bold text-leaf" aria-hidden="true">
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="bg-white px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center font-display text-3xl sm:text-4xl">Productos similares</h2>
            <p className="mt-2 text-center text-sm text-muted">También podrían interesarte</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommendations.map((item) => {
                const itemDetails = getProductDetails(item);
                return (
                  <a
                    key={item.id}
                    href={preview ? undefined : `#producto/${encodeURIComponent(item.id)}`}
                    onClick={preview ? (event) => event.preventDefault() : undefined}
                    className="group overflow-hidden rounded-lg border border-[#e5e5dc] bg-white text-center transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf"
                  >
                    <div className="aspect-square bg-[#f7f7f2]">
                      <img
                        className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-105"
                        src={item.image || DEFAULT_PRODUCTS[0].image}
                        alt={item.name}
                        loading="lazy"
                      />
                    </div>
                    <div className="min-h-40 border-t border-line px-4 py-4">
                      <h3 className="min-h-12 text-sm font-semibold leading-5">{item.name}</h3>
                      <p className="mt-2 text-sm">
                        <span
                          className={itemDetails.rating ? "text-[#c89a31]" : "text-[#a8aca3]"}
                          aria-hidden="true"
                        >
                          {itemDetails.rating
                            ? "★".repeat(Math.round(itemDetails.rating))
                            : "☆☆☆☆☆"}
                        </span>{" "}
                        <span>{itemDetails.rating ? itemDetails.rating.toFixed(1) : "—"}</span>
                        <span className="mx-2 text-muted">|</span>
                        <span className="text-muted">({itemDetails.reviewCount})</span>
                      </p>
                      <strong className="mt-2 block">{money(item.price)}</strong>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section id="resenas" className="scroll-mt-36 bg-[#f7f7f2] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72805a]">Opiniones</p>
          <h2 className="mt-2 font-display text-3xl">Reseñas de clientes</h2>
          <div className="mt-5 flex items-center gap-3">
            <span
              className={`text-xl tracking-[.1em] ${details.rating ? "text-[#c89a31]" : "text-[#a8aca3]"}`}
              aria-hidden="true"
            >
              {details.rating ? "★".repeat(Math.round(details.rating)) : "☆☆☆☆☆"}
            </span>
            <strong>{details.rating ? details.rating.toFixed(1) : "Sin calificación"}</strong>
            <span className="text-sm text-muted">({details.reviewCount} reseñas)</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            Las opiniones son administradas por la tienda y no se verifican de forma independiente.
          </p>
          {details.reviews.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {details.reviews.map((review) => (
                <article key={`${review.author}-${review.date}`} className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{review.author}</strong>
                    <time className="text-xs text-muted">{review.date}</time>
                  </div>
                  <p
                    className="mt-2 text-sm tracking-wider text-[#c89a31]"
                    aria-label={`${review.rating} de 5 estrellas`}
                  >
                    {"★".repeat(review.rating)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">{review.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-lg bg-white p-5 text-sm text-muted">
              Este producto aún no tiene reseñas.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
