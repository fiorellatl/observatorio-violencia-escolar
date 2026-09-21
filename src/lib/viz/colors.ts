/**
 * Lenguaje de color de los datos.
 *
 * Única fuente de verdad. Ningún gráfico define un color por su cuenta: si una
 * categoría vale azul en /datos y ámbar en la ficha de un colegio, el lector
 * tiene que reaprender la leyenda en cada pantalla y deja de fiarse de ella.
 *
 * SEPARADO DE LOS COLORES DE INTERFAZ, a propósito. El verde del acento, los
 * grises del texto y los filetes son otra cosa: se pueden cambiar mañana sin
 * tocar el significado de ningún gráfico.
 *
 * REGLAS
 *
 *  1. El color identifica, no valora. Ninguna categoría de violencia es "peor"
 *     que otra a ojos del sistema, y ninguna lleva rojo. En particular la
 *     violencia sexual NO va en rojo: teñirla de alarma sería una lectura
 *     editorial disfrazada de convención cromática.
 *  2. El color nunca va solo. Toda serie lleva etiqueta o leyenda escrita; la
 *     paleta es un apoyo para localizar, no el canal por el que se transmite
 *     la información.
 *  3. Un aumento no es rojo y una disminución no es verde. Más reportes puede
 *     significar más violencia o un colegio donde por fin se denuncia. Los
 *     cambios se leen por la flecha y la cifra, y el color es neutro.
 *  4. Nada de gradientes ni de neón.
 *
 * ACCESIBILIDAD
 * Los siete tonos se separan además en luminosidad, no solo en matiz, para que
 * sigan siendo distinguibles en escala de grises y bajo deuteranopía o
 * protanopía. Las parejas que más se confunden —azul/violeta, verde/teal— no
 * se usan juntas dentro del mismo gráfico.
 */

/** Los siete tonos de dato. `suave` es para áreas y fondos; `fuerte`, para hover. */
export const VIZ = {
  blue: { base: "var(--viz-blue)", suave: "var(--viz-blue-soft)", fuerte: "var(--viz-blue-strong)" },
  teal: { base: "var(--viz-teal)", suave: "var(--viz-teal-soft)", fuerte: "var(--viz-teal-strong)" },
  amber: { base: "var(--viz-amber)", suave: "var(--viz-amber-soft)", fuerte: "var(--viz-amber-strong)" },
  coral: { base: "var(--viz-coral)", suave: "var(--viz-coral-soft)", fuerte: "var(--viz-coral-strong)" },
  violet: { base: "var(--viz-violet)", suave: "var(--viz-violet-soft)", fuerte: "var(--viz-violet-strong)" },
  green: { base: "var(--viz-green)", suave: "var(--viz-green-soft)", fuerte: "var(--viz-green-strong)" },
  slate: { base: "var(--viz-slate)", suave: "var(--viz-slate-soft)", fuerte: "var(--viz-slate-strong)" },
} as const;

export type TonoViz = keyof typeof VIZ;

/**
 * TIPO DE VIOLENCIA — la asignación más importante del archivo.
 *
 * Azul, ámbar y violeta: tres matices muy separados entre sí y con distinta
 * luminosidad, de modo que se distinguen también en gris. Ninguno arrastra
 * connotación de peligro.
 */
export const COLOR_VIOLENCIA: Record<string, TonoViz> = {
  fisica: "blue",
  psicologica: "amber",
  sexual: "violet",
};

/** QUIÉN EJERCE — dos categorías, dos tonos que no se confunden entre sí. */
export const COLOR_ACTOR: Record<string, TonoViz> = {
  entre_escolares: "teal",
  personal_ie: "coral",
};

/**
 * SERIES — cuando una magnitud aparece como línea, barra o eje.
 * Se mantienen estables entre gráficos: reportes siempre azul, tasa siempre
 * teal, número de alumnos siempre ámbar.
 */
export const COLOR_SERIE = {
  reportes: "blue",
  tasa: "teal",
  alumnos: "amber",
} as const satisfies Record<string, TonoViz>;

/** ESTADOS de un elemento dentro de un gráfico. */
export const VIZ_ESTADO = {
  /** Punto o barra en reposo. */
  base: VIZ.blue.base,
  /** Bajo el cursor. */
  hover: VIZ.blue.fuerte,
  /** Elegido por el usuario: cambia de tono para no depender solo del brillo. */
  seleccion: VIZ.coral.base,
  /** Fuera del filtro, pero visible como contexto. */
  atenuado: "var(--viz-mute)",
  /** Referencias: medianas, ejes de apoyo. */
  referencia: "var(--ink-3)",
} as const;

/**
 * ESCALA SECUENCIAL, para una variable continua sin punto central
 * conceptualmente significativo —como el número de alumnos o una tasa—. De
 * claro a oscuro dentro de un solo matiz: se lee como "más" o "menos" sin
 * sugerir un centro ni dos extremos opuestos.
 *
 * No hay escala divergente en el producto. Una divergente necesita un cero
 * con significado y ninguna de nuestras variables lo tiene.
 */
export const ESCALA_SECUENCIAL = [
  "var(--viz-seq-1)",
  "var(--viz-seq-2)",
  "var(--viz-seq-3)",
  "var(--viz-seq-4)",
  "var(--viz-seq-5)",
] as const;

/**
 * Color de un tramo de la distribución.
 *
 * El mapa de calor del ranking NO dice "más violencia": dice dónde cae ese
 * colegio dentro del reparto de reportes registrados del año. Por eso usa una
 * secuencial de un solo matiz —de claro a oscuro, "menos" a "más"— y no una
 * divergente con dos extremos enfrentados, que insinuaría un centro bueno.
 */
export type TramoDistribucion = "corriente" | "p75" | "p90" | "p95" | "p99";

const TRAMO_A_ESCALON: Record<TramoDistribucion, number> = {
  corriente: 0,
  p75: 1,
  p90: 2,
  p95: 3,
  p99: 4,
};

export const colorPorTramo = (t: TramoDistribucion): string =>
  ESCALA_SECUENCIAL[TRAMO_A_ESCALON[t]];

/**
 * Los mismos cinco tonos en hexadecimal.
 *
 * Un `canvas` no resuelve `var(--viz-seq-1)`, así que la imagen que se
 * comparte necesita los valores literales. Tienen que seguir siendo los
 * mismos que los de `:root`: si divergen, la web y la captura dirían cosas
 * distintas con el mismo color.
 */
export const ESCALA_SECUENCIAL_HEX = [
  "#dbe6f2",
  "#a9c3de",
  "#6e97c4",
  "#3f6fa6",
  "#234b78",
] as const;

/**
 * Los siete tonos de dato en hexadecimal, para el `canvas`.
 *
 * Mismo motivo y misma obligación que `ESCALA_SECUENCIAL_HEX`: un canvas no
 * resuelve `var(--viz-blue)`, y estos valores tienen que seguir siendo los
 * de `:root`. Si divergen, la ficha y la imagen que se comparte pintarían la
 * misma categoría de dos colores distintos.
 */
export const VIZ_HEX: Record<TonoViz, string> = {
  blue: "#2a5f9e",
  teal: "#18808a",
  amber: "#b07d14",
  coral: "#c05a3e",
  violet: "#6b4e96",
  green: "#46855a",
  slate: "#63707c",
};

export const colorPorTramoHex = (t: TramoDistribucion): string =>
  ESCALA_SECUENCIAL_HEX[TRAMO_A_ESCALON[t]];

/** Devuelve el color de un tramo de la escala secuencial. */
export function colorSecuencial(valor: number, min: number, max: number): string {
  if (!Number.isFinite(valor) || max <= min) return ESCALA_SECUENCIAL[0];
  const t = Math.min(1, Math.max(0, (valor - min) / (max - min)));
  return ESCALA_SECUENCIAL[Math.min(ESCALA_SECUENCIAL.length - 1, Math.floor(t * ESCALA_SECUENCIAL.length))];
}

/** Paleta ordenada para series sin significado propio asignado. */
export const ORDEN_CATEGORICO: TonoViz[] = [
  "blue",
  "amber",
  "violet",
  "teal",
  "coral",
  "green",
  "slate",
];

export const color = (t: TonoViz) => VIZ[t].base;
export const colorSuave = (t: TonoViz) => VIZ[t].suave;
export const colorFuerte = (t: TonoViz) => VIZ[t].fuerte;

/** Etiquetas visibles. El color nunca viaja solo: esto va siempre con él. */
export const ETIQUETA_VIOLENCIA: Record<string, string> = {
  fisica: "Física",
  psicologica: "Psicológica",
  sexual: "Sexual",
};

export const ETIQUETA_ACTOR: Record<string, string> = {
  entre_escolares: "Entre estudiantes",
  personal_ie: "De un adulto del colegio",
};
