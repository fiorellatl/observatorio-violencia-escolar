import type { Metadata } from "next";

/**
 * La portada que ven LinkedIn, WhatsApp, Facebook y X.
 *
 * POR QUÉ ESTABA ROTO
 * No había `og:image` en ninguna parte y `public/` no contenía una sola
 * imagen. LinkedIn no "fallaba": pedía la portada, no encontraba ninguna y
 * dibujaba la tarjeta de texto que le quedaba. `/rankings` además declaraba
 * `twitter:card = summary_large_image`, que promete una tarjeta con imagen
 * grande y la dejaba vacía, que se ve peor que no pedirla.
 *
 * DOS FORMATOS, DOS TRABAJOS
 *   1200 × 627  portada de enlace. Esto.
 *   1080 × 1920 pieza de historias, que se genera en el navegador al
 *               compartir. Recortarla a 1.91:1 perdería el titular o la
 *               cifra según por dónde corte cada plataforma, así que NO se
 *               reutiliza aquí.
 *
 * LA ARQUITECTURA QUEDA ABIERTA. `og()` acepta una imagen propia, de modo
 * que una ruta puede publicar la suya el día que exista —el ranking del año,
 * la radiografía de un colegio— sin tocar a las demás. Hoy todas usan la
 * institucional, que es la que se sabe que responde en 200 sin depender de
 * nada.
 */

/** Relativa a propósito: `metadataBase` la resuelve a absoluta en el HTML. */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 627,
  alt: "Observatorio Escolar: ¿qué sabemos sobre la violencia en los colegios del Perú?",
} as const;

/**
 * Metadatos sociales de una página.
 *
 * `url` es la ruta canónica; sin ella, al compartir una dirección con
 * parámetros la tarjeta enlazaría a la dirección con parámetros y cada
 * variante contaría como una página distinta.
 */
export function og({
  title,
  description,
  url,
  type = "website",
  image = OG_IMAGE,
}: {
  title: string;
  description: string;
  url: string;
  type?: "website" | "article";
  image?: { url: string; width: number; height: number; alt: string };
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type,
      locale: "es_PE",
      siteName: "Observatorio Escolar",
      title,
      description,
      url,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
