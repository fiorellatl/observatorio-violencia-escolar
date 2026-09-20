/**
 * Vocabulario visual compartido.
 *
 * El cambio de criterio frente a la versión anterior: **la tarjeta dejó de ser
 * el contenedor por defecto**. Una página con doce rectángulos bordeados no
 * tiene jerarquía, tiene doce cosas del mismo peso. Ahora la estructura la
 * llevan el espacio y los filetes, y `panel` queda para lo que de verdad es
 * una unidad separable: un gráfico con su ficha técnica, un bloque de filtros.
 *
 * Lo que se usa una sola vez se escribe en su sitio; esto es solo lo que se
 * repite de verdad.
 */

/** Ancho de lectura de la cáscara. */
export const shell = "mx-auto w-full max-w-shell px-5 sm:px-7";

/** Sección: separada por aire, con filete solo cuando hay que cortar. */
export const seccion = "py-12 sm:py-16";
export const seccionRegla = "border-t border-rule pt-12 sm:pt-16 pb-1";

/** Panel: para una unidad separable de verdad, no para cualquier párrafo. */
export const panel = "rounded-lg border border-rule bg-surface";
export const panelPad = "rounded-lg border border-rule bg-surface p-5 sm:p-6";
export const panelEnlace =
  "block rounded-lg border border-rule bg-surface p-5 transition-colors duration-150 ease-suave hover:border-ink-3 hover:bg-accent-soft/50 sm:p-6";

/** Fila de listado editorial: filete abajo, sin caja. */
export const fila =
  "border-b border-rule-2 transition-colors duration-150 ease-suave hover:bg-accent-soft/60";

/** Titulares. */
export const h2 = "font-display text-display-l font-medium text-balance";
export const h3 = "font-display text-display-m font-medium text-balance";

/** Entradilla bajo un titular. */
export const entradilla =
  "mt-3 max-w-prose text-cuerpo-s leading-relaxed text-ink-2";

/** Versalita de metadato. La clase vive en globals.css. */
export const meta = "meta";

/** Botón: una sola variante secundaria y una de acento. */
export const boton =
  "inline-flex items-center gap-2 rounded border border-rule bg-surface px-3.5 py-2 text-[0.86rem] text-ink-2 transition-colors duration-150 ease-suave hover:border-ink-3 hover:text-ink";
export const botonAcento =
  "inline-flex items-center gap-2 rounded border border-accent bg-accent px-3.5 py-2 text-[0.86rem] font-medium text-paper transition-colors duration-150 ease-suave hover:bg-accent-2 hover:border-accent-2";

/** Campo de formulario. */
export const campo =
  "w-full rounded border border-rule bg-surface px-3 py-2 text-[0.88rem] text-ink outline-none transition-colors duration-150 ease-suave focus:border-accent";

/** Enlace dentro de texto corrido. */
export const enlace =
  "text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent";

/** Une clases y descarta lo vacío. */
export const cx = (...xs: (string | false | null | undefined)[]): string =>
  xs.filter(Boolean).join(" ");
