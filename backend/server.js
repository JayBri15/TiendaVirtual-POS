import { createApp } from "./app.js";
import { createCatalogRepository } from "./catalogRepository.js";

// PORT permite cambiar el puerto al ejecutar el servidor en otros entornos.
const port = Number(process.env.PORT) || 3000;
const catalogRepository = createCatalogRepository();
const app = createApp({ catalogRepository });

app.listen(port, () => {
  console.log(`Backend disponible en http://localhost:${port}`);
});
