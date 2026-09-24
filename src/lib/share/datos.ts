/**
 * Historias de Instagram de /datos, sobre el material «noche».
 *
 * Son las mismas piezas de la campaña (docs/campanas): la cifra manda, la
 * menta marca la materia y la letra chica dice de dónde sale todo. Usan el
 * formato, el pie y el dominio de `lienzo.ts`, pero con fondo oscuro: la
 * radiografía y el ranking siguen en papel.
 *
 * Instagram tapa unos 250 px arriba y abajo: lo que se tiene que leer vive
 * entre y = 250 y y = 1670.
 */
import { ALTO, ANCHO, DOMINIO, aBlob, familia, lineas, recortar, type Lienzo } from "./lienzo";

const M = 72;
export const NOCHE = "#1a1d21";
export const TINTA = "#f7f8f5";
export const TINTA_2 = "#a7aea8";
export const TINTA_3 = "#8b938d";
export const FILETE = "#3a4047";
export const MENTA = "#57e3ae";
export const GRIS = "#6d756f";
/** Secuencial de un solo matiz, de grafito a menta; y el «sin dato». */
export const RAMPA = ["#2d5a4b", "#3a8a6e", "#48b590", "#57e3ae"];
export const SIN_DATO = "#2a2f35";

const ARRIBA = 250;

export async function crearNoche(): Promise<Lienzo> {
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no dio contexto 2D");
  ctx.fillStyle = NOCHE;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  return {
    canvas,
    ctx,
    sans: familia("--font-sans", "system-ui, sans-serif"),
    mono: familia("--font-mono", "ui-monospace, monospace"),
  };
}

/** Marca y antetítulo en menta. Devuelve la `y` donde puede empezar el titular. */
function cabecera({ ctx, mono }: Lienzo, antetitulo: string): number {
  ctx.fillStyle = MENTA;
  ctx.fillRect(M, ARRIBA, 18, 18);
  ctx.font = `500 23px ${mono}`;
  ctx.letterSpacing = "4px";
  ctx.fillStyle = TINTA;
  ctx.textBaseline = "top";
  ctx.fillText("OBSERVATORIO ESCOLAR", M + 32, ARRIBA - 2);
  ctx.fillStyle = MENTA;
  ctx.font = `500 21px ${mono}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(antetitulo.toUpperCase(), M, ARRIBA + 46);
  ctx.letterSpacing = "0px";
  return ARRIBA + 110;
}

type Parte = [string, string];
export interface LineaTitular {
  partes: Parte[];
  /** Las grandes se ajustan al ancho; las chicas van en letra de texto. */
  grande: boolean;
  tope?: number;
}

/**
 * Titular de tamaños mezclados: las líneas grandes se ajustan al ancho, las
 * chicas unen. Es la misma construcción que las piezas de la campaña.
 */
function titular({ ctx, sans }: Lienzo, filas: LineaTitular[], y: number): number {
  ctx.textBaseline = "alphabetic";
  for (const f of filas) {
    const texto = f.partes.map((p) => p[0]).join("");
    let tam = 40;
    if (f.grande) {
      const tope = f.tope ?? 170;
      for (; tam < tope; tam++) {
        ctx.font = `700 ${tam + 1}px ${sans}`;
        ctx.letterSpacing = `${-(tam + 1) * 0.05}px`;
        if (ctx.measureText(texto).width > ANCHO - 2 * M) break;
      }
    }
    ctx.font = `700 ${tam}px ${sans}`;
    ctx.letterSpacing = f.grande ? `${-tam * 0.05}px` : `${-tam * 0.02}px`;
    y += f.grande ? tam * 0.9 : tam * 1.15;
    let x = M;
    for (const [t, color] of f.partes) {
      ctx.fillStyle = color;
      ctx.fillText(t, x, y);
      x += ctx.measureText(t).width;
    }
    y += f.grande ? tam * 0.14 : tam * 0.2;
  }
  ctx.letterSpacing = "0px";
  return y;
}

function parrafo({ ctx, sans }: Lienzo, texto: string, y: number, tam: number, color: string, peso = 500, max = 6): number {
  ctx.font = `${peso} ${tam}px ${sans}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  for (const l of lineas(ctx, texto, ANCHO - 2 * M, max)) {
    ctx.fillText(l, M, y);
    y += tam * 1.3;
  }
  return y;
}

function leyendaCuadros({ ctx, mono }: Lienzo, items: [string, string, boolean?][], y: number): number {
  ctx.font = `500 19px ${mono}`;
  ctx.letterSpacing = "2px";
  ctx.textBaseline = "middle";
  let x = M;
  for (const [color, texto, contorno] of items) {
    if (contorno) {
      ctx.strokeStyle = TINTA_3;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x, y - 7, 30, 14);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 7, 30, 14);
    }
    ctx.fillStyle = TINTA_2;
    ctx.fillText(texto.toUpperCase(), x + 42, y);
    x += 42 + ctx.measureText(texto.toUpperCase()).width + 40;
  }
  ctx.letterSpacing = "0px";
  return y + 30;
}

/** Cierre fijo: el giro, la procedencia y el dominio, dentro de la zona segura. */
function cierre(l: Lienzo, giro: [string, string] | null, fuente: string): void {
  const { ctx, sans, mono } = l;
  let y = 1520;
  if (giro) {
    ctx.font = `700 34px ${sans}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = TINTA;
    ctx.fillText(giro[0], M, y);
    ctx.fillStyle = MENTA;
    ctx.fillText(giro[1], M, y + 44);
  }
  y = 1622;
  ctx.font = `400 20px ${sans}`;
  ctx.fillStyle = TINTA_3;
  ctx.fillText(recortar(ctx, fuente, ANCHO - 2 * M), M, y);
  ctx.font = `500 19px ${mono}`;
  ctx.letterSpacing = "2px";
  ctx.fillStyle = TINTA_2;
  ctx.fillText(DOMINIO, M, y + 30);
  ctx.letterSpacing = "0px";
}

const dec = (v: number) => v.toFixed(1).replace(".", ",");
const miles = (n: number) => n.toLocaleString("en-US").replace(/,/g, ".");
const GIRO: [string, string] = ["Más reportes no prueba más violencia.", "Prueba que ahí se denuncia más."];

export interface DistritoTasa {
  nombre: string;
  reportes: number;
  alumnos: number;
  tasa: number;
}

export function periodo(anio: string, parcial: boolean): string {
  return parcial ? `enero–agosto ${anio}` : anio;
}

/* ── 1 · Mapa de calor por distrito ───────────────────────────────────── */
export async function dibujarMapaDistritos(p: {
  anio: string;
  parcial: boolean;
  viewBox: [number, number, number, number];
  geometria: { nombre: string; d: string; cx: number; cy: number }[];
  color: (nombre: string) => string;
  maximo: DistritoTasa;
  minimo: DistritoTasa;
  cortes: string[];
}): Promise<Blob> {
  const l = await crearNoche();
  const { ctx, sans, mono } = l;
  let y = cabecera(l, `Reportes por alumno · Lima · ${periodo(p.anio, p.parcial)}`);
  y = titular(l, [
    { partes: [["¿", MENTA], ["QUÉ DISTRITO", TINTA]], grande: true, tope: 150 },
    { partes: [["de Lima registra más reportes de", TINTA]], grande: false },
    { partes: [["VIOLENCIA ESCOLAR", MENTA]], grande: true, tope: 120 },
    { partes: [["por alumno", TINTA], ["?", MENTA]], grande: false },
  ], y);

  // Mapa, a la derecha, bajo el titular.
  const [, , vw, vh] = p.viewBox;
  const alto = 1440 - (y + 30);
  const esc = alto / vh;
  const x0 = ANCHO - M - vw * esc + 20;
  const y0 = y + 30;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(esc, esc);
  for (const g of p.geometria) {
    const camino = new Path2D(g.d);
    ctx.fillStyle = p.color(g.nombre);
    ctx.fill(camino);
    ctx.lineWidth = 2 / esc;
    ctx.strokeStyle = NOCHE;
    ctx.stroke(camino);
  }
  ctx.restore();

  // Llamadas: el máximo grande, el mínimo chico, con su cuenta.
  const punto = (n: string) => {
    const g = p.geometria.find((x) => x.nombre === n);
    return g ? [x0 + g.cx * esc, y0 + g.cy * esc] : null;
  };
  const llamada = (d: DistritoTasa, grande: boolean, ty: number) => {
    const pt = punto(d.nombre);
    const tx = M;
    ctx.textBaseline = "top";
    ctx.font = `500 ${grande ? 22 : 18}px ${mono}`;
    ctx.letterSpacing = "2px";
    ctx.fillStyle = TINTA;
    ctx.fillText(d.nombre.toUpperCase(), tx, ty);
    ctx.letterSpacing = "0px";
    ctx.font = `700 ${grande ? 92 : 50}px ${sans}`;
    ctx.fillStyle = grande ? MENTA : TINTA;
    ctx.fillText(dec(d.tasa), tx, ty + 32);
    ctx.font = `500 ${grande ? 19 : 17}px ${mono}`;
    ctx.fillStyle = TINTA_2;
    const yy = ty + (grande ? 136 : 90);
    ctx.fillText("por cada 1.000 alumnos", tx, yy);
    ctx.fillText(`${miles(d.reportes)} reportes · ${miles(d.alumnos)} alumnos`, tx, yy + 26);
    if (pt) {
      const ancho = ctx.measureText(`${miles(d.reportes)} reportes · ${miles(d.alumnos)} alumnos`).width;
      ctx.strokeStyle = TINTA;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.min(tx + ancho + 12, pt[0] - 10), ty + 14);
      ctx.lineTo(pt[0], pt[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], grande ? 13 : 6, 0, Math.PI * 2);
      if (grande) ctx.stroke();
      else {
        ctx.fillStyle = TINTA;
        ctx.fill();
      }
    }
  };
  llamada(p.maximo, true, y + 170);
  llamada(p.minimo, false, y + 470);

  leyendaCuadros(l, RAMPA.map((c, i) => [c, p.cortes[i]] as [string, string]), 1470);
  cierre(l, GIRO, `Reportes SíseVe ${periodo(p.anio, p.parcial)} · alumnos: Censo Educativo 2024 · 45 distritos`);
  return aBlob(l.canvas);
}

/* ── 2 · Ranking de distritos ─────────────────────────────────────────── */
export async function dibujarRankingDistritos(p: {
  anio: string;
  parcial: boolean;
  filas: DistritoTasa[];
  color: (nombre: string) => string;
}): Promise<Blob> {
  const l = await crearNoche();
  const { ctx, sans, mono } = l;
  let y = cabecera(l, `Ranking · Lima · ${periodo(p.anio, p.parcial)}`);
  y = titular(l, [
    { partes: [["¿", MENTA], ["QUÉ DISTRITO", TINTA]], grande: true, tope: 130 },
    { partes: [["de Lima registra más reportes de", TINTA]], grande: false },
    { partes: [["VIOLENCIA ESCOLAR", MENTA]], grande: true, tope: 110 },
    { partes: [["por alumno", TINTA], ["?", MENTA]], grande: false },
  ], y);

  const por = Math.ceil(p.filas.length / 2);
  const top = y + 26;
  const fila = (1480 - top) / por;
  const col = (ANCHO - 2 * M - 36) / 2;
  const tam = Math.min(24, fila * 0.62);
  ctx.textBaseline = "middle";
  const maximo = p.filas[0]?.tasa ?? 1;
  p.filas.forEach((f, k) => {
    const c = Math.floor(k / por);
    const x = M + c * (col + 36);
    const yy = top + (k % por) * fila + fila / 2;
    ctx.font = `500 ${tam * 0.75}px ${mono}`;
    ctx.fillStyle = TINTA_3;
    ctx.textAlign = "right";
    ctx.fillText(String(k + 1), x + 30, yy);
    ctx.textAlign = "left";
    ctx.font = `600 ${tam}px ${sans}`;
    ctx.fillStyle = TINTA;
    ctx.fillText(recortar(ctx, f.nombre, col - 190), x + 42, yy);
    const bx = x + col - 150;
    ctx.fillStyle = p.color(f.nombre);
    ctx.fillRect(bx, yy - 6, Math.max(4, 90 * (f.tasa / maximo)), 12);
    ctx.font = `700 ${tam}px ${sans}`;
    ctx.fillStyle = k < 3 ? MENTA : TINTA;
    ctx.textAlign = "right";
    ctx.fillText(dec(f.tasa), x + col, yy);
    ctx.textAlign = "left";
  });
  cierre(l, GIRO, `Reportes por cada 1.000 alumnos · SíseVe ${periodo(p.anio, p.parcial)} · alumnos: Censo 2024`);
  return aBlob(l.canvas);
}

/* ── 3 · Concentración ────────────────────────────────────────────────── */
export async function dibujarConcentracion(p: {
  anio: string;
  parcial: boolean;
  filas: { nombre: string; pctReportes: number; pctAlumnos: number }[];
  resto: { n: number; pctReportes: number; pctAlumnos: number };
  top10: { reportes: number; alumnos: number };
  total: number;
}): Promise<Blob> {
  const l = await crearNoche();
  const { ctx, sans, mono } = l;
  let y = cabecera(l, `Reparto de reportes · Lima · ${periodo(p.anio, p.parcial)}`);
  y = titular(l, [
    { partes: [["¿", MENTA], ["SE CONCENTRAN LOS", TINTA]], grande: true, tope: 120 },
    { partes: [["REPORTES DE VIOLENCIA", MENTA]], grande: true, tope: 120 },
    { partes: [["en unos pocos distritos de Lima", TINTA], ["?", MENTA]], grande: false },
  ], y);
  y = parrafo(l, "Casi no: se reparten como los alumnos.", y + 14, 42, MENTA, 700, 2);
  y = parrafo(l, `Los 10 distritos con más reportes suman el ${Math.round(p.top10.reportes)} % de los reportes y el ${Math.round(p.top10.alumnos)} % de los alumnos.`, y + 4, 28, TINTA_2, 500, 3);
  y = leyendaCuadros(l, [[MENTA, "% de los reportes"], [GRIS, "% de los alumnos"]], y + 26);

  const filas = [...p.filas];
  const alto = (1480 - y - 50) / filas.length;
  const escala = 430 / Math.max(...filas.flatMap((f) => [f.pctReportes, f.pctAlumnos]));
  filas.forEach((f, k) => {
    const yy = y + k * alto;
    ctx.textBaseline = "top";
    ctx.font = `600 ${Math.min(26, alto * 0.5)}px ${sans}`;
    ctx.fillStyle = TINTA;
    ctx.fillText(recortar(ctx, f.nombre, 330), M, yy + 2);
    [[f.pctReportes, MENTA], [f.pctAlumnos, GRIS]].forEach(([v, c], j) => {
      const by = yy + j * (alto * 0.36);
      ctx.fillStyle = c as string;
      ctx.fillRect(M + 350, by, Math.max(3, (v as number) * escala), alto * 0.26);
      ctx.font = `500 ${Math.min(18, alto * 0.3)}px ${mono}`;
      ctx.fillStyle = j ? TINTA_3 : TINTA;
      ctx.fillText(`${dec(v as number)} %`, M + 360 + (v as number) * escala, by - 2);
    });
  });
  ctx.font = `500 22px ${sans}`;
  ctx.fillStyle = TINTA_2;
  ctx.fillText(
    `Otros ${p.resto.n} distritos: ${dec(p.resto.pctReportes)} % de los reportes · ${dec(p.resto.pctAlumnos)} % de los alumnos`,
    M,
    1452
  );
  cierre(l, GIRO, `${miles(p.total)} reportes SíseVe · ${periodo(p.anio, p.parcial)} · alumnos: Censo Educativo 2024`);
  return aBlob(l.canvas);
}

/* ── 4 · El silencio según el tamaño ──────────────────────────────────── */
export async function dibujarSilencio(p: {
  anio: string;
  regiones: number;
  tramos: { etiqueta: string; colegios: number; sinReportes: number; esperado: number }[];
}): Promise<Blob> {
  const l = await crearNoche();
  const { ctx, sans, mono } = l;
  const g = p.tramos[p.tramos.length - 1];
  let y = cabecera(l, `Tamaño del colegio · ${p.regiones} regiones · ${p.anio}`);
  y = titular(l, [
    { partes: [[`1 DE CADA ${Math.round(100 / g.sinReportes)}`, MENTA]], grande: true, tope: 170 },
    { partes: [[`colegios con ${g.etiqueta} alumnos`, TINTA]], grande: false },
    { partes: [["NO REGISTRÓ NADA", TINTA]], grande: true, tope: 150 },
  ], y);
  y = parrafo(l, `Ni un reporte de violencia en todo ${p.anio}. Si registraran al ritmo del resto, serían apenas el ${Math.round(g.esperado)} %.`, y + 12, 36, TINTA_2, 600, 3);
  y = leyendaCuadros(l, [[MENTA, "Sin ningún reporte"], [GRIS, "Lo esperable por azar", true]], y + 34);

  const base = 1380;
  const alto = base - y - 80;
  const paso = (ANCHO - 2 * M) / p.tramos.length;
  const ancho = paso * 0.3;
  p.tramos.forEach((t, i) => {
    const cx = M + paso * i + paso / 2;
    [[t.sinReportes, true], [t.esperado, false]].forEach(([v, lleno], j) => {
      const x = cx - ancho - 4 + j * (ancho + 8);
      const h = Math.max(4, (alto * (v as number)) / 100);
      if (lleno) {
        ctx.fillStyle = MENTA;
        ctx.fillRect(x, base - h, ancho, h);
      } else {
        ctx.strokeStyle = TINTA_3;
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x, base - h, ancho, h);
        ctx.setLineDash([]);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = `700 ${j ? 22 : 30}px ${sans}`;
      ctx.fillStyle = j ? TINTA_3 : TINTA;
      ctx.fillText(`${Math.round(v as number)}%`, x + ancho / 2, base - h - 8);
    });
    ctx.textBaseline = "top";
    ctx.font = `600 26px ${sans}`;
    ctx.fillStyle = TINTA_2;
    ctx.fillText(t.etiqueta, cx, base + 16);
    ctx.font = `500 16px ${mono}`;
    ctx.fillStyle = TINTA_3;
    ctx.fillText(`${miles(t.colegios)} colegios`, cx, base + 52);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = FILETE;
  ctx.fillRect(M, base, ANCHO - 2 * M, 2);
  cierre(l, ["Que no haya reportes", "no significa que no haya violencia."], `Colegios con 100 alumnos o más · reportes SíseVe y alumnos ${p.anio}`);
  return aBlob(l.canvas);
}

/* ── 5 · Pensión por tramos ───────────────────────────────────────────── */
export async function dibujarPensionTramos(p: {
  anio: string;
  parcial: boolean;
  /** Año del Censo del que salen los alumnos. */
  anioAlumnos: string;
  tramos: { etiqueta: string; tasa: number; reportes: number; alumnos: number }[];
  publicos: number;
  colegios: number;
}): Promise<Blob> {
  const l = await crearNoche();
  const { ctx, sans, mono } = l;
  let y = cabecera(l, `Pensiones y reportes · Lima · ${periodo(p.anio, p.parcial)}`);
  y = titular(l, [
    { partes: [["¿", MENTA], ["LOS COLEGIOS MÁS CAROS", TINTA]], grande: true, tope: 140 },
    { partes: [["registran más", TINTA]], grande: false },
    { partes: [["REPORTES DE VIOLENCIA?", MENTA]], grande: true, tope: 130 },
  ], y);
  const razon = p.tramos[3].tasa / p.tramos[0].tasa;
  const multiplo: Record<number, string> = { 2: "más del doble", 3: "más del triple", 4: "más del cuádruple" };
  const frase = razon >= 1.5 ? `Sí: ${multiplo[Math.floor(razon)] ?? `${dec(razon)} veces más`} por alumno.` : "No: casi lo mismo por alumno.";
  y = parrafo(l, frase, y + 10, 46, TINTA, 700, 2);

  const base = 1260;
  const alto = base - y - 110;
  const maximo = Math.max(...p.tramos.map((t) => t.tasa));
  const paso = (ANCHO - 2 * M) / 4;
  const barra = paso * 0.62;
  const yp = base - (p.publicos / maximo) * alto;
  ctx.strokeStyle = TINTA_2;
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, yp);
  ctx.lineTo(ANCHO - M, yp);
  ctx.stroke();
  ctx.setLineDash([]);
  p.tramos.forEach((t, i) => {
    const cx = M + paso * i + paso / 2;
    const h = (t.tasa / maximo) * alto;
    ctx.fillStyle = RAMPA[i];
    ctx.fillRect(cx - barra / 2, base - h, barra, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = `700 46px ${sans}`;
    const txt = dec(t.tasa);
    const w = ctx.measureText(txt).width;
    ctx.fillStyle = NOCHE;
    ctx.fillRect(cx - w / 2 - 8, base - h - 60, w + 16, 52);
    ctx.fillStyle = TINTA;
    ctx.fillText(txt, cx, base - h - 10);
    ctx.textBaseline = "top";
    ctx.font = `600 24px ${sans}`;
    ctx.fillStyle = TINTA_2;
    ctx.fillText(t.etiqueta, cx, base + 16);
    ctx.font = `500 15px ${mono}`;
    ctx.fillStyle = TINTA_3;
    // Dos líneas: en una sola, la cuenta de una barra pisaba la de la siguiente.
    ctx.fillText(`${miles(t.reportes)} reportes`, cx, base + 50);
    ctx.fillText(`${miles(t.alumnos)} alumnos`, cx, base + 72);
    ctx.textAlign = "left";
  });
  ctx.font = `500 18px ${mono}`;
  ctx.letterSpacing = "2px";
  ctx.fillStyle = TINTA_2;
  ctx.textBaseline = "top";
  ctx.fillText(`- - -  PÚBLICOS DE LOS MISMOS DISTRITOS: ${dec(p.publicos)}`, M, base + 114);
  ctx.fillStyle = TINTA_3;
  ctx.fillText("REPORTES POR CADA 1.000 ALUMNOS, SEGÚN LA PENSIÓN", M, base + 146);
  ctx.letterSpacing = "0px";
  cierre(l, ["Más reportes no prueba más violencia.", "Donde más se paga, más se denuncia."],
    // Una sola línea de 912 px: con el periodo y el año del Censo, la versión
    // larga se cortaba. «No indica causa» ya lo dice el giro de arriba.
    `${miles(p.colegios)} privados de Lima · pensión: Identicole · SíseVe ${periodo(p.anio, p.parcial)} · alumnos: Censo ${p.anioAlumnos}`);
  return aBlob(l.canvas);
}

/* ── 6 · Qué se reporta según la pensión ──────────────────────────────── */
export async function dibujarPensionComposicion(p: {
  anio: string;
  parcial: boolean;
  filas: { nombre: string; bajo: number; alto: number; claro: boolean }[];
  colegiosAlto: number;
  colegiosBajo: number;
}): Promise<Blob> {
  const l = await crearNoche();
  const { ctx, sans, mono } = l;
  let y = cabecera(l, `Pensiones y reportes · Lima · ${periodo(p.anio, p.parcial)}`);
  y = titular(l, [
    { partes: [["¿", MENTA], ["QUÉ SE REPORTA", TINTA]], grande: true, tope: 150 },
    { partes: [["en los colegios de", TINTA]], grande: false },
    { partes: [["PENSIÓN MÁS ALTA?", MENTA]], grande: true, tope: 140 },
  ], y);
  y = parrafo(l, "Más violencia entre estudiantes. Menos de adultos del colegio.", y + 10, 40, TINTA, 700, 2);
  y = leyendaCuadros(l, [[GRIS, "Menos de S/ 1.000"], [MENTA, "S/ 1.500 o más"]], y + 20);
  const alto = (1480 - y) / p.filas.length;
  p.filas.forEach((f, k) => {
    const yy = y + k * alto;
    ctx.textBaseline = "top";
    ctx.font = `600 28px ${sans}`;
    ctx.fillStyle = f.claro ? TINTA : TINTA_3;
    ctx.fillText(f.nombre, M, yy + 6);
    [[f.bajo, GRIS], [f.alto, MENTA]].forEach(([v, c], j) => {
      const by = yy + j * 26;
      const largo = ((ANCHO - 2 * M - 400) * (v as number)) / 100;
      ctx.fillStyle = c as string;
      ctx.fillRect(M + 330, by, Math.max(3, largo), 18);
      ctx.font = `700 20px ${sans}`;
      ctx.fillStyle = j ? TINTA : TINTA_3;
      ctx.fillText(`${Math.round(v as number)} %`, M + 342 + largo, by - 2);
    });
  });
  cierre(l, ["Más reportes no prueba más violencia.", "En gris: diferencias que pueden ser azar."],
    `${miles(p.colegiosAlto)} colegios de S/ 1.500 o más y ${miles(p.colegiosBajo)} de menos de S/ 1.000 · SíseVe ${periodo(p.anio, p.parcial)}`);
  return aBlob(l.canvas);
}

/**
 * Violencia entre alumnos frente a violencia de un adulto.
 *
 * EL HALLAZGO ES NEGATIVO y por eso el titular no es la nube, es lo que la
 * nube significa: tres de cada cuatro colegios registran un solo tipo. La
 * correlación queda cerca de cero porque los dos fenómenos casi no coinciden
 * en el mismo colegio, no porque la medición falle.
 *
 * CADA CÍRCULO ES UN PAR DE VALORES, NO UN COLEGIO, igual que en pantalla:
 * los conteos son enteros pequeños y miles de colegios comparten posición.
 * El área dice cuántos hay ahí; dibujar un punto por colegio escondería al
 * 97 % debajo del de encima. Recibe los mismos puntos que pinta la web, así
 * que la pieza no puede decir algo distinto.
 */
export async function dibujarCorrelacion(p: {
  anio: string;
  parcial: boolean;
  r: number;
  colegios: number;
  unSoloTipo: number;
  puntos: { x: number; y: number; n: number }[];
}): Promise<Blob> {
  const l = await crearNoche();
  const { ctx, sans, mono } = l;

  let y = cabecera(l, `Quién ejerce la violencia · ${periodo(p.anio, p.parcial)}`);
  y = titular(
    l,
    [
      { partes: [[`${Math.round(p.unSoloTipo)} DE CADA 100`, MENTA]], grande: true, tope: 150 },
      { partes: [["colegios registran", TINTA]], grande: false },
      { partes: [["UN SOLO TIPO", TINTA]], grande: true, tope: 150 },
    ],
    y
  );
  y = parrafo(
    l,
    `O violencia entre alumnos, o de un adulto del colegio: casi nunca las dos. ` +
      `Por eso saber cuánto registra un colegio de una no dice casi nada de la otra.`,
    y + 12,
    34,
    TINTA_2,
    600,
    3
  );

  // ── La nube ────────────────────────────────────────────────────────
  const base = 1440;
  const izq = M + 70;
  const der = ANCHO - M;
  const arriba = y + 54;
  const alto = base - arriba;

  const maxX = Math.max(...p.puntos.map((q) => q.x), 1);
  const maxY = Math.max(...p.puntos.map((q) => q.y), 1);
  const maxN = Math.max(...p.puntos.map((q) => q.n), 1);
  const px = (v: number) => izq + (v / maxX) * (der - izq);
  const py = (v: number) => base - (v / maxY) * alto;

  // Rejilla mínima: dos líneas y sus valores, lo justo para dar escala.
  ctx.textBaseline = "middle";
  ctx.font = `500 18px ${mono}`;
  for (const f of [0.5, 1]) {
    const yy = py(maxY * f);
    ctx.fillStyle = FILETE;
    ctx.fillRect(izq, yy, der - izq, 1);
    ctx.fillStyle = TINTA_3;
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(maxY * f)), izq - 14, yy);
  }
  ctx.textAlign = "left";

  // De mayor a menor: las manchas grandes no tapan a las pequeñas.
  ctx.fillStyle = MENTA;
  ctx.globalAlpha = 0.4;
  for (const q of [...p.puntos].sort((a, b) => b.n - a.n)) {
    // Área proporcional al número de colegios: doblar el radio lo
    // cuadruplicaría y exageraría el peso de ese valor.
    const r = Math.max(3, Math.sqrt(q.n / maxN) * 30);
    ctx.beginPath();
    ctx.arc(px(q.x), py(q.y), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = FILETE;
  ctx.fillRect(izq, base, der - izq, 2);

  ctx.textBaseline = "top";
  ctx.font = `500 20px ${mono}`;
  ctx.fillStyle = TINTA_3;
  ctx.letterSpacing = "2px";
  ctx.fillText("REPORTES ENTRE ALUMNOS →", izq, base + 18);
  ctx.letterSpacing = "0px";

  ctx.save();
  ctx.translate(M + 6, base - alto / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = `500 20px ${mono}`;
  ctx.fillStyle = TINTA_3;
  ctx.letterSpacing = "2px";
  ctx.fillText("DE UN ADULTO →", 0, 0);
  ctx.restore();
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";

  // La correlación, en pequeño: es el respaldo del titular, no el titular.
  ctx.font = `700 30px ${sans}`;
  ctx.fillStyle = MENTA;
  ctx.fillText(`r = ${dec(p.r)}`, izq, base + 54);
  ctx.font = `500 22px ${mono}`;
  ctx.fillStyle = TINTA_3;
  ctx.fillText(`${miles(p.colegios)} COLEGIOS`, izq + 130, base + 60);

  cierre(
    l,
    ["Que un colegio registre una,", "no dice nada de la otra."],
    `Colegios con al menos un reporte · SíseVe ${p.anio}`
  );
  return aBlob(l.canvas);
}
