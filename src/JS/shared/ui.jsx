import React, { useEffect, useRef, useState } from "react";

const themeStorageKey = "amway-theme";

/** Global light/dark theme control, shared by every page mounted in main.jsx. */
export function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    const syncTheme = (event) => {
      if (event.key !== themeStorageKey) return;
      const nextTheme = event.newValue === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(themeStorageKey, nextTheme);
    } catch (error) {
      console.error("No se pudo guardar la preferencia del tema.", error);
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Cambiar a tema ${theme === "dark" ? "claro" : "oscuro"}`}
      title={`Cambiar a tema ${theme === "dark" ? "claro" : "oscuro"}`}
    >
      {theme === "dark" ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
        </svg>
      )}
      <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
    </button>
  );
}

export function TrashIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
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
  );
}

/** Searchable, themed alternative to the browser-native select menu. */
export function SelectMenu({
  id,
  value,
  onChange,
  options,
  placeholder = "Selecciona una opción",
  searchPlaceholder = "Buscar opciones...",
  disabled = false,
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const triggerRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value);
  const visibleOptions = options.filter((option) =>
    `${option.label} ${option.detail || ""}`
      .toLocaleLowerCase("es-MX")
      .includes(query.trim().toLocaleLowerCase("es-MX"))
  );
  const listboxId = `${id}-options`;
  const activeOptionId = open && visibleOptions.length ? `${listboxId}-${activeIndex}` : undefined;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    searchRef.current?.focus();
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (activeOptionId) {
      document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeOptionId]);

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
  };

  const selectOption = (option) => {
    onChange(option.value);
    closeMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown" && visibleOptions.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleOptions.length);
    } else if (event.key === "ArrowUp" && visibleOptions.length) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + visibleOptions.length) % visibleOptions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (visibleOptions[activeIndex]) selectOption(visibleOptions[activeIndex]);
    }
  };

  return (
    <div className="select-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="select-menu-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
          setActiveIndex(
            Math.max(
              0,
              options.findIndex((option) => option.value === value)
            )
          );
        }}
      >
        <span className={selectedOption ? "select-menu-value" : "select-menu-placeholder"}>
          {selectedOption?.label || placeholder}
        </span>
        <svg
          aria-hidden="true"
          className={`select-menu-chevron ${open ? "is-open" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="select-menu-popover">
          <div className="select-menu-search-wrap">
            <svg
              aria-hidden="true"
              className="select-menu-search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              ref={searchRef}
              className="select-menu-search"
              type="search"
              role="combobox"
              aria-label={searchPlaceholder}
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div className="select-menu-options" id={listboxId} role="listbox">
            {visibleOptions.length ? (
              visibleOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.value || "__empty"}
                    id={`${listboxId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`select-menu-option ${isSelected ? "is-selected" : ""} ${isActive ? "is-active" : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                  >
                    <span className="select-menu-option-copy">
                      <span className="select-menu-option-label">{option.label}</span>
                      {option.detail && (
                        <span className="select-menu-option-detail">{option.detail}</span>
                      )}
                    </span>
                    {isSelected && (
                      <svg
                        aria-hidden="true"
                        className="select-menu-check"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path
                          d="m4 10 4 4 8-8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="select-menu-empty">No se encontraron opciones.</p>
            )}
          </div>
          <p className="select-menu-hint">
            {visibleOptions.length} {visibleOptions.length === 1 ? "opción" : "opciones"}
          </p>
        </div>
      )}
    </div>
  );
}

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
