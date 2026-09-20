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

/**
 * Fila del índice de navegación. Los textos repetidos viajan como índice a un
 * diccionario, no como texto:
 * [nombre, codMod, distritoId, provinciaId, regiónId, gestiónId, nivelId,
 *  totalDeReportes, últimoAñoConReportes]
 */
export type BrowseRow = [string, string, number, number, number, number, number, number, string];

export interface BrowseIndex {
  dic: { r: string[]; p: string[]; d: string[]; g: string[]; n: string[] };
  filas: BrowseRow[];
}

/** Fila compacta del índice: [nombre, distrito, región, codMod, total, nivel] */
export type SearchRow = [string, string, string, string, number, string];

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

/**
 * Fila del índice de rankings:
 * [nombre, codMod, distritoId, provinciaId, regiónId, gestiónId, nivelId,
 *  matrícula (0 si no se conoce), conteos por año]
 *
 * `conteos[año] = [total, física, psicológica, sexual]`. Solo los años con
 * algún reporte: la mayoría de colegios no tiene actividad todos los años y
 * guardar ceros multiplicaría el peso sin añadir información.
 */
export type RankingRow = [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  Record<string, [number, number, number, number]>,
];

export interface RankingIndex {
  /** Años ofrecidos. Excluye la pandemia: no es comparable. */
  anios: string[];
  /** Único año con tasa. Solo hay un padrón de matrícula. */
  anio_tasa: string;
  anio_parcial: string;
  matricula_minima: number;
  dic: { r: string[]; p: string[]; d: string[]; g: string[]; n: string[] };
  filas: RankingRow[];
}
