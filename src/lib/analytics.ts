"use client";

/**
 * Medición: los eventos del producto, en un solo sitio.
 *
 * TODO lo que se envía a Google pasa por aquí. Si el envío viviera repartido
 * por los componentes, la pregunta «¿qué datos estamos mandando fuera?» no
 * tendría una respuesta corta, y en un proyecto sobre violencia contra
 * menores esa pregunta tiene que tener una respuesta corta.
 *
 * QUÉ NO SALE DE AQUÍ
 * Ningún dato personal. Lo que se manda son identificadores PÚBLICOS —el
 * slug de un colegio, su región, un año, el nombre de un filtro— que ya están
 * en la URL de una página indexable. Nada que describa a una persona.
 *
 * EL TÉRMINO DE BÚSQUEDA NO SE ENVÍA, a propósito, y es la decisión menos
 * obvia de este archivo. El evento `search` de GA4 lleva normalmente un
 * `search_term`, pero ese campo es texto libre escrito por un visitante en un
 * sitio sobre violencia escolar: puede contener el nombre de un niño. Se
 * envía cuántos resultados hubo —que es lo que dice si el buscador funciona—
 * y, cuando la persona ELIGE un resultado, el slug del colegio, que es un
 * identificador público. Si algún día se quiere el término, la decisión se
 * cambia aquí y en ningún otro sitio.
 */

export const GA_ID = "G-1SPCSDBZ6Y";

/** Los parámetros que GA4 acepta: nada de objetos anidados. */
type Parametros = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Los nombres de evento, cerrados.
 *
 * Un `string` suelto acabaría produciendo `view_school` y `school_view` en la
 * misma propiedad, y en GA4 eso son dos eventos distintos para siempre.
 */
export type Evento =
  | "search"
  | "view_school"
  | "view_ranking"
  | "filter_ranking"
  | "view_compare"
  | "select_year"
  | "share"
  | "download_radiografia"
  | "download_ranking"
  | "view_map";

/**
 * Envía un evento. No hace nada si gtag no está —bloqueador, sin
 * consentimiento, servidor—, y no rompe la página por ello: la medición es lo
 * primero que debe fallar en silencio.
 */
export function medir(evento: Evento, params: Parametros = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const limpio: Parametros = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") limpio[k] = v;
  }
  window.gtag("event", evento, limpio);
}

/** La vista de página, que se dispara en cada cambio de ruta. */
export function medirPagina(ruta: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: ruta,
    page_location: window.location.origin + ruta,
    page_title: document.title,
  });
}
