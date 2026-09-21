/**
 * Resuelve `@/...` fuera de Next.
 *
 * Los scripts de validación tienen que ejecutar EL MISMO módulo que sirve la
 * web, no una copia. Sin esto habría que reimplementar el cálculo para poder
 * comprobarlo, que es exactamente lo que la validación debe descartar.
 */
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const raiz = path.join(process.cwd(), "src");

export function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith("@/")) {
    const base = path.join(raiz, especificador.slice(2));
    for (const ext of [".ts", ".tsx", "/index.ts", ""]) {
      const f = base + ext;
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        return { url: pathToFileURL(f).href, shortCircuit: true };
      }
    }
  }
  return siguiente(especificador, contexto);
}
