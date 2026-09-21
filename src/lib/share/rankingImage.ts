/**
 * La pieza del ranking: 1080 × 1920, dibujada a mano sobre `lienzo.ts`.
 *
 * El color de cada fila es el MISMO que el del ranking en pantalla, porque
 * sale de la misma escala (`colorPorTramoHex`). Si divergieran, la captura y
 * la web dirían cosas distintas con el mismo color.
 */
import { ESCALA_SECUENCIAL_HEX, colorPorTramoHex, type TramoDistribucion } from "@/lib/viz/colors";
import {
  ALTO,
  ANCHO,
  ACENTO,
  FILETE_2,
  M,
  TINTA,
  TINTA_2,
  TINTA_3,
  aBlob,
  crearLienzo,
  filete,
  lineas,
  marca,
  nombreArchivo,
  pie,
  recortar,
  rotulo,
} from "@/lib/share/lienzo";

export interface FilaImagen {
  posicion: number;
  nombre: string;
  /** Distrito y región. Hay muchos colegios que comparten nombre —cada
      «San Juan» del país— y sin el lugar la fila no identifica a ninguno. */
  lugar: string;
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
  /** Cabecera de la columna de cifras: "Reportes", "Por 1.000 alumnos". */
  etiquetaValor: string;
  filas: FilaImagen[];
  /** Año en curso: se dice, porque no es comparable con uno cerrado. */
  parcial: boolean;
}

export async function dibujarRanking(d: DatosImagen): Promise<Blob> {
  const l = await crearLienzo();
  const { ctx, sans, mono } = l;

  let y = M + 40;
  marca(l, y);

  y += 74;
  rotulo(l, d.metrica, y);

  // ── Titular ────────────────────────────────────────────────────────
  y += 30;
  ctx.font = `700 78px ${sans}`;
  ctx.fillStyle = TINTA;
  for (const t of lineas(ctx, d.titulo, ANCHO - M * 2, 3)) {
    y += 82;
    ctx.fillText(t, M, y);
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
  filete(l, y);

  // ── Cabecera de columnas ───────────────────────────────────────────
  // Sin esto, la columna de la derecha es una cifra sin nombre: quien recibe
  // la imagen suelta no tiene cómo saber qué se está contando.
  y += 40;
  ctx.font = `500 21px ${mono}`;
  ctx.fillStyle = TINTA_3;
  ctx.letterSpacing = "2px";
  ctx.fillText("COLEGIO", M + 90, y);
  const etiqueta = d.etiquetaValor.toUpperCase();
  ctx.fillText(etiqueta, ANCHO - M - ctx.measureText(etiqueta).width, y);
  ctx.letterSpacing = "0px";
  y += 12;
  filete(l, y, FILETE_2);

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

    // Nombre y lugar comparten línea: con veinte filas no cabe una segunda,
    // y el lugar es lo que distingue a dos colegios del mismo nombre. El
    // nombre manda, así que se le reserva el espacio primero y el lugar se
    // queda con lo que sobre —si no sobra nada, no se dibuja.
    const disponible = ANCHO - M * 2 - 90 - anchoValor - 36;
    ctx.font = `500 34px ${sans}`;
    const nombre = recortar(ctx, f.nombre, disponible);
    const anchoNombre = ctx.measureText(nombre).width;
    ctx.fillStyle = TINTA;
    ctx.fillText(nombre, M + 90, centro);

    const sobra = disponible - anchoNombre - 18;
    if (f.lugar && sobra > 90) {
      ctx.font = `400 24px ${sans}`;
      ctx.fillStyle = TINTA_3;
      ctx.fillText(recortar(ctx, f.lugar, sobra), M + 90 + anchoNombre + 18, centro);
    }

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = FILETE_2;
    ctx.fillRect(M + 90, fy + alto - 1, ANCHO - M * 2 - 90, 1);
  });

  pie(l, "FUENTE SÍSEVE");
  return aBlob(l.canvas);
}

export { ESCALA_SECUENCIAL_HEX, nombreArchivo };
