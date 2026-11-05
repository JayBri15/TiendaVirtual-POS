import React, { useEffect, useState } from "react";

/** Centraliza notificaciones accesibles y permite mostrarlas desde cada pantalla. */
export function useNotice() {
  const [notices, setNotices] = useState([]);
  const notify = (message, type = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotices((current) => [...current, { id, message, type }]);
    window.setTimeout(
      () => setNotices((current) => current.filter((item) => item.id !== id)),
      3600
    );
  };
  return {
    notify,
    region: (
      <div className="notice-stack" role="status" aria-live="polite" aria-atomic="true">
        {notices.map((item) => (
          <div
            key={item.id}
            className={`notice ${item.type === "error" ? "notice-error" : "notice-success"}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    ),
  };
}

/** Suscribe un callback a cambios de localStorage originados en otras pestañas. */
export function useCrossTabStorage(callback) {
  useEffect(() => {
    const onStorage = (event) => callback(event);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [callback]);
}

/** Marca de marca reutilizable con enlace configurable para cada pantalla. */
export function Brand({ to = "./", inverse = false }) {
  return (
    <a
      href={to}
      className={`font-display text-3xl font-bold tracking-[-.08em] ${inverse ? "text-white" : "text-leaf"}`}
      aria-label="Amway, ir a la tienda"
    >
      amway<span className="text-lime">.</span>
    </a>
  );
}

/** Campo de texto compartido para mantener etiquetas y estilos consistentes. */
export function Field({ label, id, className = "", ...props }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      <input id={id} className="input" {...props} />
    </label>
  );
}

/** Encabezado estándar de sección con texto introductorio y acción opcional. */
export function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#72805a]">{eyebrow}</p>
        <h2 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h2>
        {description && <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Evita el desplazamiento de la página mientras una vista superpuesta está abierta. */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
}
