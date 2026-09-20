/**
 * Proveedor de datos — lado servidor.
 *
 * Único punto por el que la aplicación toca el disco. Lee exclusivamente
 * `data/public/`, que es la salida agregada del pipeline. Si algún día hace
 * falta cambiar a una base de datos o a una API, se reemplaza este archivo y
 * nada más.
 *
 * Nunca debe leer de `data/raw/` ni de `data/processed/`.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  BrowseIndex,
  Institution,
  BrowseRow,
  RankingIndex,
  RankingRow,
  Signals,
  CrossRow,
  Meta,
  NationalYear,
  SchoolDetail,
  SearchRow,
} from "@/lib/types";

const DIR = path.join(process.cwd(), "data", "public");

function read<T>(archivo: string): T {
  const p = path.join(DIR, archivo);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Falta ${archivo}. Genera la capa pública con:\n` +
        `  python scripts/build_public_data.py --fuente <ruta del xlsx>`
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

// Los JSON son grandes (12 MB la ficha). Se cachean en el módulo para que el
// build no los relea una vez por página.
let _detail: Record<string, SchoolDetail> | null = null;
let _meta: Meta | null = null;
let _national: NationalYear[] | null = null;
let _cross: CrossRow[] | null = null;

export function getMeta(): Meta {
  return (_meta ??= read<Meta>("meta.json"));
}

export function getNational(): NationalYear[] {
  return (_national ??= read<NationalYear[]>("national.json"));
}

export function getCross(): CrossRow[] {
  return (_cross ??= read<CrossRow[]>("cross_2024.json"));
}

function allDetail(): Record<string, SchoolDetail> {
  return (_detail ??= read<Record<string, SchoolDetail>>("schools_detail.json"));
}

export function getSchool(slug: string): SchoolDetail | null {
  return allDetail()[slug] ?? null;
}

/* ─────────────────────────────────────────────────────────────────────────
   INSTITUCIONES
   La unidad pública del producto. Un colegio es una institución; los niveles
   son una dimensión dentro de ella, no fichas distintas. La agregación se
   hace UNA vez, en scripts/construir_instituciones.py, y aquí solo se lee:
   ningún componente vuelve a sumar servicios por su cuenta.
   ──────────────────────────────────────────────────────────────────────── */
let _inst: Record<string, Institution> | null = null;
let _redir: Record<string, [string, string]> | null = null;

function allInstitutions(): Record<string, Institution> {
  return (_inst ??= read<Record<string, Institution>>("institutions.json"));
}

export function getInstitution(slug: string): Institution | null {
  return allInstitutions()[slug] ?? null;
}

/**
 * Valores válidos de cada filtro.
 *
 * 23 KB frente a los 14 MB de instituciones: existe para que el servidor
 * pueda comprobar los parámetros de una URL al generar los metadatos sin
 * cargar el índice entero en cada arranque en frío.
 */
export interface Facetas {
  r: string[];
  p: string[];
  d: string[];
  g: string[];
  n: string[];
}
let _facetas: Facetas | null = null;

export function getFacetas(): Facetas {
  return (_facetas ??= read<Facetas>("facetas.json"));
}

/** Devuelve el valor solo si existe en los datos; si no, cadena vacía. */
export function facetaValida(clave: keyof Facetas, valor: string): string {
  if (!valor) return "";
  return getFacetas()[clave].includes(valor) ? valor : "";
}

/**
 * Un slug de servicio que fue absorbido por una institución.
 *
 * Las URLs de servicio ya estaban indexadas y compartidas, así que no se
 * rompen: devuelven a dónde ir y con qué nivel preseleccionado.
 */
export function getServiceRedirect(slug: string): { slug: string; nivel: string } | null {
  _redir ??= read<Record<string, [string, string]>>("service-redirects.json");
  const r = _redir[slug];
  return r ? { slug: r[0], nivel: r[1] } : null;
}

/**
 * Slugs que se prerrenderizan.
 *
 * No generamos página indexable para colegios sin datos útiles: un colegio con
 * un único reporte de 2015 no tiene nada que contar y sí contribuye a un índice
 * ruidoso. El criterio es tener actividad en los años comparables recientes.
 */
export function getPrerenderSlugs(): string[] {
  const meta = getMeta();
  const recientes = new Set(["2023", "2024", "2025", meta.anio_parcial]);
  return Object.values(allInstitutions())
    .filter((i) => Object.keys(i.anios).some((a) => recientes.has(a)))
    .sort((a, b) => b.total - a.total)
    .map((i) => i.slug);
}

export function getSchoolsSample(n: number): SchoolDetail[] {
  return Object.values(allDetail())
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

/** Índice compacto de búsqueda, servido como archivo estático al navegador. */
export function getSearchIndex(): SearchRow[] {
  return Object.values(allDetail()).map((s) => [
    s.nombre,
    s.distrito,
    s.departamento,
    s.cm,
    s.total,
    s.nivel ?? "",
  ]);
}

/**
 * Índice de navegación: un único archivo para el buscador global y el
 * explorador de /colegios.
 *
 * Se sirve desde una ruta estática (`/data/browse-index.json`) y NO se
 * serializa dentro del HTML. Antes /colegios recibía las 22.569 filas como
 * props de un componente de cliente y la página pesaba 1,85 MB; ahora el
 * navegador se descarga el índice una sola vez, el CDN lo cachea y la página
 * se queda en unas decenas de kilobytes.
 *
 * Los textos que se repiten (región, provincia, distrito, gestión, nivel) van
 * en diccionarios y las filas guardan el índice: "Santiago de Surco" aparece
 * una vez y no 195. El slug no viaja: el cliente lo recalcula con la misma
 * función `slugify` que usó el ETL.
 */
export function getBrowseIndex(): BrowseIndex {
  const dic = { r: [] as string[], p: [] as string[], d: [] as string[], g: [] as string[], n: [] as string[] };
  const mapas = { r: new Map<string, number>(), p: new Map<string, number>(), d: new Map<string, number>(), g: new Map<string, number>(), n: new Map<string, number>() };

  const id = (clave: keyof typeof dic, valor: string): number => {
    const m = mapas[clave];
    let i = m.get(valor);
    if (i === undefined) {
      i = dic[clave].length;
      dic[clave].push(valor);
      m.set(valor, i);
    }
    return i;
  };

  const filas: BrowseRow[] = Object.values(allInstitutions()).map((s) => {
    const anios = Object.keys(s.anios).filter((a) => (s.anios[a]?.total ?? 0) > 0);
    const ultimo = anios.length ? anios.sort()[anios.length - 1] : "";
    return [
      s.nombre,
      s.cm,
      id("d", s.distrito),
      id("p", s.provincia),
      id("r", s.departamento),
      id("g", s.gestion),
      s.niveles.map((n) => id("n", n)),
      s.total,
      ultimo,
    ];
  });

  filas.sort((a, b) => b[7] - a[7]);
  return { dic, filas };
}

/**
 * Índice para el explorador de rankings.
 *
 * Contiene, por colegio, los conteos por año y por tipo de violencia, más la
 * matrícula cuando se conoce. Se sirve como archivo estático y solo lo
 * descarga quien abre /rankings.
 *
 * Entran dos poblaciones: los colegios con reportes en los años comparables y
 * los que tienen matrícula válida aunque no registren nada. Los segundos
 * existen para que "incluir colegios con 0 reportes" signifique algo — sin
 * ellos, el ranking por tasa daría por hecho que todo colegio registra algo.
 *
 * Se excluyen 2020 y 2021: con los colegios cerrados, ordenar por número de
 * reportes mide el acceso al canal de denuncia, no lo que dice medir.
 */
export function getRankingIndex(): RankingIndex {
  const meta = getMeta();
  const pandemia = new Set(meta.anios_pandemia);
  const anios = ["2022", "2023", "2024", "2025", "2026"].filter((a) => !pandemia.has(a));

  const dic = { r: [] as string[], p: [] as string[], d: [] as string[], g: [] as string[], n: [] as string[] };
  const mapas = { r: new Map<string, number>(), p: new Map<string, number>(), d: new Map<string, number>(), g: new Map<string, number>(), n: new Map<string, number>() };
  const id = (clave: keyof typeof dic, valor: string): number => {
    const m = mapas[clave];
    let i = m.get(valor);
    if (i === undefined) {
      i = dic[clave].length;
      dic[clave].push(valor);
      m.set(valor, i);
    }
    return i;
  };

  type Conteos = Record<string, [number, number, number, number]>;
  const conteosDe = (fuente: { anios: Record<string, import("@/lib/types").YearCounts> }): Conteos => {
    const c: Conteos = {};
    for (const a of anios) {
      const x = fuente.anios[a];
      if (!x?.total) continue;
      c[a] = [x.total, x.fisica ?? 0, x.psicologica ?? 0, x.sexual ?? 0];
    }
    return c;
  };

  const filas: RankingRow[] = [];
  for (const s of Object.values(allInstitutions())) {
    const mat = s.matricula ?? 0;
    const activo = anios.some((a) => (s.anios[a]?.total ?? 0) > 0);
    if (!activo && mat < meta.matricula_minima) continue;

    // Desglose por nivel: permite que filtrar por "Primaria" muestre los
    // reportes de primaria y no el total de la institución. Solo se guarda
    // donde hay más de un servicio; en el resto sería una copia del total.
    let porNivel: RankingRow[9];
    if (s.servicios.length > 1) {
      porNivel = {};
      for (const sv of s.servicios) {
        porNivel[String(id("n", sv.nivel))] = [sv.matricula ?? 0, conteosDe(sv)];
      }
    }

    filas.push([
      s.nombre,
      s.cm,
      id("d", s.distrito),
      id("p", s.provincia),
      id("r", s.departamento),
      id("g", s.gestion),
      s.niveles.map((n) => id("n", n)),
      mat,
      conteosDe(s),
      porNivel,
    ]);
  }

  return {
    anios,
    anio_tasa: meta.anio_transversal,
    anio_padron: meta.fuentes.matricula?.anio ?? "",
    anio_principal: getAnioPrincipal(),
    anio_parcial: meta.anio_parcial,
    matricula_minima: meta.matricula_minima,
    dic,
    filas,
  };
}

/**
 * Señales de cambio. Las genera `scripts/build_signals.py`; aquí solo se leen.
 *
 * Devuelve null si el archivo no existe todavía, para que la página pueda
 * explicar que la detección aún no se ha ejecutado en vez de reventar.
 */
let _signals: Signals | null | undefined;

export function getSignals(): Signals | null {
  if (_signals === undefined) {
    const p = path.join(DIR, "signals.json");
    _signals = fs.existsSync(p)
      ? (JSON.parse(fs.readFileSync(p, "utf-8")) as Signals)
      : null;
  }
  return _signals;
}

/**
 * Año principal de la experiencia: el último año COMPLETO.
 *
 * No es el año con denominador. Que 2024 fuera el único año con tasa hizo que
 * la ficha mostrara 2024 como si fuera el estado actual del colegio, cuando el
 * último año cerrado es otro. La disponibilidad de una métrica secundaria no
 * puede decidir de qué año habla el producto.
 */
export function getAnioPrincipal(): string {
  const meta = getMeta();
  const pandemia = new Set(meta.anios_pandemia);
  const completos = getNational()
    .map((n) => n.anio)
    .filter((a) => !pandemia.has(a) && a !== meta.anio_parcial)
    .sort();
  return completos[completos.length - 1] ?? meta.anio_transversal;
}

/**
 * Posición de un colegio en el ranking nacional por reportes de un año.
 *
 * Se calcula sobre el universo completo y sin filtros, que es el único que la
 * ficha puede afirmar sin mentir: un puesto depende del universo, así que la
 * interfaz tiene que decir cuál usó. Empate resuelto por nombre, igual que en
 * el explorador, para que los dos den el mismo número.
 */
let _rank: Record<string, Map<string, { pos: number; total: number }>> | null = null;

export function getPosicionRanking(
  cm: string,
  anio: string
): { pos: number; universo: number } | null {
  _rank ??= {};
  if (!_rank[anio]) {
    const lista = Object.values(allInstitutions())
      .map((s) => ({ cm: s.cm, v: s.anios[anio]?.total ?? 0, n: s.nombre }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || a.n.localeCompare(b.n, "es"));
    const m = new Map<string, { pos: number; total: number }>();
    lista.forEach((x, i) => m.set(x.cm, { pos: i + 1, total: lista.length }));
    _rank[anio] = m;
  }
  const r = _rank[anio].get(cm);
  return r ? { pos: r.pos, universo: r.total } : null;
}

/**
 * Señal reciente de un colegio, si la tiene.
 *
 * Solo mira el ÚLTIMO par de años calculado: la ficha dice "señal reciente",
 * y arrastrar la de 2019 bajo ese rótulo sería falso. Devuelve una sola señal
 * —la de cambio, si la hay, y si no el patrón— porque la ficha muestra un
 * bloque, no una lista: enumerar cuatro etiquetas junto a un nombre propio
 * vuelve a parecerse a una nota.
 */
export type SenalFicha =
  | { clase: "aumento" | "disminucion"; anio: string; anio_anterior: string; anterior: number; actual: number }
  | { clase: "composicion"; anio: string; anio_anterior: string }
  | { clase: "reaparicion"; anio: string; actual: number; anios_sin: number; ultimo_con: string }
  | { clase: "persistencia"; anio: string; anios_con: number; ventana: number };

let _senalPorCm: Map<string, SenalFicha> | null = null;

export function getSenalDeColegio(cms: string | string[]): SenalFicha | null {
  if (!_senalPorCm) {
    _senalPorCm = new Map();
    const s = getSignals();
    const par = s?.pares[s.pares.length - 1];
    if (par) {
      // Orden de preferencia: un cambio contrastado manda sobre un patrón.
      for (const x of par.persistencia)
        _senalPorCm.set(x.cm, { clase: "persistencia", anio: par.anio, anios_con: x.anios_con, ventana: x.ventana });
      for (const x of par.reaparicion)
        _senalPorCm.set(x.cm, { clase: "reaparicion", anio: par.anio, actual: x.actual, anios_sin: x.anios_sin, ultimo_con: x.ultimo_con });
      for (const x of par.composicion)
        _senalPorCm.set(x.cm, { clase: "composicion", anio: par.anio, anio_anterior: par.anio_anterior });
      for (const x of par.disminucion)
        _senalPorCm.set(x.cm, { clase: "disminucion", anio: par.anio, anio_anterior: par.anio_anterior, anterior: x.anterior, actual: x.actual });
      for (const x of par.aumento)
        _senalPorCm.set(x.cm, { clase: "aumento", anio: par.anio, anio_anterior: par.anio_anterior, anterior: x.anterior, actual: x.actual });
    }
  }
  // Una institución tiene varios códigos modulares: la señal es suya si la
  // tiene cualquiera de sus servicios.
  for (const cm of Array.isArray(cms) ? cms : [cms]) {
    const s = _senalPorCm.get(cm);
    if (s) return s;
  }
  return null;
}
