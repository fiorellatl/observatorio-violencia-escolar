/**
 * Señales de un colegio — lado servidor.
 *
 * Sustituye a la señal única que venía de `signals.json`. Aquella respondía
 * "¿cambió el registro más de lo esperable entre dos años?", que es una
 * pregunta buena pero estrecha: el colegio con más reportes del país salía
 * etiquetado como «Registro sostenido», que es cierto y no dice nada.
 *
 * Aquí se calculan todas las señales posibles, se descartan las que no pasan
 * su umbral y se publican las cuatro más relevantes. Dos fichas distintas
 * enseñan señales distintas porque sus datos son distintos, no porque una
 * plantilla rote frases.
 *
 * REGLAS QUE NO SE NEGOCIAN
 *
 *  1. Cada señal sale de un cálculo reproducible sobre la capa pública. No
 *     hay texto interpretativo ni adjetivos sobre el colegio.
 *  2. Toda comparación declara su universo. Un percentil sin universo no
 *     significa nada, y un puesto cambia por completo según con quién se
 *     compare.
 *  3. La escala importa: comparar colegios de tamaños distintos se hace por
 *     tasa, y la tasa solo existe en el año del censo. Donde no la hay, se
 *     compara composición —que es una proporción interna y no depende del
 *     tamaño— y nunca conteos crudos entre colegios.
 *  4. 2020 y 2021 no cuentan para ninguna racha ni récord: los colegios
 *     estuvieron cerrados y la caída mide el acceso al canal, no los hechos.
 *  5. El año en curso no entra en comparaciones con años cerrados.
 *  6. Si un patrón no supera su umbral, no se publica. Una ficha con una sola
 *     señal es un resultado correcto.
 */
import { getAllInstitutions, getAnioPrincipal, getMeta } from "@/lib/data/provider";
import { getDistribucion, tramoDe } from "@/lib/distribucion";
import type { Institution, YearCounts } from "@/lib/types";

export type ClaseInsight = "tendencia" | "posicion" | "ugel" | "cambio" | "composicion";

export interface Insight {
  clase: ClaseInsight;
  /** Versalita de la tarjeta. */
  etiqueta: string;
  /** Titular corto y contundente. */
  titular: string;
  /** Una o dos líneas. Incluye SIEMPRE el universo cuando compara. */
  detalle: string;
  /** Orden de publicación. Mayor manda. */
  peso: number;
  /** Flecha opcional; nunca sustituye al texto. */
  flecha?: "subida" | "bajada" | "vuelve" | "sostiene";
}

/* ── Umbrales ────────────────────────────────────────────────────────────
   Salen de la distribución real: en 2025 la mediana de un colegio con
   reportes es 2 y el percentil 90 son 7. Con umbrales más altos casi ninguna
   ficha tendría señales; con umbrales más bajos, todas tendrían las mismas. */
const MIN_RACHA = 3;          // años consecutivos para hablar de tendencia
const MIN_PERSISTENCIA = 5;   // años con registro dentro de la ventana
const VENTANA_PERSISTENCIA = 6;
const MIN_COMPOSICION = 8;    // reportes del año para repartirlos por tipo
const DOMINANTE = 0.6;        // proporción que hace "la mayoría"
const BRECHA_UGEL = 15;       // puntos porcentuales sobre la UGEL
const MIN_UGEL = 10;          // colegios con reportes para que la UGEL compare
const TOP_NACIONAL = 20;
const TOP_UGEL = 3;
const MIN_CAMBIO = 5;         // reportes de diferencia interanual
const PROPORCION_CAMBIO = 0.5;
const MIN_HISTORIA = 4;       // años comparables para hablar de récord

const TIPOS: { clave: keyof YearCounts; label: string }[] = [
  { clave: "psicologica", label: "violencia psicológica" },
  { clave: "fisica", label: "violencia física" },
  { clave: "sexual", label: "violencia sexual" },
];
const ACTORES: { clave: keyof YearCounts; label: string }[] = [
  { clave: "entre_escolares", label: "violencia entre estudiantes" },
  { clave: "personal_ie", label: "violencia de un adulto del colegio" },
];

const nf = (n: number) => n.toLocaleString("es-PE");

/** Un cuantil interpolado puede no ser entero; no se finge que lo sea. */
const numero = (n: number) =>
  Number.isInteger(n) ? nf(n) : n.toFixed(1).replace(".", ",");

/** Años cerrados y comparables, de menor a mayor. */
function aniosComparables(): string[] {
  const meta = getMeta();
  const pandemia = new Set(meta.anios_pandemia);
  const out: string[] = [];
  for (let a = Number(meta.anio_min); a <= Number(meta.anio_max); a++) {
    const s = String(a);
    if (pandemia.has(s) || s === meta.anio_parcial) continue;
    out.push(s);
  }
  return out;
}

const cuenta = (c: YearCounts | undefined, k: keyof YearCounts = "total"): number =>
  Number(c?.[k]) || 0;

/* ── Índices cacheados ───────────────────────────────────────────────────
   Se calculan una vez por proceso. La ficha se prerrenderiza doce mil veces
   y no puede recorrer las instituciones enteras en cada página. */

type TablaAnio = {
  /** cm -> puesto (1 = más reportes). Solo colegios con al menos un reporte. */
  puesto: Map<string, number>;
  universo: number;
};
let _tablas: Map<string, TablaAnio> | null = null;

function tabla(anio: string): TablaAnio {
  _tablas ??= new Map();
  const cacheada = _tablas.get(anio);
  if (cacheada) return cacheada;

  const lista = Object.values(getAllInstitutions())
    .map((i) => ({ cm: i.cm, v: cuenta(i.anios[anio]), n: i.nombre }))
    .filter((x) => x.v > 0)
    // Mismo desempate que el explorador de rankings: si no, la ficha y la
    // tabla darían puestos distintos para el mismo colegio.
    .sort((a, b) => b.v - a.v || a.n.localeCompare(b.n, "es"));

  const puesto = new Map<string, number>();
  lista.forEach((x, k) => puesto.set(x.cm, k + 1));
  const t = { puesto, universo: lista.length };
  _tablas.set(anio, t);
  return t;
}

type ResumenUgel = {
  /** Colegios de la UGEL con al menos un reporte ese año. */
  conReportes: number;
  total: number;
  /** cm -> puesto dentro de la UGEL. */
  puesto: Map<string, number>;
  /** Reparto por tipo y actor, en proporción del total de la UGEL. */
  parte: Partial<Record<keyof YearCounts, number>>;
};
let _ugeles: Map<string, ResumenUgel> | null = null;

function ugel(nombre: string, anio: string): ResumenUgel | null {
  _ugeles ??= new Map();
  const clave = `${nombre}|${anio}`;
  const cacheada = _ugeles.get(clave);
  if (cacheada) return cacheada;

  const suyos = Object.values(getAllInstitutions()).filter((i) => i.ugel === nombre);
  const conDato = suyos
    .map((i) => ({ cm: i.cm, v: cuenta(i.anios[anio]), n: i.nombre, c: i.anios[anio] }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v || a.n.localeCompare(b.n, "es"));

  if (conDato.length === 0) return null;

  const puesto = new Map<string, number>();
  conDato.forEach((x, k) => puesto.set(x.cm, k + 1));

  const total = conDato.reduce((s, x) => s + x.v, 0);
  const parte: Partial<Record<keyof YearCounts, number>> = {};
  for (const { clave: k } of [...TIPOS, ...ACTORES]) {
    const suma = conDato.reduce((s, x) => s + cuenta(x.c, k), 0);
    parte[k] = total > 0 ? (suma / total) * 100 : 0;
  }

  const r: ResumenUgel = { conReportes: conDato.length, total, puesto, parte };
  _ugeles.set(clave, r);
  return r;
}

/* ── El cálculo ──────────────────────────────────────────────────────── */

export function getInsights(inst: Institution, maximo = 4): Insight[] {
  const meta = getMeta();
  const principal = getAnioPrincipal();
  const comparables = aniosComparables();
  const out: Insight[] = [];

  // Historia del colegio: solo desde su primer año con registro, para no
  // inventar una racha de ceros anteriores a su existencia en los datos.
  const primero = Object.keys(inst.anios).sort()[0];
  const serie = comparables
    .filter((a) => primero == null || a >= primero)
    .map((a) => ({ anio: a, v: cuenta(inst.anios[a]) }));

  const delPrincipal = cuenta(inst.anios[principal]);
  const iPrincipal = serie.findIndex((x) => x.anio === principal);
  const previo = iPrincipal > 0 ? serie[iPrincipal - 1] : null;

  /* ── 1. Tendencias históricas ─────────────────────────────────────── */

  if (iPrincipal >= MIN_RACHA - 1) {
    let sube = 0;
    let baja = 0;
    for (let k = iPrincipal; k > 0; k--) {
      if (serie[k].v > serie[k - 1].v && baja === 0) sube++;
      else break;
    }
    for (let k = iPrincipal; k > 0; k--) {
      if (serie[k].v < serie[k - 1].v && sube === 0) baja++;
      else break;
    }

    if (sube >= MIN_RACHA) {
      out.push({
        clase: "tendencia",
        etiqueta: "Señal histórica",
        titular: `${sube} años seguidos al alza`,
        detalle: `El número de reportes registrados subió cada año desde ${
          serie[iPrincipal - sube].anio
        } hasta ${principal}, de ${nf(serie[iPrincipal - sube].v)} a ${nf(delPrincipal)}.`,
        peso: 100,
        flecha: "subida",
      });
    } else if (baja >= MIN_RACHA) {
      out.push({
        clase: "tendencia",
        etiqueta: "Señal histórica",
        titular: `${baja} años seguidos a la baja`,
        detalle: `El número de reportes registrados bajó cada año desde ${
          serie[iPrincipal - baja].anio
        } hasta ${principal}, de ${nf(serie[iPrincipal - baja].v)} a ${nf(delPrincipal)}.`,
        peso: 96,
        flecha: "bajada",
      });
    }
  }

  // Récord y segundo mejor, solo con historia suficiente.
  const hasta = serie.slice(0, iPrincipal + 1);
  if (hasta.length >= MIN_HISTORIA && delPrincipal > 0) {
    const maxAnterior = Math.max(...hasta.slice(0, -1).map((x) => x.v));
    if (delPrincipal > maxAnterior) {
      out.push({
        clase: "tendencia",
        etiqueta: "Señal histórica",
        titular: `Su año con más reportes`,
        detalle: `${nf(delPrincipal)} reportes en ${principal}: más que en cualquier año desde ${
          hasta[0].anio
        }. El anterior máximo fue ${nf(maxAnterior)}.`,
        peso: 94,
        flecha: "subida",
      });
    } else {
      const ordenados = [...hasta].sort((a, b) => b.v - a.v);
      if (ordenados[1]?.anio === principal && delPrincipal > 0) {
        out.push({
          clase: "tendencia",
          etiqueta: "Señal histórica",
          titular: `Su segundo año con más reportes`,
          detalle: `${nf(delPrincipal)} reportes en ${principal}, solo por debajo de ${nf(
            ordenados[0].v
          )} en ${ordenados[0].anio}. Serie desde ${hasta[0].anio}.`,
          peso: 84,
        });
      }
    }
  }

  // Persistencia: registra casi todos los años de la ventana.
  const ventana = serie.slice(-VENTANA_PERSISTENCIA);
  const conRegistro = ventana.filter((x) => x.v > 0).length;
  if (ventana.length >= VENTANA_PERSISTENCIA && conRegistro >= MIN_PERSISTENCIA) {
    out.push({
      clase: "tendencia",
      etiqueta: "Señal histórica",
      titular: `Registra casi todos los años`,
      detalle: `Tiene reportes en ${conRegistro} de los últimos ${ventana.length} años comparables (${
        ventana[0].anio
      }–${ventana[ventana.length - 1].anio}).`,
      peso: 88,
      flecha: "sostiene",
    });
  }

  /* ── 2. Posición relativa ─────────────────────────────────────────── */

  const t = tabla(principal);
  const pos = t.puesto.get(inst.cm);
  if (pos && t.universo > 0) {
    if (pos <= TOP_NACIONAL) {
      out.push({
        clase: "posicion",
        etiqueta: "Señal relativa",
        titular: `Puesto ${nf(pos)} del país`,
        detalle: `Entre los ${nf(TOP_NACIONAL)} colegios con más reportes registrados en ${principal}, de ${nf(
          t.universo
        )} con al menos uno. Universo: todos los colegios del país.`,
        peso: 92,
      });
    }

    // Frecuencia dentro de la distribución. El corte no está escrito aquí:
    // sale de los cuantiles del propio año, así que se mueve solo si el
    // registro nacional cambia de forma. Mide rareza del REGISTRO, no
    // violencia: un valor alto puede ser un colegio donde se denuncia.
    const d = getDistribucion(principal);
    if (d) {
      const tramo = tramoDe(delPrincipal, d);
      if (tramo === "p99" || tramo === "p95") {
        const cima = tramo === "p99" ? 1 : 5;
        out.push({
          clase: "posicion",
          etiqueta: "Registro poco frecuente",
          titular: `${nf(delPrincipal)} reportes en ${principal}`,
          detalle: `La mitad de los ${nf(d.n)} colegios con al menos un reporte se queda en ${numero(
            d.mediana
          )}. Este entra en el ${cima} % con más registros de ${d.universo}.`,
          peso: 86,
        });
      }
    }

    // Persistencia en el top: cuántos años seguidos lleva dentro.
    let anios = 0;
    for (let k = iPrincipal; k >= 0; k--) {
      const p = tabla(serie[k].anio).puesto.get(inst.cm);
      if (p && p <= TOP_NACIONAL) anios++;
      else break;
    }
    if (anios >= 3) {
      out.push({
        clase: "posicion",
        etiqueta: "Señal histórica",
        titular: `Top ${TOP_NACIONAL} durante ${anios} años`,
        detalle: `Se ha mantenido entre los ${nf(
          TOP_NACIONAL
        )} colegios con más reportes registrados del país desde ${serie[iPrincipal - anios + 1].anio}.`,
        peso: 98,
        flecha: "sostiene",
      });
    }
  }

  /* ── 3. Comparación con su UGEL ───────────────────────────────────── */

  const u = ugel(inst.ugel, principal);
  if (u && u.conReportes >= MIN_UGEL) {
    const posU = u.puesto.get(inst.cm);
    if (posU && posU <= TOP_UGEL) {
      out.push({
        clase: "ugel",
        etiqueta: "Señal de territorio",
        titular: `Puesto ${posU} de su UGEL`,
        detalle: `Por número de reportes registrados en ${principal}, entre los ${nf(
          u.conReportes
        )} colegios de la UGEL ${inst.ugel} con al menos uno.`,
        peso: 72,
      });
    }

    // Composición frente a la UGEL. Es una proporción interna, así que
    // compara colegios de tamaños distintos sin necesitar denominador.
    if (delPrincipal >= MIN_COMPOSICION) {
      for (const { clave, label } of [...TIPOS, ...ACTORES]) {
        const mio = (cuenta(inst.anios[principal], clave) / delPrincipal) * 100;
        const suyo = u.parte[clave] ?? 0;
        if (mio - suyo >= BRECHA_UGEL) {
          out.push({
            clase: "ugel",
            etiqueta: "Señal de territorio",
            titular: `Más peso de ${label}`,
            detalle: `Representa el ${Math.round(mio)} % de sus reportes de ${principal}, frente al ${Math.round(
              suyo
            )} % en el conjunto de la UGEL ${inst.ugel}. Es una proporción, no un número de casos.`,
            peso: 68,
          });
          break; // una sola por ficha: la sección muestra señales, no un informe
        }
      }
    }
  }

  /* ── 4. Cambios recientes ─────────────────────────────────────────── */

  if (previo && delPrincipal > 0) {
    const delta = delPrincipal - previo.v;
    const base = previo.v;
    const proporcion = base > 0 ? Math.abs(delta) / base : Infinity;
    if (Math.abs(delta) >= MIN_CAMBIO && proporcion >= PROPORCION_CAMBIO) {
      const pct = base > 0 ? Math.round((delta / base) * 100) : null;
      out.push({
        clase: "cambio",
        etiqueta: "Cambio reciente",
        titular: `${delta > 0 ? "+" : ""}${nf(delta)} reportes`,
        detalle: `Pasó de ${nf(base)} en ${previo.anio} a ${nf(delPrincipal)} en ${principal}${
          pct != null ? `, un cambio del ${pct > 0 ? "+" : ""}${pct} %` : ""
        }.`,
        peso: 60,
        flecha: delta > 0 ? "subida" : "bajada",
      });
    }
  }

  // Reaparición de un tipo tras años sin registrarlo.
  if (iPrincipal >= 2) {
    for (const { clave, label } of TIPOS) {
      const ahora = cuenta(inst.anios[principal], clave);
      if (ahora < 2) continue;
      let sin = 0;
      for (let k = iPrincipal - 1; k >= 0; k--) {
        if (cuenta(inst.anios[serie[k].anio], clave) === 0) sin++;
        else break;
      }
      if (sin >= 2) {
        out.push({
          clase: "cambio",
          etiqueta: "Cambio reciente",
          titular: `Vuelve a registrar ${label}`,
          detalle: `${nf(ahora)} reportes en ${principal}, tras ${sin} años comparables sin ninguno.`,
          peso: 56,
          flecha: "vuelve",
        });
        break;
      }
    }
  }

  /* ── 5. Composición ───────────────────────────────────────────────── */

  if (delPrincipal >= MIN_COMPOSICION) {
    for (const { clave, label } of [...ACTORES, ...TIPOS]) {
      const v = cuenta(inst.anios[principal], clave);
      const parte = v / delPrincipal;
      if (parte >= DOMINANTE) {
        out.push({
          clase: "composicion",
          etiqueta: "Composición",
          titular: `${Math.round(parte * 100)} % es ${label}`,
          detalle: `${nf(v)} de sus ${nf(
            delPrincipal
          )} reportes de ${principal}. Un mismo reporte puede registrar más de una categoría.`,
          peso: 40,
        });
        break;
      }
    }
  }

  // Se publica lo más relevante, sin repetir clase de más.
  return out.sort((a, b) => b.peso - a.peso).slice(0, maximo);
}
