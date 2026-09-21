/**
 * Primitivas del lienzo compartido.
 *
 * Las dos piezas que se comparten —el ranking y la radiografía de un colegio—
 * son distintas por dentro pero tienen el mismo formato, el mismo papel, la
 * misma marca y el mismo pie. Eso vive aquí una sola vez: si mañana cambia el
 * dominio o el filete de menta, cambia en las dos a la vez y no pueden
 * divergir.
 *
 * POR QUÉ NO ES UNA CAPTURA DEL DOM
 * Una captura hereda el ancho de la ventana, el zoom del navegador y la
 * densidad de la pantalla, así que la misma acción da una imagen distinta en
 * cada teléfono. Dibujando sobre un canvas, el resultado es idéntico venga de
 * donde venga: mismas medidas, mismos saltos de línea, mismo peso de letra.
 *
 * LA REGLA QUE LAS GOBIERNA
 * La web explica, la imagen comparte. Aquí no entra la metodología: entra lo
 * imprescindible para que alguien que la recibe sin contexto sepa qué está
 * viendo —qué mide, de qué año, de qué universo y de dónde sale—. Nada más.
 */

/** Stories de Instagram: 1080 × 1920 es el lienzo nativo del formato. */
export const ANCHO = 1080;
export const ALTO = 1920;
/** Margen de seguridad: en Stories, la interfaz come los bordes. */
export const M = 84;

export const PAPEL = "#f4f5f2";
export const TINTA = "#15171a";
export const TINTA_2 = "#4a5157";
export const TINTA_3 = "#7c848a";
export const FILETE = "#d9dbd5";
export const FILETE_2 = "#e2e4df";
export const MENTA = "#57e3ae";
export const ACENTO = "#0a6f55";

export const DOMINIO = "observatorioescolar.netlify.app";

/** Nombre real de la familia que `next/font` generó, leído del documento. */
export function familia(variable: string, respaldo: string): string {
  if (typeof window === "undefined") return respaldo;
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${respaldo}` : respaldo;
}

/** Recorta un texto al ancho disponible, con puntos suspensivos. */
export function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Parte un titular en líneas que quepan, sin cortar palabras. */
export function lineas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
  max: number
): string[] {
  const palabras = texto.split(/\s+/);
  const out: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !actual) {
      actual = prueba;
    } else {
      out.push(actual);
      actual = p;
      if (out.length === max) break;
    }
  }
  if (actual && out.length < max) out.push(actual);
  if (out.length === max) out[max - 1] = recortar(ctx, out[max - 1], ancho);
  return out;
}

export interface Lienzo {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sans: string;
  mono: string;
}

/**
 * Prepara el lienzo: papel, filete de menta y las dos familias resueltas.
 *
 * Espera a `document.fonts.ready` porque, sin eso, el canvas dibuja con la
 * familia de respaldo mientras la web ya muestra la suya, y la imagen sale
 * con otra letra que la página de la que salió.
 */
export async function crearLienzo(): Promise<Lienzo> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no dio contexto 2D");

  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = MENTA;
  ctx.fillRect(0, 0, ANCHO, 10);

  return {
    canvas,
    ctx,
    sans: familia("--font-sans", "system-ui, sans-serif"),
    mono: familia("--font-mono", "ui-monospace, monospace"),
  };
}

/** Cabecera de marca. Devuelve la `y` de la línea base que dibujó. */
export function marca({ ctx, mono }: Lienzo, y: number): number {
  ctx.fillStyle = MENTA;
  ctx.fillRect(M, y - 16, 18, 18);
  ctx.font = `500 25px ${mono}`;
  ctx.fillStyle = TINTA;
  ctx.letterSpacing = "4px";
  ctx.fillText("OBSERVATORIO ESCOLAR", M + 34, y);
  ctx.letterSpacing = "0px";
  return y;
}

/** Versalita de sección, del estilo de las de la web. */
export function rotulo({ ctx, mono }: Lienzo, texto: string, y: number, tono = ACENTO): void {
  ctx.font = `500 23px ${mono}`;
  ctx.fillStyle = tono;
  ctx.letterSpacing = "3px";
  ctx.fillText(texto.toUpperCase(), M, y);
  ctx.letterSpacing = "0px";
}

export function filete({ ctx }: Lienzo, y: number, tono = FILETE): void {
  ctx.fillStyle = tono;
  ctx.fillRect(M, y, ANCHO - M * 2, 2);
}

/**
 * Pie anclado al borde inferior.
 *
 * El dominio se mide primero y la procedencia se recorta a lo que quede: con
 * el texto largo y el tracking abierto, los dos se solapaban en medio.
 * `aviso` es la línea que necesita quien recibe la imagen sin haber pasado
 * por la web, donde esto ya está explicado.
 */
export function pie(l: Lienzo, fuente: string, aviso?: string): void {
  const { ctx, mono, sans } = l;
  const y = ALTO - M - 24;
  filete(l, y - 46);

  ctx.font = `500 22px ${mono}`;
  ctx.letterSpacing = "2px";
  const anchoDominio = ctx.measureText(DOMINIO).width;
  ctx.fillStyle = TINTA_2;
  ctx.fillText(DOMINIO, ANCHO - M - anchoDominio, y);
  ctx.fillStyle = TINTA_3;
  ctx.fillText(recortar(ctx, fuente, ANCHO - M * 2 - anchoDominio - 40), M, y);
  ctx.letterSpacing = "0px";

  if (aviso) {
    ctx.font = `400 23px ${sans}`;
    ctx.fillStyle = TINTA_3;
    ctx.fillText(recortar(ctx, aviso, ANCHO - M * 2), M, y - 66);
  }
}

export function aBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo generar el PNG"))),
      "image/png"
    );
  });
}

/** Nombre de archivo descriptivo y sin caracteres problemáticos. */
export function nombreArchivo(partes: (string | null | undefined)[]): string {
  const limpio = partes
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `observatorio-escolar-${limpio}.png`;
}
