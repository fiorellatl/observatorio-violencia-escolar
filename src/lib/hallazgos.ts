import { getAllInstitutions, getCross, getLimaMapa } from "@/lib/data/provider";

/**
 * Hallazgos derivados para /datos.
 *
 * Solo cálculo, sin interfaz, y solo sobre la capa pública: los mismos
 * servicios que ya usan los gráficos de tamaño y pensión (`cross_2024.json`,
 * servicios con matrícula conocida). Se calcula al construir la página, que
 * es estática, así que no cuesta nada en el navegador.
 */

export interface TramoTamano {
  etiqueta: string;
  colegios: number;
  /** % de colegios sin ningún reporte en el año. */
  sinReportes: number;
  /**
   * % que cabría esperar sin reportes solo por azar, si cada colegio
   * registrara al ritmo promedio de su tramo (Poisson: e^(−tasa × alumnos)).
   */
  esperado: number;
  /** Reportes por cada 1.000 alumnos del tramo: suma sobre suma. */
  tasa: number;
}

const TRAMOS_TAMANO: [number, number, string][] = [
  [100, 300, "100 a 299"],
  [300, 600, "300 a 599"],
  [600, 1000, "600 a 999"],
  [1000, Infinity, "1.000 o más"],
];

/**
 * El silencio según el tamaño del colegio.
 *
 * Por alumno, colegios chicos y grandes registran casi lo mismo. Lo que
 * cambia es cuántos no registran nada, y la comparación honesta no es con
 * cero sino con lo que el azar produciría: en un colegio de 150 alumnos, que
 * no aparezca ningún reporte en un año es lo esperable; en uno de 1.200, no.
 */
export function silencioPorTamano(anio: string): { tramos: TramoTamano[]; regiones: number } {
  const cross = getCross();
  const servicios = new Map<string, { anios: Record<string, { total?: number }> }>();
  const dreDe = new Map<string, string>();
  for (const i of Object.values(getAllInstitutions())) {
    for (const s of i.servicios) {
      servicios.set(s.slug, s);
      dreDe.set(s.slug, i.dre);
    }
  }
  const reportes = (slug: string) => servicios.get(slug)?.anios[anio]?.total ?? 0;

  const tramos = TRAMOS_TAMANO.map(([min, max, etiqueta]) => {
    const g = cross.filter((c) => c.matricula >= min && c.matricula < max);
    const r = g.reduce((a, c) => a + reportes(c.slug), 0);
    const alumnos = g.reduce((a, c) => a + c.matricula, 0);
    const ritmo = r / alumnos;
    return {
      etiqueta,
      colegios: g.length,
      sinReportes: (100 * g.filter((c) => reportes(c.slug) === 0).length) / g.length,
      esperado: (100 * g.reduce((a, c) => a + Math.exp(-ritmo * c.matricula), 0)) / g.length,
      tasa: ritmo * 1000,
    };
  });

  const regiones = new Set(cross.map((c) => dreDe.get(c.slug)).filter(Boolean)).size;
  return { tramos, regiones };
}

type Conteos = Record<string, number | undefined>;

function mapaServicios() {
  const servicios = new Map<string, { anios: Record<string, Conteos>; dre: string }>();
  for (const i of Object.values(getAllInstitutions())) {
    for (const s of i.servicios) {
      servicios.set(s.slug, { anios: s.anios as unknown as Record<string, Conteos>, dre: i.dre });
    }
  }
  return servicios;
}

export interface TramoPension {
  etiqueta: string;
  colegios: number;
  reportes: number;
  alumnos: number;
  tasa: number;
  sinReportes: number;
  /** % de los reportes con un adulto del colegio como presunto agresor. */
  adulto: number;
}

export interface Pensiones {
  /** Privados de Lima Metropolitana del corte, con y sin pensión conocida. */
  privadosLima: number;
  conPension: number;
  cobertura: number;
  tramos: TramoPension[];
  /** Públicos de los mismos distritos: la referencia sin pensión. */
  publicos: TramoPension;
  /** Composición: pensión menor a S/ 1.000 frente a S/ 1.500 o más. */
  composicion: { clave: string; nombre: string; bajo: number; alto: number; claro: boolean }[];
  bajo: { colegios: number; reportes: number };
  alto: { colegios: number; reportes: number };
}

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE").replace(/,/g, ".")}`;

/**
 * Pensión y reportes, por tramos de igual número de colegios.
 *
 * La pensión es una referencia de nivel —cambia poco de un año a otro— y se
 * usa la más reciente que declare el colegio para cualquier año de reportes.
 * La tasa de cada tramo es suma de reportes sobre suma de alumnos.
 *
 * `cobertura` existe porque la pensión solo se conoce para los colegios cuya
 * ficha de Identicole se descargó: si esa lista no cubre casi todos los
 * privados, la comparación no representa a Lima y la página no debe
 * presentarla como si lo hiciera.
 */
export function pensiones(anio: string): Pensiones {
  const cross = getCross();
  const servicios = mapaServicios();
  const lima = cross.filter((c) => servicios.get(c.slug)?.dre === "DRE Lima Metropolitana");
  const privados = lima.filter((c) => c.gestion.startsWith("Priv"));
  const con = privados.filter((c) => (c.pension ?? 0) > 0).sort((a, b) => (a.pension ?? 0) - (b.pension ?? 0));
  const año = (slug: string): Conteos => servicios.get(slug)?.anios[anio] ?? {};

  const resumir = (g: typeof cross, etiqueta: string): TramoPension => {
    const reportes = g.reduce((a, c) => a + (año(c.slug).total ?? 0), 0);
    const alumnos = g.reduce((a, c) => a + c.matricula, 0);
    const adulto = g.reduce((a, c) => a + (año(c.slug).personal_ie ?? 0), 0);
    return {
      etiqueta,
      colegios: g.length,
      reportes,
      alumnos,
      tasa: alumnos ? (reportes / alumnos) * 1000 : 0,
      sinReportes: g.length ? (100 * g.filter((c) => !(año(c.slug).total ?? 0)).length) / g.length : 0,
      adulto: reportes ? (100 * adulto) / reportes : 0,
    };
  };

  const n = con.length;
  const tramos = [0, 1, 2, 3].map((k) => {
    const g = con.slice(Math.floor((k * n) / 4), Math.floor(((k + 1) * n) / 4));
    const min = g[0]?.pension ?? 0;
    const max = g[g.length - 1]?.pension ?? 0;
    const etiqueta = k === 0 ? `hasta ${soles(max)}` : k === 3 ? `más de ${soles(min)}` : `${soles(min)} a ${soles(max)}`;
    return resumir(g, etiqueta);
  });

  const distritos = new Set(con.map((c) => c.distrito));
  const publicos = resumir(lima.filter((c) => c.gestion.startsWith("Púb") && distritos.has(c.distrito)), "Públicos");

  // Composición de lo reportado, en los extremos de pensión.
  const bajo = con.filter((c) => (c.pension ?? 0) < 1000);
  const alto = con.filter((c) => (c.pension ?? 0) >= 1500);
  const suma = (g: typeof cross, k: string) => g.reduce((a, c) => a + (año(c.slug)[k] ?? 0), 0);
  const rb = suma(bajo, "total");
  const ra = suma(alto, "total");
  const composicion = [
    ["entre_escolares", "Entre estudiantes"],
    ["personal_ie", "Un adulto del colegio"],
    ["psicologica", "Psicológica"],
    ["fisica", "Física"],
    ["sexual", "Sexual"],
    ["ciberacoso", "Ciberacoso"],
  ].map(([clave, nombre]) => {
    const pb = rb ? suma(bajo, clave) / rb : 0;
    const pa = ra ? suma(alto, clave) / ra : 0;
    // Prueba de dos proporciones: lo que no la supera no se anuncia.
    const p = (pb * rb + pa * ra) / (rb + ra || 1);
    const z = p > 0 && p < 1 ? Math.abs(pb - pa) / Math.sqrt(p * (1 - p) * (1 / rb + 1 / ra)) : 0;
    return { clave, nombre, bajo: 100 * pb, alto: 100 * pa, claro: z >= 1.96 };
  });

  return {
    privadosLima: privados.length,
    conPension: n,
    cobertura: privados.length ? (100 * n) / privados.length : 0,
    tramos,
    publicos,
    composicion,
    bajo: { colegios: bajo.length, reportes: rb },
    alto: { colegios: alto.length, reportes: ra },
  };
}

/* ── Distritos de Lima Metropolitana ──────────────────────────────────── */

export interface FilaDistrito {
  nombre: string;
  reportes: number;
  alumnos: number;
  /** Null cuando el distrito no alcanza los mínimos para una tasa. */
  tasa: number | null;
  /** Parte de los reportes y de los alumnos de Lima Metropolitana, en %. */
  pctReportes: number;
  pctAlumnos: number;
}

export interface DistritoGeo {
  nombre: string;
  /** Camino SVG en las coordenadas de `viewBox`. */
  d: string;
  cx: number;
  cy: number;
}

export interface DistritosLima {
  viewBox: [number, number, number, number];
  geometria: DistritoGeo[];
  /** Distritos sin geometría en el mapa (hoy, Santa Anita). */
  sinGeometria: string[];
  anios: Record<string, { filas: FilaDistrito[]; total: number }>;
}

/** El padrón escribe algunos nombres sin tilde o de otra manera. */
const NOMBRE_VISIBLE: Record<string, string> = {
  Lima: "Cercado de Lima",
  Lurigancho: "Lurigancho-Chosica",
  Pachacamac: "Pachacámac",
  Lurin: "Lurín",
  "Villa el Salvador": "Villa El Salvador",
  "Jesus Maria": "Jesús María",
  "San Martin de Porres": "San Martín de Porres",
  "Villa Maria del Triunfo": "Villa María del Triunfo",
  Ancon: "Ancón",
  "Santa Maria del Mar": "Santa María del Mar",
};
const clave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace("cercado de lima", "lima").replace("lurigancho-chosica", "lurigancho");

/**
 * Tasa por distrito con las MISMAS reglas que la tasa territorial del
 * proyecto (scripts/build_territorio.py): reportes y alumnos se suman, y hay
 * tasa solo con ≥ 10 instituciones, ≥ 20 reportes y el denominador cubriendo
 * ≥ 75 % de ellas. El denominador es siempre el Censo Educativo 2024, el
 * único publicado: para 2025 y 2026 la tasa lo dice en la página.
 */
export function distritosLima(anios: string[]): DistritosLima {
  const insts = Object.values(getAllInstitutions()).filter((i) => i.dre === "DRE Lima Metropolitana");

  const out: DistritosLima["anios"] = {};
  for (const anio of anios) {
    const agg = new Map<string, { nombre: string; r: number; a: number; n: number; sd: number }>();
    for (const i of insts) {
      const k = clave(i.distrito);
      const v = agg.get(k) ?? { nombre: NOMBRE_VISIBLE[i.distrito] ?? i.distrito, r: 0, a: 0, n: 0, sd: 0 };
      v.n++;
      v.r += i.anios[anio]?.total ?? 0;
      if (i.matricula) v.a += i.matricula;
      else v.sd++;
      agg.set(k, v);
    }
    const R = [...agg.values()].reduce((s, v) => s + v.r, 0);
    const A = [...agg.values()].reduce((s, v) => s + v.a, 0);
    const filas = [...agg.values()].map((v) => {
      const cobertura = (v.n - v.sd) / v.n;
      const ok = v.a > 0 && v.n >= 10 && cobertura >= 0.75 && v.r >= 20;
      return {
        nombre: v.nombre,
        reportes: v.r,
        alumnos: v.a,
        tasa: ok ? (v.r / v.a) * 1000 : null,
        pctReportes: R ? (100 * v.r) / R : 0,
        pctAlumnos: A ? (100 * v.a) / A : 0,
      };
    });
    out[anio] = { filas, total: R };
  }

  // Geometría: los polígonos vienen como anillos de puntos; aquí se
  // convierten en caminos SVG y se les pone el nombre visible.
  const mapa = getLimaMapa();
  const nombrePorClave = new Map(insts.map((i) => [clave(i.distrito), NOMBRE_VISIBLE[i.distrito] ?? i.distrito]));
  const geometria = mapa.distritos.map((dist) => {
    const anillos = dist.p as unknown as [number, number][][];
    const puntos = anillos.flat();
    return {
      nombre: nombrePorClave.get(clave(dist.d)) ?? NOMBRE_VISIBLE[dist.d] ?? dist.d,
      d: anillos.map((a) => `M${a.map(([x, y]) => `${x},${y}`).join("L")}Z`).join(""),
      cx: puntos.reduce((s, p) => s + p[0], 0) / puntos.length,
      cy: puntos.reduce((s, p) => s + p[1], 0) / puntos.length,
    };
  });

  const vb = mapa.viewBox;
  return {
    viewBox: [vb[0], vb[1], vb[2], vb[3]],
    geometria,
    sinGeometria: mapa.sinGeometria ?? [],
    anios: out,
  };
}
