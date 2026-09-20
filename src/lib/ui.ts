/**
 * Vocabulario visual compartido.
 *
 * Existe para que una tarjeta se vea igual en /datos que en la ficha de un
 * colegio. Antes cada página inventaba su propio borde y su propio padding, y
 * el sitio se leía como cuatro sitios distintos.
 *
 * No es un framework: son las cinco o seis combinaciones que de verdad se
 * repiten. Lo que se usa una sola vez se escribe en su sitio.
 */

/** Contenedor de sección con filete superior. La unidad de ritmo de la página. */
export const seccion = "border-t border-rule py-9 sm:py-11";

/** Tarjeta: superficie elevada sobre el papel. */
export const tarjeta = "rounded-xl border border-rule bg-surface p-5";

/** Tarjeta que además es enlace. */
export const tarjetaEnlace =
  "rounded-xl border border-rule bg-surface p-5 transition-colors hover:border-accent";

/** Título de sección. */
export const tituloSeccion = "font-display text-display-m font-medium text-balance";

/** Bajada bajo el título: la pregunta que responde la sección. */
export const bajada = "mt-2 max-w-prose text-[0.92rem] leading-relaxed text-ink-2";

/** Etiqueta pequeña en versalitas y monoespaciada. */
export const etiqueta =
  "font-mono text-[0.7rem] uppercase tracking-wider text-ink-3";

/** Botón secundario, que es el único que existe por ahora. */
export const boton =
  "inline-flex items-center gap-2 rounded-lg border border-rule bg-surface px-3.5 py-2 text-[0.86rem] text-ink-2 transition-colors hover:border-accent hover:text-accent";

/** Campo de formulario: select y input comparten caja. */
export const campo =
  "w-full rounded-lg border border-rule bg-surface px-3 py-2 text-[0.88rem] text-ink outline-none transition-colors focus:border-accent";

/** Une clases y descarta lo vacío, para no acabar con "  " en el HTML. */
export const cx = (...xs: (string | false | null | undefined)[]): string =>
  xs.filter(Boolean).join(" ");
