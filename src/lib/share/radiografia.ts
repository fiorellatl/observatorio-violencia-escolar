/**
 * La RADIOGRAFÍA de un colegio: 1080 × 1920 para historias.
 *
 * Es una pieza de periodismo de datos, no una captura de la ficha. La ficha
 * tiene cuarenta datos y cuatro gráficos interactivos; aquí caben cinco
 * bloques y hay que elegirlos. El orden es el de la pregunta que alguien se
 * hace al verla pasar en tres segundos: quién es el colegio, dónde está,
 * cuántos reportes se registraron, cómo viene cambiando, qué se registra,
 * quién aparece señalado y contra qué se compara. Lo demás vive en la web, y
 * la web está en el pie.
 *
 * LO QUE LA PIEZA NO DICE. El número de reportes no es una medición de la
 * violencia que ocurre: es el rastro de lo que alguien registró. Por eso la
 * cifra se rotula siempre «reportes registrados», nunca «casos», y el pie
 * lleva el aviso que quien la recibe por fuera de la web no ha leído en
 * ningún otro sitio.
 *
 * LOS BLOQUES VACÍOS NO SE DIBUJAN. Un colegio sin ningún reporte clasificado
 * no debe mostrar «0 %» como si eso fuera un hallazgo; el espacio que libera
 * se lo queda el aire, que aquí es material de composición y no sobra.
 */
import type { CategoriaAnual } from "@/lib/ficha";
import { ESCALA_SECUENCIAL_HEX } from "@/lib/viz/colors";
import {
  ALTO,
  ANCHO,
  ACENTO,
  FILETE_2,
  M,
  PAPEL,
  TINTA,
  TINTA_2,
  TINTA_3,
  aBlob,
  crearLienzo,
  filete,
  lineas,
  marca,
  pie,
  recortar,
  rotulo,
  type Lienzo,
} from "@/lib/share/lienzo";

export interface BarraAnio {
  anio: string;
  valor: number;
  /** Colegios cerrados: la barra se atenúa en vez de desaparecer. */
  pandemia: boolean;
}

export interface DatosRadiografia {
  nombre: string;
  /** "Miraflores · Lima · Lima". */
  lugar: string;
  /** Nivel elegido en la ficha, o null cuando se mira la institución entera. */
  nivel: string | null;
  anio: string;
  /** Reportes registrados en ese año. */
  total: number;
  /** El año todavía no ha terminado. */
  parcial: boolean;
  serie: BarraAnio[];
  tipos: CategoriaAnual[];
  actores: CategoriaAnual[];
  /**
   * Dónde cae dentro del reparto. Null cuando el universo es corto o cuando
   * hay un nivel elegido, porque la mediana es de totales por institución.
   */
  contexto: {
    /** Ya formateada: la interpolación da decimales. */
    mediana: string;
    n: number;
    universo: string;
    /** 0–100. Es el eje de la barra de posición. */
    percentil: number;
    frase: string;
  } | null;
}

const nf = (n: number) => new Intl.NumberFormat("es-PE").format(n);

/** Columnas por año. Devuelve la `y` donde termina el bloque. */
function evolucion(l: Lienzo, serie: BarraAnio[], y: number): number {
  const { ctx, sans, mono } = l;
  rotulo(l, "Evolución", y, TINTA_3);
  y += 46;

  const ancho = ANCHO - M * 2;
  const alto = 146;
  const base = y + alto;
  const max = Math.max(...serie.map((s) => s.valor), 1);
  const paso = ancho / serie.length;
  const grosor = Math.min(86, paso - 24);

  for (const [i, s] of serie.entries()) {
    const cx = M + paso * i + paso / 2;
    // Mínimo de 3 px: un año con pocos reportes tiene que verse como una
    // marca, no confundirse con un año sin ninguno.
    const h = s.valor === 0 ? 0 : Math.max(3, (s.valor / max) * alto);

    ctx.fillStyle = s.pandemia ? "#c8cdd2" : ACENTO;
    ctx.fillRect(cx - grosor / 2, base - h, grosor, h);

    ctx.textAlign = "center";
    ctx.font = `700 30px ${sans}`;
    ctx.fillStyle = TINTA;
    ctx.fillText(nf(s.valor), cx, base - h - 16);

    ctx.font = `500 22px ${mono}`;
    ctx.fillStyle = TINTA_3;
    ctx.fillText(s.anio, cx, base + 34);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = FILETE_2;
  ctx.fillRect(M, base, ancho, 2);

  y = base + 56;
  if (serie.some((s) => s.pandemia)) {
    ctx.font = `400 22px ${sans}`;
    ctx.fillStyle = TINTA_3;
    ctx.fillText("En gris, años con los colegios cerrados", M, y);
    y += 26;
  }
  return y;
}

/**
 * Categorías como barras rotuladas.
 *
 * La barra se mide contra la categoría MÁS ALTA del bloque, no contra el
 * total del año: lo que se compara aquí es una categoría con otra. El
 * porcentaje sobre el total va escrito al lado, que es donde no engaña.
 */
function categorias(l: Lienzo, items: CategoriaAnual[], y: number): number {
  const { ctx, sans } = l;
  const max = Math.max(...items.map((c) => c.valor), 1);
  const pista = ANCHO - M * 2 - 240;

  for (const c of items) {
    ctx.font = `500 30px ${sans}`;
    ctx.fillStyle = TINTA_2;
    ctx.fillText(recortar(ctx, c.label, pista), M, y);

    ctx.textAlign = "right";
    ctx.font = `700 38px ${sans}`;
    ctx.fillStyle = TINTA;
    ctx.fillText(nf(c.valor), ANCHO - M - 96, y);
    ctx.font = `400 25px ${sans}`;
    ctx.fillStyle = TINTA_3;
    ctx.fillText(`${Math.round(c.pct)} %`, ANCHO - M, y);
    ctx.textAlign = "left";

    y += 18;
    ctx.fillStyle = FILETE_2;
    ctx.fillRect(M, y, pista, 10);
    ctx.fillStyle = c.color;
    ctx.fillRect(M, y, Math.max(6, (c.valor / max) * pista), 10);
    y += 52;
  }
  return y;
}

/**
 * Los bloques de la mitad inferior, con su altura declarada.
 *
 * Se miden ANTES de dibujar nada y el aire sobrante se reparte entre ellos.
 * Sin esto, la pieza se construía hacia abajo con huecos fijos y un colegio
 * con nombre largo y las cinco categorías llenas empujaba la última fila
 * encima del pie: literalmente escribía una cosa sobre otra. Ahora el
 * encaje está garantizado por construcción, y cuando sobra sitio —un
 * colegio sin reportes clasificados— el aire se reparte en vez de dejar un
 * vacío al final.
 */
interface Bloque {
  alto: number;
  dibujar: (y: number) => void;
}

const ALTO_ROTULO = 58;
const ALTO_FILA = 70;

export async function dibujarRadiografia(d: DatosRadiografia): Promise<Blob> {
  const l = await crearLienzo();
  const { ctx, sans, mono } = l;

  let y = M + 40;
  marca(l, y);

  // ── Qué es esta pieza ──────────────────────────────────────────────
  y += 78;
  ctx.font = `700 44px ${mono}`;
  ctx.fillStyle = ACENTO;
  ctx.letterSpacing = "7px";
  ctx.fillText("RADIOGRAFÍA", M, y);
  ctx.letterSpacing = "0px";

  // ── Quién ──────────────────────────────────────────────────────────
  y += 26;
  ctx.font = `700 70px ${sans}`;
  ctx.fillStyle = TINTA;
  for (const t of lineas(ctx, d.nombre, ANCHO - M * 2, 3)) {
    y += 76;
    ctx.fillText(t, M, y);
  }

  // ── Dónde ──────────────────────────────────────────────────────────
  y += 46;
  ctx.font = `400 29px ${sans}`;
  ctx.fillStyle = TINTA_2;
  ctx.fillText(recortar(ctx, d.lugar, ANCHO - M * 2), M, y);
  if (d.nivel) {
    y += 38;
    ctx.font = `500 24px ${mono}`;
    ctx.fillStyle = TINTA_3;
    ctx.letterSpacing = "2px";
    ctx.fillText(`SOLO ${d.nivel.toUpperCase()}`, M, y);
    ctx.letterSpacing = "0px";
  }

  // ── Cuántos ────────────────────────────────────────────────────────
  // El elemento más grande de la pieza después del nombre. Es el dato que
  // la radiografía afirma, y va rotulado para que no pueda leerse como otra
  // cosa que reportes registrados en un año concreto.
  y += 52;
  ctx.font = `700 132px ${sans}`;
  ctx.fillStyle = TINTA;
  ctx.fillText(nf(d.total), M, y + 100);
  const anchoCifra = ctx.measureText(nf(d.total)).width;

  ctx.font = `400 31px ${sans}`;
  ctx.fillStyle = TINTA_2;
  ctx.fillText("reportes registrados", M + anchoCifra + 30, y + 62);
  ctx.font = `500 25px ${mono}`;
  ctx.fillStyle = ACENTO;
  ctx.letterSpacing = "2px";
  ctx.fillText(
    d.parcial ? `${d.anio} · AÑO EN CURSO` : `EN ${d.anio}`,
    M + anchoCifra + 30,
    y + 102
  );
  ctx.letterSpacing = "0px";

  y += 168;
  filete(l, y);

  // ── Los bloques de abajo ───────────────────────────────────────────
  const bloques: Bloque[] = [];

  if (d.contexto) {
    const c = d.contexto;
    ctx.font = `500 36px ${sans}`;
    const frase = lineas(ctx, c.frase, ANCHO - M * 2, 2);
    bloques.push({
      alto: 36 + 58 + frase.length * 44 + 10 + 16 + 48,
      dibujar: (y0) => contexto(l, c, frase, y0),
    });
  }
  if (d.serie.length > 1) {
    bloques.push({
      alto: ALTO_ROTULO + 146 + 48 + (d.serie.some((s) => s.pandemia) ? 30 : 0),
      dibujar: (y0) => evolucion(l, d.serie, y0),
    });
  }
  if (d.tipos.length > 0) {
    bloques.push({
      alto: ALTO_ROTULO + d.tipos.length * ALTO_FILA,
      dibujar: (y0) => {
        // El año va en el rótulo: estos dos bloques son del año titular,
        // no del acumulado, y sin decirlo la pieza se lee como un total.
        rotulo(l, `Qué se registra en ${d.anio}`, y0, TINTA_3);
        categorias(l, d.tipos, y0 + ALTO_ROTULO);
      },
    });
  }
  if (d.actores.length > 0) {
    bloques.push({
      alto: ALTO_ROTULO + d.actores.length * ALTO_FILA,
      dibujar: (y0) => {
        rotulo(l, `Presunto agresor en ${d.anio}`, y0, TINTA_3);
        categorias(l, d.actores, y0 + ALTO_ROTULO);
      },
    });
  }

  // El pie está anclado abajo y lleva dos líneas: aquí empieza su zona, y
  // ningún bloque puede entrar en ella.
  const techoPie = ALTO - M - 24 - 96;
  const ocupado = bloques.reduce((a, b) => a + b.alto, 0);
  const hueco = bloques.length > 1 ? (techoPie - y - ocupado) / bloques.length : 0;
  const aire = Math.min(72, Math.max(26, hueco));

  let cursor = y + aire;
  for (const [i, b] of bloques.entries()) {
    b.dibujar(cursor);
    cursor += b.alto;
    if (i < bloques.length - 1) {
      filete(l, cursor - 14, FILETE_2);
      cursor += aire;
    }
  }

  pie(l, "FUENTE SÍSEVE · MINEDU", "Un reporte no es un caso probado.");
  return aBlob(l.canvas);
}

/**
 * El bloque de contexto. Es el protagonista de la pieza junto a la cifra.
 *
 * Orden deliberado: primero la mediana —el número que hace legible al otro—,
 * luego contra quién se compara, luego la frase que traduce la posición, y
 * la barra al final como respaldo visual de lo que la frase ya dijo. Los
 * cuantiles que deciden el tramo no se enseñan: nadie necesita leer «p95»
 * para entender «entre el 5 % que más registra».
 */
function contexto(
  l: Lienzo,
  c: NonNullable<DatosRadiografia["contexto"]>,
  frase: string[],
  y: number
): void {
  const { ctx, sans } = l;

  ctx.font = `700 46px ${sans}`;
  ctx.fillStyle = TINTA;
  ctx.fillText(`Mediana: ${c.mediana} reportes`, M, y);

  y += 36;
  ctx.font = `400 26px ${sans}`;
  ctx.fillStyle = TINTA_3;
  ctx.fillText(recortar(ctx, `entre ${c.universo}`, ANCHO - M * 2), M, y);

  y += 58;
  ctx.font = `500 36px ${sans}`;
  ctx.fillStyle = ACENTO;
  for (const t of frase) {
    ctx.fillText(t, M, y);
    y += 44;
  }

  // La barra repite en imagen lo que la frase acaba de decir: la mediana
  // parte el eje por la mitad y el punto marca dónde cae este colegio.
  y += 10;
  const ancho = ANCHO - M * 2;
  const grad = ctx.createLinearGradient(M, 0, M + ancho, 0);
  ESCALA_SECUENCIAL_HEX.forEach((color, i) => {
    grad.addColorStop(i / (ESCALA_SECUENCIAL_HEX.length - 1), color);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(M, y, ancho, 16);

  ctx.fillStyle = TINTA_3;
  ctx.fillRect(M + ancho / 2 - 1, y - 8, 2, 32);

  const px = M + (Math.min(99, Math.max(1, c.percentil)) / 100) * ancho;
  ctx.beginPath();
  ctx.arc(px, y + 8, 17, 0, Math.PI * 2);
  ctx.fillStyle = PAPEL;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, y + 8, 12, 0, Math.PI * 2);
  ctx.fillStyle = TINTA;
  ctx.fill();

  y += 48;
  ctx.font = `400 22px ${sans}`;
  ctx.fillStyle = TINTA_3;
  ctx.fillText("menos reportes", M, y);
  const der = "más reportes";
  ctx.fillText(der, ANCHO - M - ctx.measureText(der).width, y);
}
