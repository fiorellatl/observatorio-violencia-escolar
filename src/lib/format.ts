/** Formato peruano: coma para miles, coma decimal. */

export const nf = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("es-PE");

export const dec = (n: number | null | undefined, d = 1): string =>
  n == null ? "—" : n.toFixed(d).replace(".", ",");

export const pct = (parte: number, total: number, d = 1): string =>
  total === 0 ? "—" : `${dec((parte / total) * 100, d)} %`;

/** Quita diacríticos y baja a minúsculas. Base de toda comparación de texto. */
export const norm = (s: string): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Slug del colegio. Debe producir exactamente el mismo resultado que
 * `slugify()` en scripts/build_public_data.py: el buscador del navegador lo
 * recalcula a partir del índice compacto en vez de transportarlo.
 */
export const slugify = (nombre: string, distrito: string, cm: string): string => {
  const base = `${norm(nombre)}-${norm(distrito)}`
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${base}-${cm}`;
};

const TITULO_MINUSCULAS = new Set(["de", "del", "la", "las", "el", "los", "y", "en"]);

export const titulo = (s: string): string =>
  (s ?? "")
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && TITULO_MINUSCULAS.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
