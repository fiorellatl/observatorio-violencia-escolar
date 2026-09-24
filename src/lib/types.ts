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

/**
 * Por qué no hay pensión, cuando no la hay.
 *
 * Antes la ausencia era un solo `null` que valía para cuatro situaciones muy
 * distintas, y la interfaz no podía distinguirlas porque el dato no las
 * distinguía: acababa diciendo lo mismo de un colegio público —que por
 * definición no cobra— y de uno privado que simplemente no hemos consultado.
 * Eso no es un detalle de presentación, es un error de modelado.
 */
export type EstadoPension =
  /** Hay importe, con su año. */
  | "disponible"
  /** Colegio público: no cobra pensión. */
  | "no_aplica"
  /** Tiene ficha en Identicole y la ficha no declara importe. */
  | "no_informada"
  /** Su ficha no se ha consultado: la cobertura de Identicole es solo Lima. */
  | "sin_ficha"
  /** SíseVe lo llama público e Identicole, privado. No se resuelve a ojo. */
  | "conflicto";

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
  pension_estado?: EstadoPension;
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
 * Un SERVICIO educativo dentro de una institución: un nivel con su propio
 * código modular. El modelo los conserva porque los reportes, los alumnos y
 * la composición se registran por servicio; lo que se agrega es la ficha.
 */
export interface InstitutionService {
  cm: string;
  slug: string;
  nombre: string;
  nivel: string;
  total: number;
  anios: Record<string, YearCounts>;
  matricula?: number | null;
  anio_matricula?: string | null;
  docentes?: number | null;
  secciones?: number | null;
  pension?: number | null;
  anio_pension?: string | null;
  pension_estado?: EstadoPension;
  tasa_2024?: number | null;
}

/**
 * Una INSTITUCIÓN educativa: lo que una persona llama "un colegio".
 *
 * Agrupa sus servicios por `codinst`, el identificador oficial del padrón.
 * Nunca por nombre ni por `codlocal`. Un servicio sin `codinst` es su propia
 * institución: preferimos no agrupar antes que agrupar mal.
 *
 * `matricula` y `tasa_2024` son null cuando algún servicio no trae
 * denominador: sumar un numerador completo sobre un denominador parcial
 * inflaría la tasa.
 */
export interface Institution {
  codinst: string | null;
  slug: string;
  /** Código modular del servicio cabecera: la clave en los índices. */
  cm: string;
  nombre: string;
  distrito: string;
  provincia: string;
  departamento: string;
  gestion: string;
  dre: string;
  ugel: string;
  niveles: string[];
  total: number;
  anios: Record<string, YearCounts>;
  matricula: number | null;
  matricula_completa: boolean;
  anio_matricula?: string | null;
  tasa_2024: number | null;
  contexto?: Record<string, ContextField>;
  servicios: InstitutionService[];
}

/**
 * Fila del índice de navegación. Los textos repetidos viajan como índice a un
 * diccionario, no como texto. Una fila es una INSTITUCIÓN, no un servicio:
 * [nombre, codMod cabecera, distritoId, provinciaId, regiónId, gestiónId,
 *  nivelIds, totalDeReportes, últimoAñoConReportes]
 *
 * `nivelIds` es una lista porque una institución ofrece varios niveles y el
 * filtro significa "ofrece este nivel", no "es de este nivel".
 */
export type BrowseRow = [string, string, number, number, number, number, number[], number, string];

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
 * [nombre, codMod cabecera, distritoId, provinciaId, regiónId, gestiónId,
 *  nivelIds, matrícula (0 si no se conoce), conteos por año, porNivel?, ugelId]
 *
 * `distritoId` identifica el distrito por departamento + provincia + nombre, y
 * `ugelId` la UGEL por DRE + nombre: hay 92 nombres de distrito repetidos en
 * el país y dos «UGEL La Unión». Ninguno de los dos es único por sí solo.
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
  number[],
  number,
  Record<string, [number, number, number, number]>,
  /** Desglose por nivel: nivelId -> [matrícula, conteos]. Solo en
      instituciones con más de un servicio; en las demás sería una copia
      (y viaja como null). */
  Record<string, [number, Record<string, [number, number, number, number]>]> | null | undefined,
  number,
];

/** Cuantiles nacionales de un año. Van en el índice para que el mapa de
    calor use el mismo reparto en la web y en la imagen compartible, y para
    que el color no dependa del filtro que el usuario tenga puesto. */
export interface CuantilesAnio {
  n: number;
  mediana: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface RankingIndex {
  /** anio -> cuantiles nacionales sobre colegios con al menos un reporte. */
  distribucion: Record<string, CuantilesAnio>;
  /** Años ofrecidos. Excluye la pandemia: no es comparable. */
  anios: string[];
  /** Año de los REPORTES con los que se calcula la tasa. */
  anio_tasa: string;
  /** Año del PADRÓN que aporta el denominador. Puede no coincidir, y si no
      coincide la interfaz tiene que decirlo. */
  anio_padron: string;
  anio_parcial: string;
  /** Último año completo: el que la interfaz muestra por defecto. */
  anio_principal: string;
  matricula_minima: number;
  /** `d` puede repetir nombres: cada entrada es un distrito distinto.
      `u` no los repite: la UGEL cuyo nombre existe en dos DRE lleva la región
      entre paréntesis, porque es lo que se muestra y lo que viaja en la URL. */
  dic: { r: string[]; p: string[]; d: string[]; g: string[]; n: string[]; u: string[] };
  filas: RankingRow[];
}

/** Colegio dentro de una señal. Todo agregado; nada individual. */
export interface SignalSchool {
  nombre: string;
  cm: string;
  slug: string;
  distrito: string;
  provincia: string;
  region: string;
  gestion: string;
  nivel: string;
  matricula?: number | null;
  anio_matricula?: string | null;
}

export interface SignalCambio extends SignalSchool {
  anterior: number;
  actual: number;
  cambio: number;
  /** Probabilidad de ver un cambio así si nada hubiera cambiado. */
  p: number;
}

export interface SignalComposicion extends SignalSchool {
  p: number;
  df: number;
  antes: Record<string, number>;
  ahora: Record<string, number>;
  total_antes: number;
  total_ahora: number;
}

export interface SignalReaparicion extends SignalSchool {
  actual: number;
  anios_sin: number;
  ultimo_con: string;
}

export interface SignalPersistencia extends SignalSchool {
  anios_con: number;
  ventana: number;
  total: number;
}

export interface SignalPar {
  anio_anterior: string;
  anio: string;
  nacional_anterior: number;
  nacional: number;
  ratio_nacional: number;
  theta: number;
  probados: number;
  probados_composicion: number;
  /** Totales reales antes del recorte de las listas. */
  totales: Record<string, number>;
  aumento: SignalCambio[];
  disminucion: SignalCambio[];
  composicion: SignalComposicion[];
  reaparicion: SignalReaparicion[];
  persistencia: SignalPersistencia[];
}

export interface Signals {
  pares: SignalPar[];
  meta: { q_fdr: number; min_n: number; min_composicion: number; anios: string[] };
}

/**
 * Un territorio agregado: una región o una UGEL.
 *
 * `tasa` es null cuando el denominador no cubre el territorio entero. No es
 * cero: un cero se ordenaría como si fuera el sitio que menos registra,
 * cuando lo que ocurre es que no lo sabemos.
 */
export interface FilaTerritorio {
  nombre: string;
  region?: string | null;
  reportes: number;
  alumnos: number;
  instituciones: number;
  sin_denominador: number;
  cobertura: number;
  tasa: number | null;
  /** La tasa existe pero su denominador no cubre todo el territorio. */
  aproximada?: boolean;
  /** Por qué no hay tasa. Null cuando sí la hay. */
  motivo?: "territorio_pequeno" | "sin_denominador" | "pocos_reportes" | null;
  serie: Record<string, number>;
}

export interface Territorio {
  anio: string;
  regiones: FilaTerritorio[];
  ugeles: FilaTerritorio[];
  cobertura: {
    minima: number;
    minimo_instituciones: number;
    reportes_minimos: number;
    regiones_con_tasa: number;
    ugeles_con_tasa: number;
  };
}
