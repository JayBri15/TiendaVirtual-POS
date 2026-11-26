import React from "react";
import { createRoot } from "react-dom/client";
import "../CSS/app.css";
import { Storefront } from "./pages/Storefront.jsx";
import { Checkout } from "./pages/Checkout.jsx";
import { Admin } from "./pages/Admin.jsx";
import { ThemeToggle } from "./shared/ui.jsx";

try {
  const savedTheme = window.localStorage.getItem("amway-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.dataset.theme = savedTheme;
  }
} catch (error) {
  console.error("No se pudo leer la preferencia del tema.", error);
}

// Selecciona una pantalla React a partir del parámetro de URL, sin duplicar HTML.
const page = new URLSearchParams(window.location.search).get("page");

const application =
  page === "checkout" ? <Checkout /> : page === "admin" ? <Admin /> : <Storefront />;

// Monta la pantalla elegida en el único punto de entrada HTML del sitio.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeToggle />
    {application}
  </React.StrictMode>
);
