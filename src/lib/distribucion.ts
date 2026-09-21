/**
 * Distribución de reportes por colegio — lado servidor.
 *
 * POR QUÉ EXISTE
 * El reparto es muy asimétrico: en el último año completo, la mitad de los
 * colegios que registran algo se queda en dos reportes. Con esa forma, "20
 * reportes" no es un número que se pueda leer solo. Decirlo requiere saber
 * contra qué se compara, y decidir a mano que veinte es "mucho" sería
 * inventar el umbral que los datos ya contienen.
 *
 * Así que aquí no hay cortes escritos a mano. Se calcula la distribución del
 * universo y se pregunta dónde cae el colegio dentro de ella. Si mañana el
 * registro nacional se duplica, los umbrales se mueven solos.
 *
 *   DATOS → DISTRIBUCIÓN → POSICIÓN RELATIVA → SEÑAL
 *
 * EL UNIVERSO, QUE ES LA DECISIÓN IMPORTANTE
 * La distribución se calcula sobre los colegios que registraron AL MENOS UN
 * reporte ese año. Es la opción conservadora: si se incluyeran los que no
 * registraron nada, la mediana caería a cero y cualquier colegio con tres
 * reportes parecería excepcional. También es el mismo universo que ordena el
 * ranking, así que el puesto y el percentil hablan de la misma población.
 *
 * Cada año tiene su propia distribución: no se mezclan. El año en curso tiene
 * la suya y viene marcado como parcial, porque comparar ocho meses con doce
 * exagera cualquier caída.
 *
 * LO QUE ESTE MÓDULO NO DICE
 * Que un valor sea poco frecuente no significa que allí ocurra más violencia.
 * Puede significar que se denuncia más, que el canal se conoce mejor, que hay
 * quien registre, o que varios reportes describen hechos relacionados. El
 * módulo mide frecuencia de registro y nada más; el lenguaje de la interfaz
 * tiene que sostener esa distinción.
 */
import { getAllInstitutions, getMeta } from "@/lib/data/provider";
import type { YearCounts } from "@/lib/types";

/** Ámbito de comparación. La arquitectura admite tres; hoy se usan los que
    los datos sostienen: el país y el departamento tienen tamaño suficiente,
    y la UGEL viene en el propio registro de SíseVe, así que también. */
export type Ambito =
  | { tipo: "pais" }
  | { tipo: "departamento"; valor: string }
  | { tipo: "ugel"; valor: string };

export interface Distribucion {
  anio: string;
  /** Cómo nombrar el universo en pantalla. */
  universo: string;
  /** Colegios con al menos un reporte ese año en ese ámbito. */
  n: number;
  mediana: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  /** El año todavía no ha terminado. */
  parcial: boolean;
}

/**
 * Cuantil por interpolación lineal entre valores contiguos (el método por
 * defecto de numpy y R-7). Sobre una serie discreta y corta, el método sin
 * interpolación salta de golpe y dos universos casi iguales darían cortes
 * muy distintos.
 */
function cuantil(ordenados: number[], q: number): number {
  if (ordenados.length === 0) return 0;
  if (ordenados.length === 1) return ordenados[0];
  const pos = (ordenados.length - 1) * q;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return ordenados[bajo];
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo);
}

const clave = (anio: string, a: Ambito) =>
  a.tipo === "pais" ? `pais|${anio}` : `${a.tipo}:${a.valor}|${anio}`;

let _cache: Map<string, Distribucion | null> | null = null;
let _valores: Map<string, number[]> | null = null;

/** Los conteos del universo, ordenados de menor a mayor. */
function valores(anio: string, a: Ambito): number[] {
  _valores ??= new Map();
  const k = clave(anio, a);
  const ya = _valores.get(k);
  if (ya) return ya;

  const v: number[] = [];
  for (const i of Object.values(getAllInstitutions())) {
    if (a.tipo === "departamento" && i.departamento !== a.valor) continue;
    if (a.tipo === "ugel" && i.ugel !== a.valor) continue;
    const total = Number((i.anios[anio] as YearCounts | undefined)?.total) || 0;
    if (total > 0) v.push(total);
  }
  v.sort((x, y) => x - y);
  _valores.set(k, v);
  return v;
}

export function getDistribucion(anio: string, a: Ambito = { tipo: "pais" }): Distribucion | null {
  _cache ??= new Map();
  const k = clave(anio, a);
  if (_cache.has(k)) return _cache.get(k) ?? null;

  const v = valores(anio, a);
  // Por debajo de una veintena de colegios, un cuantil no describe una
  // distribución: describe a cuatro colegios concretos.
  const d =
    v.length < 20
      ? null
      : {
          anio,
          universo:
            a.tipo === "pais"
              ? "todos los colegios del país"
              : a.tipo === "departamento"
                ? `los colegios de ${a.valor}`
                : `los colegios de la UGEL ${a.valor}`,
          n: v.length,
          mediana: cuantil(v, 0.5),
          p75: cuantil(v, 0.75),
          p90: cuantil(v, 0.9),
          p95: cuantil(v, 0.95),
          p99: cuantil(v, 0.99),
          max: v[v.length - 1],
          parcial: anio === getMeta().anio_parcial,
        };

  _cache.set(k, d);
  return d;
}

/**
 * Percentil de un valor: qué proporción del universo queda estrictamente por
 * debajo. Es el mismo número que tiñe el ranking, así que color y señal
 * hablan de lo mismo.
 */
export function percentilDe(valor: number, anio: string, a: Ambito = { tipo: "pais" }): number | null {
  const v = valores(anio, a);
  if (v.length < 20 || valor <= 0) return null;
  let debajo = 0;
  for (const x of v) {
    if (x < valor) debajo++;
    else break;
  }
  return (debajo / v.length) * 100;
}

/** Dónde cae un valor dentro de su distribución, sin umbrales escritos a mano. */
export type Tramo = "p99" | "p95" | "p90" | "p75" | "corriente";

export function tramoDe(valor: number, d: Distribucion): Tramo {
  if (valor >= d.p99) return "p99";
  if (valor >= d.p95) return "p95";
  if (valor >= d.p90) return "p90";
  if (valor >= d.p75) return "p75";
  return "corriente";
}
