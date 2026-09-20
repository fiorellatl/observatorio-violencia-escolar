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
  return Object.values(allDetail())
    .filter((s) => Object.keys(s.anios).some((a) => recientes.has(a)))
    .sort((a, b) => b.total - a.total)
    .map((s) => s.slug);
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

  const filas: BrowseRow[] = Object.values(allDetail()).map((s) => {
    const anios = Object.keys(s.anios).filter((a) => (s.anios[a]?.total ?? 0) > 0);
    const ultimo = anios.length ? anios.sort()[anios.length - 1] : "";
    return [
      s.nombre,
      s.cm,
      id("d", s.distrito),
      id("p", s.provincia),
      id("r", s.departamento),
      id("g", s.gestion),
      id("n", s.nivel ?? ""),
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

  const filas: RankingRow[] = [];
  for (const s of Object.values(allDetail())) {
    const mat = s.matricula ?? 0;
    const activo = anios.some((a) => (s.anios[a]?.total ?? 0) > 0);
    if (!activo && mat < meta.matricula_minima) continue;

    const conteos: Record<string, [number, number, number, number]> = {};
    for (const a of anios) {
      const c = s.anios[a];
      if (!c?.total) continue;
      conteos[a] = [c.total, c.fisica ?? 0, c.psicologica ?? 0, c.sexual ?? 0];
    }

    filas.push([
      s.nombre,
      s.cm,
      id("d", s.distrito),
      id("p", s.provincia),
      id("r", s.departamento),
      id("g", s.gestion),
      id("n", s.nivel ?? ""),
      mat,
      conteos,
    ]);
  }

  return {
    anios,
    anio_tasa: meta.anio_transversal,
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
