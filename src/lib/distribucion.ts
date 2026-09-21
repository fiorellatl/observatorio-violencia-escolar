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
  p25: number;
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

const clave = (anio: string, a: Ambito, o: OpcionesUniverso = {}) =>
  (a.tipo === "pais" ? `pais|${anio}` : `${a.tipo}:${a.valor}|${anio}`) +
  `|n:${o.nivel ?? ""}|t:${o.tipo ?? ""}|c:${o.incluirCeros ? 1 : 0}`;

let _cache: Map<string, Distribucion | null> | null = null;
let _valores: Map<string, number[]> | null = null;

/**
 * Opciones del universo. Todo lo que puede cambiar QUIÉN entra en la
 * comparación vive aquí, para que no haya una segunda forma de contar
 * colegios en ninguna otra parte del proyecto.
 */
export interface OpcionesUniverso {
  /** Solo instituciones que ofrecen este nivel. */
  nivel?: string | null;
  /** Distribución de un tipo de reporte, no del total. */
  tipo?: "fisica" | "psicologica" | "sexual" | null;
  /**
   * Incluir a los colegios que no registraron nada ese año.
   *
   * Está implementado porque la pregunta es legítima, pero NO es el modo por
   * defecto y conviene saber por qué. La capa pública contiene las 17.399
   * instituciones que alguna vez aparecieron en SíseVe, no el padrón
   * nacional completo; incluir sus ceros no da «todos los colegios del
   * Perú», da «los colegios que alguna vez registraron algo, contando los
   * años en que no registraron nada». En ese universo la mediana de 2025 es
   * 0, y comparar contra una mediana de cero no da contexto: convierte en
   * excepcional a cualquier colegio con dos reportes.
   */
  incluirCeros?: boolean;
}

/** Los conteos del universo, ordenados de menor a mayor. */
function valores(anio: string, a: Ambito, o: OpcionesUniverso = {}): number[] {
  _valores ??= new Map();
  const k = clave(anio, a, o);
  const ya = _valores.get(k);
  if (ya) return ya;

  const v: number[] = [];
  for (const i of Object.values(getAllInstitutions())) {
    if (a.tipo === "departamento" && i.departamento !== a.valor) continue;
    if (a.tipo === "ugel" && i.ugel !== a.valor) continue;
    // El nivel filtra QUIÉN entra, no qué se cuenta: la unidad de análisis
    // sigue siendo la institución, y mezclar instituciones con servicios
    // dentro del mismo reparto compararía cosas distintas.
    if (o.nivel && !i.niveles.includes(o.nivel)) continue;
    const c = i.anios[anio] as YearCounts | undefined;
    const valor = o.tipo
      ? Number(c?.[o.tipo]) || 0
      : Number(c?.total) || 0;
    if (valor > 0 || o.incluirCeros) v.push(valor);
  }
  v.sort((x, y) => x - y);
  _valores.set(k, v);
  return v;
}

export function getDistribucion(
  anio: string,
  a: Ambito = { tipo: "pais" },
  o: OpcionesUniverso = {}
): Distribucion | null {
  _cache ??= new Map();
  const k = clave(anio, a, o);
  if (_cache.has(k)) return _cache.get(k) ?? null;

  const v = valores(anio, a, o);
  // Por debajo de una veintena de colegios, un cuantil no describe una
  // distribución: describe a cuatro colegios concretos.
  const d =
    v.length < 20
      ? null
      : {
          anio,
          universo: nombreUniverso(anio, a, o),
          n: v.length,
          // El primer cuartil no se enseña nunca: sirve para decidir qué es
          // "cerca de la mediana" con la forma real del reparto en vez de
          // con un margen elegido a mano.
          p25: cuantil(v, 0.25),
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
export function percentilDe(
  valor: number,
  anio: string,
  a: Ambito = { tipo: "pais" },
  o: OpcionesUniverso = {}
): number | null {
  const v = valores(anio, a, o);
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

/**
 * Cómo se nombra el universo en pantalla.
 *
 * Nunca se enseña un percentil sin decir contra quién se calculó: el mismo
 * colegio puede estar en el 5 % superior de su UGEL y en la mitad corriente
 * del país, y las dos frases son ciertas.
 */
function nombreUniverso(anio: string, a: Ambito, o: OpcionesUniverso = {}): string {
  const donde =
    a.tipo === "pais"
      ? "del país"
      : a.tipo === "departamento"
        ? `de ${a.valor}`
        : `de la UGEL ${a.valor}`;
  const nivel = o.nivel ? ` con ${o.nivel.toLowerCase()}` : "";
  const que = o.tipo ? `reportes de violencia ${ETIQUETA_TIPO[o.tipo]}` : "reportes";
  return o.incluirCeros
    ? `colegios ${donde}${nivel} presentes en el registro`
    : `colegios ${donde}${nivel} con al menos un ${que.replace(/^reportes/, "reporte")} en ${anio}`;
}

const ETIQUETA_TIPO = { fisica: "física", psicologica: "psicológica", sexual: "sexual" } as const;

/**
 * EL CONTEXTO DE UN COLEGIO — la función que debe usar todo el producto.
 *
 * Ficha, radiografía, ranking y mapa de calor salen de aquí. Tener el cálculo
 * en un solo sitio es lo que garantiza que el color de una fila, el percentil
 * de la ficha y la frase de la imagen digan lo mismo del mismo colegio.
 *
 * Devuelve `null` cuando el universo es corto: por debajo de una veintena de
 * colegios, un percentil no describe una distribución, describe a cuatro
 * colegios concretos, y enseñarlo sería fabricar precisión.
 */
export interface ContextoDistribucion {
  valor: number;
  n: number;
  mediana: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  /**
   * Qué proporción del universo queda por debajo, repartiendo los empates.
   *
   * Con "estrictamente por debajo" a secas, un colegio con un reporte daba
   * percentil 0 aunque tuviera a 2.765 colegios empatados con él y a 3.370
   * por debajo en el orden: el reparto es tan escalonado que la definición
   * estricta colapsa la mitad inferior a cero. Repartir el empate —la mitad
   * de los iguales cuenta como abajo— es la convención habitual y aquí
   * además es la única que produce un número legible.
   */
  percentil: number;
  /**
   * Puesto dentro del universo, 1 = el que más registra. Null cuando el
   * colegio no forma parte de ese universo, que es el caso de quien no
   * registró nada: no tiene puesto, no es el último.
   */
  rank: number | null;
  tramo: Tramo;
  universo: string;
  anio: string;
  parcial: boolean;
  /**
   * La frase que se enseña, ya redactada.
   *
   * Vive aquí y no en cada componente por una razón que no es de comodidad:
   * es el punto donde se decide qué NO se dice. Describe frecuencia de
   * registro, nunca violencia; no hay "más violento", "peligroso" ni "peor".
   * Si el texto viviera en tres vistas, bastaría que una se despistara.
   */
  frase: string;
}

export function getContexto(
  valor: number,
  anio: string,
  a: Ambito = { tipo: "pais" },
  o: OpcionesUniverso = {}
): ContextoDistribucion | null {
  const d = getDistribucion(anio, a, o);
  if (!d) return null;

  const v = valores(anio, a, o);
  let debajo = 0;
  let encima = 0;
  for (const x of v) {
    if (x < valor) debajo++;
    else if (x > valor) encima++;
  }
  const iguales = v.length - debajo - encima;
  const dentro = valor > 0 || o.incluirCeros;
  const percentil = dentro ? ((debajo + iguales / 2) / v.length) * 100 : 0;

  return {
    valor,
    n: d.n,
    mediana: d.mediana,
    p75: d.p75,
    p90: d.p90,
    p95: d.p95,
    p99: d.p99,
    max: d.max,
    percentil,
    rank: dentro ? encima + 1 : null,
    tramo: tramoDe(valor, d),
    universo: d.universo,
    anio: d.anio,
    parcial: d.parcial,
    frase: fraseDe(valor, d),
  };
}

/**
 * De la posición a una frase en español corriente.
 *
 * Los cortes son los cuantiles del propio reparto, no números elegidos a
 * mano: "cerca de la mediana" significa dentro de la mitad central —entre el
 * primer y el tercer cuartil—, que es lo que los datos llaman corriente ese
 * año. Si el registro nacional cambia, la frase cambia sola.
 *
 * Y no hay alarma para diferencias pequeñas: tres frente a una mediana de dos
 * es la mitad central, y se dice así.
 */
function fraseDe(valor: number, d: Distribucion): string {
  if (valor <= 0) return `Este colegio no registra reportes en ${d.anio}.`;
  if (valor >= d.p99) return "Está entre el 1 % de colegios con más reportes registrados.";
  if (valor >= d.p95) return "Está entre el 5 % de colegios con más reportes registrados.";
  if (valor >= d.p90) return "Está entre el 10 % de colegios con más reportes registrados.";
  if (valor >= d.p75) return "Registra más reportes que la mayoría de los colegios analizados.";
  if (valor >= d.p25) return "Su frecuencia de reportes está cerca de la mediana.";
  return "Registra menos reportes que la mayoría de los colegios analizados.";
}
