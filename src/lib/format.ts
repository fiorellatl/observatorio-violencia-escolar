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

/**
 * Normaliza un valor de contexto para mostrarlo.
 *
 * Identicole y el Censo Escolar devuelven algunos valores en mayúsculas y sin
 * tildes ("SI", "NO"). Mostrarlos tal cual rompe la lectura de una ficha que
 * por lo demás está escrita en prosa. Solo se toca la forma: el valor sigue
 * siendo el que declaró la fuente.
 */
const VALORES: Record<string, string> = { SI: "Sí", NO: "No", "S/I": "Sin información" };

export const valorLegible = (v: string | number): string => {
  const s = String(v).trim();
  if (VALORES[s.toUpperCase()]) return VALORES[s.toUpperCase()];
  // Solo se retoca lo que viene íntegramente en mayúsculas; el resto ya viene
  // escrito como corresponde y tocarlo estropearía siglas como "JEC" o "UGEL".
  if (s.length > 3 && s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s)) return titulo(s);
  return s;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Fecha de corte en prosa: "31 de agosto de 2026".
 *
 * El ISO sirve para ordenar y para la máquina; dentro de una frase obliga a
 * descifrarlo. Se parte a mano en vez de usar `Date` porque `new Date("2026-08-31")`
 * interpreta UTC y en Lima devuelve el día anterior.
 */
export const fechaLegible = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return iso ?? "";
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
};
