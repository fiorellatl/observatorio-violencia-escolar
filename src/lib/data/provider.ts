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
import type { CrossRow, Meta, NationalYear, SchoolDetail, SearchRow } from "@/lib/types";

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
  ]);
}
