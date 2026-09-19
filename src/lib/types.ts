/**
 * Contrato de la capa pública.
 *
 * Todo lo que se tipa aquí ya pasó por la puerta de anonimización del pipeline
 * (scripts/build_public_data.py). No existe ni debe existir un tipo que
 * represente un reporte individual: esa tabla no sale de la máquina.
 */

/** Conteos de una escuela en un año. Todas las claves son agregados. */
export interface YearCounts {
  total: number;
  psicologica?: number;
  fisica?: number;
  sexual?: number;
  bullying?: number;
  ciberacoso?: number;
  personal_ie?: number;
  entre_escolares?: number;
}

export interface SchoolDetail {
  cm: string;
  slug: string;
  nombre: string;
  distrito: string;
  provincia: string;
  departamento: string;
  gestion: string;
  nivel: string;
  dre: string;
  ugel: string;
  total: number;
  anios: Record<string, YearCounts>;
  /** Solo disponible donde ya descargamos el padrón de ESCALE. */
  matricula?: number | null;
  docentes?: number | null;
  secciones?: number | null;
  anio_matricula?: string | null;
  tasa_2024?: number | null;
  /** Solo colegios privados, y solo donde ya bajamos la ficha de Identicole. */
  pension?: number | null;
  anio_pension?: string | null;
  /** Contexto de Identicole. Cada campo lleva su propia fuente y año. */
  contexto?: Record<string, ContextField>;
}

/** Un dato de contexto con su procedencia: v = valor, f = fuente, a = año. */
export interface ContextField {
  v: string | number;
  f: string;
  a?: string | null;
}

/** Fila compacta del índice de búsqueda: [nombre, distrito, región, codMod, total] */
export type SearchRow = [string, string, string, string, number];

export interface NationalYear extends YearCounts {
  anio: string;
  /** 2020–2021: colegios cerrados. No comparable. */
  pandemia: boolean;
}

export interface CrossRow {
  slug: string;
  nombre: string;
  distrito: string;
  gestion: string;
  nivel: string;
  matricula: number;
  reportes: number;
  tasa: number;
  pension?: number | null;
}

export interface SourceRef {
  nombre: string;
  anio: string;
  via: string;
}

export interface Meta {
  corte: string;
  generado: string;
  reportes: number;
  colegios: number;
  anio_min: string;
  anio_max: string;
  /** Año con mejor intersección de variables. Hoy: 2024. */
  anio_transversal: string;
  anios_pandemia: string[];
  /** Último año, incompleto (corte a agosto). */
  anio_parcial: string;
  /** Matrícula mínima para calcular una tasa por 1,000 sin que el número mienta. */
  matricula_minima: number;
  fuentes: Record<string, SourceRef>;
}

/** Etiqueta de procedencia que acompaña a cada dato en la interfaz. */
export interface Provenance {
  fuente: string;
  anio: string | number | null | undefined;
}
