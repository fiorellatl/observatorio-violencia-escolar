/**
 * La pieza que se comparte: 1080 × 1920, dibujada a mano.
 *
 * POR QUÉ NO ES UNA CAPTURA DEL DOM
 * Una captura hereda el ancho de la ventana, el zoom del navegador y la
 * densidad de la pantalla, así que la misma acción da una imagen distinta en
 * cada teléfono. Dibujando sobre un canvas, el resultado es idéntico venga de
 * donde venga: mismas medidas, mismos saltos de línea, mismo peso de letra.
 *
 * LA REGLA QUE LA GOBIERNA
 * La web explica, la imagen comparte. Aquí no entra la metodología: entra lo
 * imprescindible para que alguien que la recibe por WhatsApp, sin contexto,
 * sepa qué está viendo — qué mide, de qué año, de qué universo y de dónde
 * sale. Nada más.
 *
 * El color de cada fila es el MISMO que el del ranking en pantalla, porque
 * sale de la misma escala (`colorPorTramoHex`). Si divergieran, la captura y
 * la web dirían cosas distintas con el mismo color.
 */
import { ESCALA_SECUENCIAL_HEX, colorPorTramoHex, type TramoDistribucion } from "@/lib/viz/colors";

export interface FilaImagen {
  posicion: number;
  nombre: string;
  /** Ya formateado: conteo o tasa, según la métrica que muestre la tabla. */
  valor: string;
  tramo: TramoDistribucion | null;
}

export interface DatosImagen {
  titulo: string;
  anio: string;
  /** "Perú · todos los colegios", o el que definan los filtros. */
  universo: string;
  /** "Reportes registrados" o "Reportes por 1.000 alumnos". */
  metrica: string;
  /** "Puestos 1–20". */
  rango: string;
  filas: FilaImagen[];
  /** Año en curso: se dice, porque no es comparable con uno cerrado. */
  parcial: boolean;
}

const ANCHO = 1080;
const ALTO = 1920;
/** Margen de seguridad: en Stories, la interfaz come los bordes. */
const M = 84;

const PAPEL = "#f4f5f2";
const TINTA = "#15171a";
const TINTA_2 = "#4a5157";
const TINTA_3 = "#7c848a";
const FILETE = "#d9dbd5";
const MENTA = "#57e3ae";
const ACENTO = "#0a6f55";

/** Nombre real de la familia que `next/font` generó, leído del documento. */
function familia(variable: string, respaldo: string): string {
  if (typeof window === "undefined") return respaldo;
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${respaldo}` : respaldo;
}

/** Recorta un texto al ancho disponible, con puntos suspensivos. */
function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Parte un titular en líneas que quepan, sin cortar palabras. */
function lineas(ctx: CanvasRenderingContext2D, texto: string, ancho: number, max: number): string[] {
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

export async function dibujarRanking(d: DatosImagen): Promise<Blob> {
  // Sin esto, el canvas dibuja con la familia de respaldo mientras la web ya
  // muestra Archivo, y la imagen sale con otra letra que la página.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const sans = familia("--font-sans", "system-ui, sans-serif");
  const mono = familia("--font-mono", "ui-monospace, monospace");

  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no dio contexto 2D");

  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Filete superior en menta: la firma de la marca, y uso gráfico del color.
  ctx.fillStyle = MENTA;
  ctx.fillRect(0, 0, ANCHO, 10);

  let y = M + 40;

  // ── Marca ──────────────────────────────────────────────────────────
  ctx.fillStyle = MENTA;
  ctx.fillRect(M, y - 16, 18, 18);
  ctx.font = `500 25px ${mono}`;
  ctx.fillStyle = TINTA;
  ctx.letterSpacing = "4px";
  ctx.fillText("OBSERVATORIO ESCOLAR", M + 34, y);
  ctx.letterSpacing = "0px";

  // ── Métrica ────────────────────────────────────────────────────────
  y += 74;
  ctx.font = `500 24px ${mono}`;
  ctx.fillStyle = ACENTO;
  ctx.letterSpacing = "3px";
  ctx.fillText(d.metrica.toUpperCase(), M, y);
  ctx.letterSpacing = "0px";

  // ── Titular ────────────────────────────────────────────────────────
  y += 30;
  ctx.font = `700 78px ${sans}`;
  ctx.fillStyle = TINTA;
  for (const l of lineas(ctx, d.titulo, ANCHO - M * 2, 3)) {
    y += 82;
    ctx.fillText(l, M, y);
  }

  // ── Año y universo ─────────────────────────────────────────────────
  y += 64;
  ctx.font = `700 132px ${sans}`;
  ctx.fillStyle = ACENTO;
  ctx.fillText(d.anio, M, y + 96);
  const anchoAnio = ctx.measureText(d.anio).width;

  ctx.font = `400 27px ${sans}`;
  ctx.fillStyle = TINTA_2;
  ctx.fillText(d.universo, M + anchoAnio + 28, y + 62);
  ctx.font = `500 22px ${mono}`;
  ctx.fillStyle = TINTA_3;
  ctx.letterSpacing = "2px";
  ctx.fillText(
    (d.parcial ? "AÑO EN CURSO · " : "") + d.rango.toUpperCase(),
    M + anchoAnio + 28,
    y + 98
  );
  ctx.letterSpacing = "0px";

  y += 150;
  ctx.fillStyle = FILETE;
  ctx.fillRect(M, y, ANCHO - M * 2, 2);

  // ── Filas ──────────────────────────────────────────────────────────
  // La altura se reparte entre las que haya: con veinte salen holgadas y con
  // cinco no queda un hueco absurdo debajo.
  const arriba = y + 34;
  const abajo = ALTO - M - 96;
  const alto = Math.min(78, (abajo - arriba) / Math.max(d.filas.length, 1));

  d.filas.forEach((f, i) => {
    const fy = arriba + i * alto;
    const centro = fy + alto / 2;

    // Indicador de reparto: mismo color que la fila en la web.
    if (f.tramo) {
      ctx.fillStyle = colorPorTramoHex(f.tramo);
      ctx.fillRect(M, fy + 8, 7, alto - 16);
    }

    ctx.font = `500 26px ${mono}`;
    ctx.fillStyle = TINTA_3;
    ctx.textBaseline = "middle";
    ctx.fillText(String(f.posicion).padStart(2, "0"), M + 26, centro);

    // El valor se mide primero: el nombre ocupa lo que quede.
    ctx.font = `700 40px ${sans}`;
    const anchoValor = ctx.measureText(f.valor).width;
    ctx.fillStyle = TINTA;
    ctx.fillText(f.valor, ANCHO - M - anchoValor, centro);

    ctx.font = `500 34px ${sans}`;
    ctx.fillStyle = TINTA;
    const disponible = ANCHO - M * 2 - 90 - anchoValor - 36;
    ctx.fillText(recortar(ctx, f.nombre, disponible), M + 90, centro);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e2e4df";
    ctx.fillRect(M + 90, fy + alto - 1, ANCHO - M * 2 - 90, 1);
  });

  // ── Pie ────────────────────────────────────────────────────────────
  const py = ALTO - M - 24;
  ctx.fillStyle = FILETE;
  ctx.fillRect(M, py - 46, ANCHO - M * 2, 2);

  // El dominio se mide primero y la procedencia se recorta a lo que quede:
  // con el texto largo y el tracking abierto, los dos se solapaban en medio.
  ctx.font = `500 22px ${mono}`;
  ctx.letterSpacing = "2px";
  const dominio = "observatorioescolar.netlify.app";
  const anchoDominio = ctx.measureText(dominio).width;
  ctx.fillStyle = TINTA_2;
  ctx.fillText(dominio, ANCHO - M - anchoDominio, py);
  ctx.fillStyle = TINTA_3;
  ctx.fillText(
    recortar(ctx, "FUENTE SÍSEVE", ANCHO - M * 2 - anchoDominio - 40),
    M,
    py
  );
  ctx.letterSpacing = "0px";

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

export { ESCALA_SECUENCIAL_HEX };
