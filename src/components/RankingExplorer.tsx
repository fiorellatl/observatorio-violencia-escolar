"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { RankingBuscador } from "@/components/RankingBuscador";
import { ShareImage } from "@/components/ShareImage";
import { dibujarRanking } from "@/lib/share/rankingImage";
import { medir } from "@/lib/analytics";
import { dec, nf, slugify } from "@/lib/format";
import {
  CLAVES_GEO,
  DEPENDIENTES,
  POS_GEO,
  cumpleGeo,
  depurarGeo,
  dicGeo,
  padresDistrito,
  resolverGeo,
  type ClaveGeo,
} from "@/lib/rankingGeo";
import { boton, campo, meta as clsMeta } from "@/lib/ui";
import {
  COLOR_SERIE,
  COLOR_VIOLENCIA,
  color,
  colorPorTramo,
  type TramoDistribucion,
} from "@/lib/viz/colors";
import type { RankingIndex, RankingRow } from "@/lib/types";

/**
 * Explorador de rankings descriptivos.
 *
 * La pregunta "¿qué colegios registraron más reportes?" es legítima, y
 * esconderla no la responde: la deja a merced de quien la conteste peor. Lo
 * que no puede pasar es que la tabla se lea como "colegios más violentos".
 *
 * De eso se ocupan cuatro decisiones:
 *
 *   1. El título nombra la métrica, nunca una cualidad del colegio.
 *   2. Conteo y tasa son dos ordenaciones que jamás se mezclan.
 *   3. La jerarquía de la fila la marcan el nombre y los reportes; la
 *      posición acompaña y la tasa va tercera. "89,3 por 1.000" no le dice
 *      nada a nadie a primera vista, y ponerlo grande solo aparenta rigor.
 *   4. El cambio se cuenta en reportes ("+24 respecto a 2024"), no en puestos:
 *      "subió 1.062 posiciones" es cierto y no significa nada.
 *
 * POR QUÉ ESTÁ COMPUESTO COMO UNA TARJETA
 * Esta página se comparte por captura de pantalla, no por enlace. Una captura
 * recortada de la versión anterior no decía de qué año era, de qué territorio
 * ni de dónde salía. Ahora el ranking vive dentro de una pieza que se
 * autoexplica —marca, titular, año, universo, filas y procedencia— para que
 * el recorte siga siendo cierto fuera de aquí. Los controles quedan fuera de
 * esa pieza: son para operar, no para mirar.
 *
 * Y la URL lleva el estado completo, así que el enlace reconstruye
 * exactamente la misma tabla que se capturó.
 */

type Metrica = "reportes" | "tasa";
type Tipo = "todos" | "fisica" | "psicologica" | "sexual";

const TIPOS: { v: Tipo; label: string; corto: string; pos: number }[] = [
  { v: "todos", label: "Todos", corto: "", pos: 0 },
  { v: "fisica", label: "Físicos", corto: " física", pos: 1 },
  { v: "psicologica", label: "Psicológicos", corto: " psicológica", pos: 2 },
  { v: "sexual", label: "Sexuales", corto: " sexual", pos: 3 },
];

/** Un cuantil interpolado puede no ser entero; no se finge que lo sea. */
const numeroCorto = (n: number) =>
  Number.isInteger(n) ? nf(n) : n.toFixed(1).replace(".", ",");

/** Rótulo y opción «todos» de cada selector territorial. `region` guarda el
    departamento: el parámetro conserva su nombre para no romper enlaces. */
const GEO_LABEL: Record<ClaveGeo, [string, string]> = {
  region: ["Departamento", "Todos los departamentos"],
  ugel: ["UGEL", "Todas las UGEL"],
  provincia: ["Provincia", "Todas las provincias"],
  distrito: ["Distrito", "Todos los distritos"],
};

const POR_PAGINA = 20;
const DESTACADOS = 3;

type Puesto = {
  fila: RankingRow;
  valor: number;
  conteo: number;
  total: number;
  tasa: number | null;
  previo: number;
  /** Conteos efectivos de la fila: de la institución o del nivel filtrado. */
  conteos: Record<string, [number, number, number, number]>;
  alumnos: number;
};

/** Trayectoria mínima del colegio. Sin ejes: es una firma, no un gráfico. */
function Sparkline({
  valores,
  anios,
  activo,
  tono,
}: {
  valores: number[];
  anios: string[];
  activo: string;
  tono: string;
}) {
  const max = Math.max(...valores, 1);
  const w = 88;
  const h = 26;
  const paso = valores.length > 1 ? w / (valores.length - 1) : w;
  const puntos = valores.map((v, i) => [i * paso, h - (v / max) * (h - 4) - 2] as const);
  const d = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const iActivo = anios.indexOf(activo);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      role="img"
      aria-label={`Trayectoria: ${anios.map((a, i) => `${a}, ${valores[i]} reportes`).join("; ")}`}
    >
      {/* Relleno tenue bajo la línea: da cuerpo sin añadir un segundo dato. */}
      <path
        d={`${d} L${w},${h} L0,${h} Z`}
        fill={tono}
        fillOpacity={0.08}
        stroke="none"
      />
      <path d={d} fill="none" stroke={tono} strokeWidth="1.5" strokeLinejoin="round" strokeOpacity={0.55} />
      {puntos.map((p, i) => (
        <circle
          key={anios[i]}
          cx={p[0]}
          cy={p[1]}
          r={i === iActivo ? 3 : 1.5}
          fill={i === iActivo ? tono : "var(--viz-mute)"}
        >
          <title>
            {anios[i]} · {valores[i]} {valores[i] === 1 ? "reporte" : "reportes"}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function RankingExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [idx, setIdx] = useState<RankingIndex | null>(null);
  const [error, setError] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [panel, setPanel] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/data/ranking-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<RankingIndex>;
      })
      .then((d) => vivo && setIdx(d))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);

  const q = useCallback((k: string) => params.get(k) ?? "", [params]);

  const metrica: Metrica = q("metrica") === "tasa" ? "tasa" : "reportes";
  const tipo = (TIPOS.find((t) => t.v === q("tipo"))?.v ?? "todos") as Tipo;
  const verCeros = q("ceros") === "1";
  // Por defecto, el último año COMPLETO. 2026 está en curso y no se compara
  // con años cerrados salvo que el usuario lo pida.
  const anio = q("anio") || idx?.anio_principal || "";
  const posTipo = TIPOS.find((t) => t.v === tipo)!.pos;

  /** Solo hay padrón para un año: fuera de él, no hay tasa. */
  const hayTasa = !!idx && anio === idx.anio_tasa;
  const esParcial = !!idx && anio === idx.anio_parcial;
  const esPrincipal = !!idx && anio === idx.anio_principal;

  /** El color del tipo elegido tiñe la pieza. "Todos" usa el azul de la
      serie "reportes", el mismo de los gráficos de evolución. */
  const tono = tipo === "todos" ? color(COLOR_SERIE.reportes) : color(COLOR_VIOLENCIA[tipo]);

  const poner = useCallback(
    (cambios: Record<string, string>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(cambios)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      // Un cambio territorial limpia solo lo que deja de tener sentido: pasar
      // de Lima a «Todas» conserva la UGEL elegida; pasar a Cusco, no.
      const geoCambiadas = CLAVES_GEO.filter((k) => k in cambios);
      if (geoCambiadas.length && idx) depurarGeo(idx, p, geoCambiadas);

      // `poner` es el paso obligado de TODO cambio de filtro, así que medir
      // aquí cubre los selectores, la métrica, el tipo y el año sin repartir
      // llamadas por media docena de manejadores.
      for (const [k, v] of Object.entries(cambios)) {
        // Buscar no es filtrar, y medirlo como tal inflaría `filter_ranking`
        // con acciones que no reducen el ranking. Va como `search`, sin el
        // texto tecleado: el slug es público, lo que alguien escribió no.
        if (k === "buscado") medir("search", { donde: "rankings", resultados: v ? 1 : 0 });
        else if (k === "anio") medir("select_year", { anio: v || anio, donde: "rankings" });
        else medir("filter_ranking", { filtro: k, valor: v || "(ninguno)" });
      }

      setPagina(0);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, anio, idx]
  );

  // Pedir tasa obliga a ponerse en el único año que la tiene.
  useEffect(() => {
    if (idx && metrica === "tasa" && anio !== idx.anio_tasa) poner({ anio: idx.anio_tasa });
  }, [idx, metrica, anio, poner]);

  /**
   * Filtros que EXISTEN de verdad en los datos.
   *
   * Un valor que no está en el diccionario no filtra nada —`indexOf` da -1—,
   * y antes la pieza lo anunciaba igual: con `?gestion=Privada` (el valor real
   * es "Privado") la tarjeta decía "Lima · Privada" sobre una lista que
   * incluía colegios públicos. En una página hecha para compartirse, eso es
   * una captura que miente. Lo que no se pudo aplicar no se nombra, y se avisa.
   */
  const filtros = useMemo(() => {
    // `out` son los rasgos del colegio; el territorio va en `geo`, que se
    // resuelve a ids porque un nombre de distrito no identifica un distrito.
    const out: { clave: string; valor: string; id: number; pos: number }[] = [];
    const ignorados: string[] = [];
    if (!idx) return { out, ignorados, geo: { filtros: [], ignorados: [], ambiguos: [] } };
    const geo = resolverGeo(idx, q);
    ignorados.push(...geo.ignorados);
    const campos: [string, string[], number][] = [
      ["gestion", idx.dic.g, 5],
      ["nivel", idx.dic.n, 6],
    ];
    for (const [clave, dic, pos] of campos) {
      const v = q(clave);
      if (!v) continue;
      const id = dic.indexOf(v);
      if (id >= 0) out.push({ clave, valor: v, id, pos });
      else ignorados.push(v);
    }
    return { out, ignorados, geo };
  }, [idx, q]);

  const cumpleRasgos = useCallback(
    (f: RankingRow) =>
      filtros.out.every(({ id, pos }) => {
        const v = f[pos];
        return Array.isArray(v) ? v.includes(id) : v === id;
      }),
    [filtros]
  );

  const candidatos = useMemo(() => {
    if (!idx) return [];
    return idx.filas.filter((f) => cumpleGeo(f, filtros.geo.filtros) && cumpleRasgos(f));
  }, [idx, filtros, cumpleRasgos]);

  /**
   * Opciones de cada selector territorial.
   *
   * Las de un filtro salen de los colegios que cumplen todo lo demás MENOS ese
   * filtro y los que dependen de él: con Lima elegida, la UGEL ofrece las de
   * Lima, y con una UGEL elegida el selector de UGEL sigue ofreciendo las
   * otras de la región, para poder cambiar sin pasar por «Todas». Se calcula
   * al cambiar un filtro, no al abrir un selector.
   */
  const opcionesGeo = useMemo(() => {
    const out = {} as Record<ClaveGeo, { valor: string; label: string }[]>;
    if (!idx || !panel) return out;
    const padres = padresDistrito(idx);
    for (const k of CLAVES_GEO) {
      const fuera = new Set<ClaveGeo>([k, ...DEPENDIENTES[k]]);
      const resto = filtros.geo.filtros.filter((f) => !fuera.has(f.clave));
      const pos = POS_GEO[k];
      const vistos = new Set<number>();
      for (const f of idx.filas) {
        if (cumpleGeo(f, resto) && cumpleRasgos(f)) vistos.add(f[pos] as number);
      }
      const dic = dicGeo(idx, k);
      if (k !== "distrito") {
        out[k] = [...vistos]
          .map((i) => dic[i])
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "es"))
          .map((v) => ({ valor: v, label: v }));
        continue;
      }
      // Un distrito se elige por id. El nombre solo se completa con su
      // provincia y región cuando se repite entre las opciones ofrecidas.
      const veces = new Map<string, number>();
      for (const i of vistos) veces.set(dic[i], (veces.get(dic[i]) ?? 0) + 1);
      out[k] = [...vistos]
        .filter((i) => dic[i])
        .map((i) => ({
          valor: String(i),
          label:
            (veces.get(dic[i]) ?? 0) > 1
              ? `${dic[i]} (${idx.dic.p[padres[i][0]]}, ${idx.dic.r[padres[i][1]]})`
              : dic[i],
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es"));
    }
    return out;
  }, [idx, panel, filtros, cumpleRasgos]);

  /** Id del nivel filtrado, o -1. Decide si se leen los conteos de la
      institución o los del servicio de ese nivel. */
  const nivelFiltrado = useMemo(
    () => filtros.out.find((f) => f.clave === "nivel")?.id ?? -1,
    [filtros]
  );

  const anioPrevio = useMemo(() => {
    if (!idx) return null;
    const i = idx.anios.indexOf(anio);
    return i > 0 ? idx.anios[i - 1] : null;
  }, [idx, anio]);

  const { puestos, sinTasa, cerosOcultos, universo } = useMemo(() => {
    const vacio = { puestos: [] as Puesto[], sinTasa: 0, cerosOcultos: 0, universo: { colegios: 0, reportes: 0, conReportes: 0 } };
    if (!idx) return vacio;

    let fuera = 0;
    let ceros = 0;
    let reportesTotal = 0;
    let conReportes = 0;
    const out: Puesto[] = [];

    for (const f of candidatos) {
      // Con un nivel filtrado, la fila habla de ESE servicio: sus reportes y
      // sus alumnos. Mostrar el total institucional bajo el rótulo "Primaria"
      // sería atribuirle a primaria los reportes de secundaria.
      const porNivel = nivelFiltrado >= 0 ? f[9]?.[String(nivelFiltrado)] : undefined;
      const conteos = porNivel ? porNivel[1] : f[8];
      const c = conteos[anio];
      const conteo = c ? c[posTipo] : 0;
      const total = c ? c[0] : 0;
      reportesTotal += total;
      if (total > 0) conReportes++;

      const mat = porNivel ? porNivel[0] : f[7];
      const tasa = hayTasa && mat >= idx.matricula_minima ? (conteo / mat) * 1000 : null;
      const previo = anioPrevio ? (conteos[anioPrevio]?.[posTipo] ?? 0) : 0;

      if (metrica === "tasa") {
        if (tasa === null) {
          fuera++;
          continue;
        }
        if (conteo === 0 && !verCeros) {
          ceros++;
          continue;
        }
        out.push({ fila: f, valor: tasa, conteo, total, tasa, previo, conteos, alumnos: mat });
      } else {
        if (conteo === 0) continue;
        out.push({ fila: f, valor: conteo, conteo, total, tasa, previo, conteos, alumnos: mat });
      }
    }

    out.sort((a, b) => b.valor - a.valor || a.fila[0].localeCompare(b.fila[0], "es"));
    return {
      puestos: out,
      sinTasa: fuera,
      cerosOcultos: ceros,
      universo: { colegios: candidatos.length, reportes: reportesTotal, conReportes },
    };
  }, [idx, candidatos, anio, posTipo, metrica, verCeros, hayTasa, anioPrevio, nivelFiltrado]);

  const total = puestos.length;

  /**
   * El colegio buscado, situado dentro del ranking tal como está.
   *
   * Vive en la URL para que una búsqueda se pueda compartir, y NO es un
   * filtro: no toca `filtros` ni cambia la consulta. Si los filtros vigentes
   * lo dejan fuera, `posicion` es null y la interfaz lo explica en vez de
   * ensanchar la búsqueda por su cuenta.
   */
  const buscado = q("buscado");
  const hallado = useMemo(() => {
    if (!buscado || !idx) return null;
    const i = puestos.findIndex((p) => p.fila[1] === buscado);
    const enIndice = idx.filas.find((f) => f[1] === buscado);
    if (!enIndice) return null;
    return {
      fila: enIndice,
      posicion: i >= 0 ? i + 1 : null,
      pagina: i >= 0 ? Math.floor(i / POR_PAGINA) : null,
      puesto: i >= 0 ? puestos[i] : null,
    };
  }, [buscado, idx, puestos]);

  // Al elegir un colegio la tabla salta a su página: señalarlo en la página
  // 40 sin llevar al lector hasta allí no serviría de nada.
  useEffect(() => {
    if (hallado?.pagina != null) setPagina(hallado.pagina);
  }, [hallado?.pagina]);
  const visibles = puestos.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);


  const paginas = Math.ceil(total / POR_PAGINA);
  const filtrosActivos = filtros.out.length + filtros.geo.filtros.length;

  /**
   * La vista del ranking, ya resuelta.
   *
   * Se mide aquí y no en cada control porque lo que interesa saber es qué
   * ranking acabó viendo la persona, no cuántas veces tocó un desplegable
   * para llegar. El efecto solo dispara cuando el índice ya cargó: antes,
   * `total` sería cero y ensuciaría la medición con vistas vacías.
   */
  useEffect(() => {
    if (!idx) return;
    medir("view_ranking", {
      anio,
      metrica,
      tipo,
      pagina: pagina + 1,
      resultados: total,
      filtros: filtrosActivos,
    });
  }, [idx, anio, metrica, tipo, pagina, total, filtrosActivos]);

  /** Parámetros que definen este universo, tal cual los leerá la ficha. */
  const contexto = (() => {
    const c = new URLSearchParams(params.toString());
    if (!c.get("anio")) c.set("anio", anio);
    c.set("de", "rankings");
    return c.toString();
  })();

  /**
   * Dónde cae un conteo dentro del reparto nacional del año.
   *
   * Se usa el reparto NACIONAL y no el del filtro: así el color significa lo
   * mismo en un ranking de Lima que en uno de Cajamarca, y una captura de
   * cualquiera de los dos se lee con la misma escala. Solo aplica al conteo;
   * la tasa tiene otro universo —los colegios con cien alumnos o más— y
   * teñirla con estos cortes sería mezclar dos repartos.
   */
  const tramoDe = useCallback(
    (v: number): TramoDistribucion | null => {
      const d = idx?.distribucion?.[anio];
      if (!d || metrica === "tasa" || v <= 0) return null;
      if (v >= d.p99) return "p99";
      if (v >= d.p95) return "p95";
      if (v >= d.p90) return "p90";
      if (v >= d.p75) return "p75";
      return "corriente";
    },
    [idx, anio, metrica]
  );

  /** El territorio, dicho en una línea. Es el subtítulo de la pieza. */
  const territorio = (() => {
    const de = (k: string) =>
      [...filtros.out, ...filtros.geo.filtros].find((f) => f.clave === k)?.valor ?? "";
    const t = [de("distrito"), de("provincia"), de("region")].filter(Boolean);
    // Sola, la UGEL es el territorio: «Perú · UGEL Ilo» sugeriría el país.
    const lugar = t.length ? t.join(", ") : de("ugel") || "Perú";
    const rasgos = [t.length ? de("ugel") : "", de("gestion"), de("nivel")].filter(Boolean);
    return rasgos.length ? `${lugar} · ${rasgos.join(" · ")}` : `${lugar} · todos los colegios`;
  })();

  const descargar = () => {
    if (!idx) return;
    const cab = ["posicion", "colegio", "codigo_modular", "distrito", "provincia", "region",
                 "ugel", "gestion", "nivel", "anio", "reportes_del_tipo", "reportes_totales",
                 "num_alumnos", "tasa_por_1000"];
    const filas = puestos.map((p, i) => [
      i + 1, `"${p.fila[0].replace(/"/g, '""')}"`, p.fila[1],
      `"${idx.dic.d[p.fila[2]]}"`, `"${idx.dic.p[p.fila[3]]}"`, `"${idx.dic.r[p.fila[4]]}"`,
      `"${idx.dic.u?.[p.fila[10]] ?? ""}"`,
      `"${idx.dic.g[p.fila[5]]}"`, `"${p.fila[6].map((k) => idx.dic.n[k]).join(" · ")}"`,
      anio, p.conteo, p.total, p.alumnos || "", p.tasa != null ? p.tasa.toFixed(2) : "",
    ]);
    const csv = [cab.join(","), ...filas.map((f) => f.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `observatorio-reportes-${tipo}-${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-6">
        <p className="text-[0.92rem] font-medium text-ink-2">No se pudo cargar el ranking</p>
        <p className="mt-1.5 text-[0.85rem] text-ink-3">Revisa tu conexión y recarga.</p>
      </div>
    );
  }
  if (!idx) return <div className="h-[36rem] animate-pulse rounded-xl border border-rule bg-surface" />;

  const Sel = ({ k, label, pos, dic }: { k: string; label: string; pos: number; dic: string[] }) => {
    const vistos = new Set<number>();
    for (const f of candidatos) {
      const v = f[pos];
      if (Array.isArray(v)) for (const x of v) vistos.add(x);
      else vistos.add(v as number);
    }
    const opts = q(k) ? dic.filter(Boolean) : [...vistos].map((i) => dic[i]).filter(Boolean);
    return (
      <div className="min-w-0">
        <label htmlFor={`r-${k}`} className={`${clsMeta} block`}>
          {label}
        </label>
        <select
          id={`r-${k}`}
          value={q(k)}
          onChange={(e) => poner({ [k]: e.target.value })}
          className={`${campo} mt-1.5`}
        >
          <option value="">Todas</option>
          {[...opts].sort((a, b) => a.localeCompare(b, "es")).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  };

  /**
   * Selector territorial. Una función y no un componente: sus opciones ya
   * vienen calculadas en `opcionesGeo`, y remontarlo en cada render cerraría
   * el desplegable en algunos navegadores móviles.
   */
  const selGeo = (k: ClaveGeo) => {
    const [label, todos] = GEO_LABEL[k];
    const f = filtros.geo.filtros.find((x) => x.clave === k);
    const opts = [...(opcionesGeo[k] ?? [])];
    let valor = "";
    if (f) {
      if (k !== "distrito") valor = f.valor;
      else if (f.ids.size === 1) valor = String([...f.ids][0]);
      else valor = "varios";
      // La elección vigente siempre se ve, aunque la gestión o el nivel la
      // hayan dejado sin colegios: si no, el selector diría «Todos» mintiendo.
      if (valor !== "varios" && !opts.some((o) => o.valor === valor)) {
        opts.unshift({ valor, label: f.valor });
      }
    }
    const elegir = (v: string) => {
      if (k !== "distrito" || !v) return poner({ [k]: v });
      // El distrito arrastra su provincia y su región: son las que lo hacen
      // inequívoco en la URL.
      const i = Number(v);
      const [pr, r] = padresDistrito(idx)[i];
      poner({ distrito: idx.dic.d[i], provincia: idx.dic.p[pr], region: idx.dic.r[r] });
    };
    return (
      <div key={k} className="min-w-0">
        <label htmlFor={`r-${k}`} className={`${clsMeta} block`}>
          {label}
        </label>
        <select
          id={`r-${k}`}
          value={valor}
          onChange={(e) => elegir(e.target.value)}
          className={`${campo} mt-1.5 ${f ? "border-ink-3" : ""}`}
        >
          <option value="">{todos}</option>
          {valor === "varios" && f ? (
            <option value="varios" disabled>
              {f.valor} ({f.ids.size} distritos)
            </option>
          ) : null}
          {opts.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const suf = TIPOS.find((t) => t.v === tipo)!.corto;
  const titulo =
    metrica === "tasa"
      ? `Colegios con mayor tasa de reportes de violencia${suf}`
      : `Colegios con más reportes de violencia${suf} registrados`;

  /**
   * Tope de la página, para el largo del indicador.
   *
   * El color dice el tramo NACIONAL y en la primera página todos comparten
   * tramo: veinte marcas idénticas. El largo sí varía dentro de lo que se
   * está viendo, y entre los dos el indicador informa siempre.
   */
  const tope = Math.max(
    ...visibles.map((x) => (metrica === "tasa" ? (x.tasa ?? 0) : x.conteo)),
    1
  );

  /* ── Una fila del ranking ──────────────────────────────────────────── */
  const Fila = ({ p, posicion, destacado }: { p: Puesto; posicion: number; destacado: boolean }) => {
    const señalado = buscado !== "" && p.fila[1] === buscado;
    const distrito = idx.dic.d[p.fila[2]];
    const provincia = idx.dic.p[p.fila[3]];
    const region = idx.dic.r[p.fila[4]];
    const gestion = idx.dic.g[p.fila[5]];
    const niveles = p.fila[6].map((k) => idx.dic.n[k]).filter(Boolean).join(" · ");
    const delta = p.conteo - p.previo;
    const serie = idx.anios.map((a) => p.conteos[a]?.[posTipo] ?? 0);
    const href = `/colegio/${slugify(p.fila[0], distrito, p.fila[1])}?${contexto}`;

    const tramo = tramoDe(p.conteo);

    return (
      <li
        className={`border-b border-rule-2 last:border-b-0 ${
          // El hallazgo se marca con el acento del producto y un filete
          // lateral, no con un color de alarma: es «este es», no «cuidado».
          señalado ? "-mx-3 rounded border-l-4 border-l-accent bg-accent-soft/50 px-3" : ""
        }`}
      >
        <Link
          href={href}
          className="group flex items-stretch gap-3 py-4 transition-colors duration-150 ease-suave hover:bg-accent-soft/40 sm:gap-5 sm:py-5"
        >
          {/* Indicador de reparto: dónde cae este conteo dentro del año, en la
              escala secuencial, y cuánto pesa dentro de la página. No califica
              al colegio; sitúa el número.

              Deliberadamente secundario: tres píxeles y translúcido. Lo que
              debe leerse primero es el puesto, el nombre y la cifra. */}
          {tramo ? (
            <span
              aria-hidden
              className="w-[3px] shrink-0 self-stretch overflow-hidden rounded-full bg-rule-2"
            >
              <span
                className="block w-full rounded-full"
                style={{
                  height: `${25 + (Math.min(1, (metrica === "tasa" ? (p.tasa ?? 0) : p.conteo) / tope)) * 75}%`,
                  background: colorPorTramo(tramo),
                  opacity: 0.8,
                }}
              />
            </span>
          ) : null}
          {/* Posición: grande en el podio, discreta después. */}
          <span
            aria-hidden
            // Ancho fijo en rem y no en em: el podio y el resto usan tamaños
            // de letra muy distintos, y con `em` los nombres arrancarían en
            // columnas diferentes.
            className={`w-[2.6rem] shrink-0 sm:w-[3.4rem] ${
              destacado
                ? "cifra text-[2.1rem] leading-none sm:text-[2.9rem]"
                : "tabular pt-1.5 pr-2 text-right font-mono text-[0.84rem] text-ink-3"
            }`}
            style={destacado ? { color: tono } : undefined}
          >
            {destacado ? String(posicion).padStart(2, "0") : posicion}
          </span>
          <span className="sr-only">Puesto {posicion}.</span>

          <span className="min-w-0 flex-1">
            <span
              className={`block font-medium leading-snug text-ink group-hover:text-accent ${
                destacado ? "text-[1.15rem] sm:text-[1.4rem]" : "text-[1.02rem]"
              }`}
            >
              {p.fila[0]}
            </span>
            <span className="mt-1 block text-[0.8rem] leading-relaxed text-ink-3">
              {distrito}
              {provincia && provincia !== distrito ? ` · ${provincia}` : ""} · {region}
              <span className="block sm:inline">
                <span aria-hidden className="hidden sm:inline">
                  {" · "}
                </span>
                {niveles ? `${niveles} · ` : ""}
                {gestion}
              </span>
            </span>

            {/* Cifras en móvil: bajo el nombre. */}
            <span className="mt-2.5 flex items-baseline gap-4 sm:hidden">
              <span className="cifra text-[1.6rem]" style={{ color: destacado ? tono : "var(--ink)" }}>
                {metrica === "tasa" && p.tasa != null ? dec(p.tasa, 1) : nf(p.conteo)}
              </span>
              <span className={clsMeta}>{metrica === "tasa" ? "por 1.000" : "reportes"}</span>
              {anioPrevio && delta !== 0 ? (
                <span className="tabular text-[0.8rem] text-ink-3">
                  <span aria-hidden>{delta > 0 ? "↑" : "↓"}</span> {delta > 0 ? "+" : ""}
                  {nf(delta)} vs. {anioPrevio}
                </span>
              ) : null}
            </span>
          </span>

          {/* Cifras en pantalla ancha. */}
          <span className="hidden shrink-0 items-start gap-7 sm:flex">
            <span className="block w-[5.5rem] text-right">
              <span
                className={`cifra block ${destacado ? "text-[2.1rem]" : "text-[1.7rem]"}`}
                style={{ color: destacado ? tono : "var(--ink)" }}
              >
                {metrica === "tasa" && p.tasa != null ? dec(p.tasa, 1) : nf(p.conteo)}
              </span>
              <span className={`${clsMeta} mt-1 block`}>
                {metrica === "tasa" ? "por 1.000" : "reportes"}
              </span>
              {anioPrevio ? (
                <span className="tabular mt-1.5 block text-[0.78rem] text-ink-3">
                  {delta === 0 ? (
                    `igual que ${anioPrevio}`
                  ) : (
                    <>
                      <span aria-hidden>{delta > 0 ? "↑" : "↓"}</span> {delta > 0 ? "+" : ""}
                      {nf(delta)} vs. {anioPrevio}
                    </>
                  )}
                </span>
              ) : null}
            </span>

            <span className="hidden w-[4rem] text-right lg:block">
              <span className="tabular block text-[1.02rem] text-ink-2">
                {p.alumnos ? nf(p.alumnos) : "—"}
              </span>
              <span className={`${clsMeta} mt-1 block`}># alumnos</span>
            </span>

            <span className="hidden w-[5.5rem] shrink-0 pt-0.5 lg:block">
              <Sparkline valores={serie} anios={idx.anios} activo={anio} tono={tono} />
              <span className={`${clsMeta} mt-1 block`}>
                {idx.anios[0]}–{idx.anios[idx.anios.length - 1]}
              </span>
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div>
      {/* ══ CONTROLES ═══════════════════════════════════════════════════
          Fuera de la pieza compartible a propósito: operan el ranking, no
          forman parte de lo que se cuenta. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="r-anio" className="sr-only">
            Año
          </label>
          <select
            id="r-anio"
            value={anio}
            disabled={metrica === "tasa"}
            onChange={(e) => poner({ anio: e.target.value })}
            className="cifra min-h-11 rounded border border-rule bg-surface px-3 text-[1.1rem] text-ink outline-none transition-colors duration-150 ease-suave hover:border-ink-3 focus:border-accent disabled:opacity-60 sm:min-h-0 sm:py-1.5"
          >
            {[...idx.anios].reverse().map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label="Métrica"
            className="flex overflow-hidden rounded border border-rule"
          >
            {(
              [
                ["reportes", "Reportes"],
                ["tasa", "Tasa"],
              ] as [Metrica, string][]
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                aria-pressed={metrica === v}
                onClick={() => poner({ metrica: v === "reportes" ? "" : v })}
                className={`min-h-11 px-3.5 text-[0.84rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:px-3 sm:py-2 ${
                  metrica === v
                    ? "bg-surface font-medium text-ink"
                    : "text-ink-3 hover:bg-surface hover:text-ink-2"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setPanel((x) => !x)}
            aria-expanded={panel}
            aria-controls="panel-filtros"
            className={`${boton} ${filtrosActivos ? "border-ink-3 text-ink" : ""}`}
          >
            Filtros
            {filtrosActivos ? (
              <span
                className="tabular rounded-full px-1.5 text-[0.72rem] font-medium text-paper"
                style={{ background: tono }}
              >
                {filtrosActivos}
              </span>
            ) : null}
          </button>
          <ShareImage
            titulo="Compartir este ranking"
            microcopy="Pieza para historias"
            eventoDescarga="download_ranking"
            contexto={{ anio, metrica, tipo, pagina: pagina + 1 }}
            dibujar={() =>
              dibujarRanking({
                titulo,
                anio,
                universo: territorio,
                metrica: metrica === "tasa" ? "Reportes por 1.000 alumnos" : "Reportes registrados",
                etiquetaValor: metrica === "tasa" ? "Por 1.000 alumnos" : "Reportes",
                rango: `Puestos ${nf(pagina * POR_PAGINA + 1)}–${nf(
                  Math.min((pagina + 1) * POR_PAGINA, total)
                )}`,
                parcial: esParcial,
                // Exactamente las filas visibles: la imagen es de ESTA página,
                // no de los primeros veinte resultados de la consulta.
                filas: visibles.map((p, i) => ({
                  posicion: pagina * POR_PAGINA + i + 1,
                  nombre: p.fila[0],
                  lugar: [idx.dic.d[p.fila[2]], idx.dic.r[p.fila[4]]]
                    .filter(Boolean)
                    .filter((v, k, a) => a.indexOf(v) === k)
                    .join(" · "),
                  valor:
                    metrica === "tasa" && p.tasa != null ? dec(p.tasa, 1) : nf(p.conteo),
                  tramo: tramoDe(p.conteo),
                  // Contra el máximo de ESTA página, el mismo `tope` que usa
                  // la tabla: imagen y web no pueden dar largos distintos.
                  peso: Math.min(
                    1,
                    Math.max(0, (metrica === "tasa" ? (p.tasa ?? 0) : p.conteo) / tope)
                  ),
                })),
              })
            }
            archivo={() => [
              "ranking",
              metrica === "tasa" ? "tasa" : "reportes",
              tipo === "todos" ? "" : tipo,
              anio,
              q("region"),
              q("ugel"),
              q("distrito"),
              q("gestion"),
              q("nivel"),
              `pagina-${pagina + 1}`,
            ]}
          />
          <ShareButton
            etiqueta="Enlace"
            soloIconoEnMovil
            titulo={`${titulo} · ${anio} · ${territorio}`}
          />
        </div>
      </div>

      {/* Los tipos van en una tira propia que se desplaza en horizontal: en un
          teléfono, envolverlos en dos filas empuja la pieza fuera de la
          primera pantalla, que es justo lo que hay que ver. */}
      {/* El buscador va aparte de los filtros, con su propio rótulo: filtrar
          reduce el ranking y buscar no lo toca. Mezclarlos invitaría a creer
          que escribir un nombre deja fuera al resto. */}
      {idx ? (
        <div className="mt-5 max-w-md">
          <RankingBuscador
            filas={idx.filas}
            dic={idx.dic}
            elegido={buscado}
            onElegir={(cm) => poner({ buscado: cm })}
          />
        </div>
      ) : null}

      {hallado ? (
        <div className="mt-3 max-w-2xl rounded-lg border border-accent/40 bg-accent-soft/40 p-4">
          {hallado.posicion != null && hallado.puesto ? (
            <p className="text-[0.95rem] leading-snug text-ink">
              <strong className="font-semibold">{hallado.fila[0]}</strong> está en el{" "}
              <strong className="font-semibold">puesto {nf(hallado.posicion)}</strong> de{" "}
              {nf(total)}
              {metrica === "tasa"
                ? ` con ${dec(hallado.puesto.tasa ?? 0, 1)} por 1.000 alumnos`
                : ` con ${nf(hallado.puesto.conteo)} reportes`}{" "}
              en {anio}.
            </p>
          ) : (
            <>
              {/* No se tocan los filtros: se dice qué los deja fuera y se
                  ofrece la ficha, que siempre tiene el dato completo. */}
              <p className="text-[0.95rem] leading-snug text-ink">
                <strong className="font-semibold">{hallado.fila[0]}</strong> no aparece en este
                ranking con los filtros puestos.
              </p>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-2">
                {(hallado.fila[8]?.[anio]?.[0] ?? 0) === 0
                  ? `No registró reportes en ${anio}.`
                  : filtrosActivos > 0
                    ? "Queda fuera de los filtros activos. Quítalos para verlo en la lista."
                    : metrica === "tasa"
                      ? "No tiene número de alumnos suficiente para calcular una tasa."
                      : "Queda fuera de la consulta actual."}
              </p>
            </>
          )}
          <Link
            href={`/colegio/${slugify(hallado.fila[0], idx!.dic.d[hallado.fila[2]], hallado.fila[1])}`}
            className="mt-2.5 inline-flex items-baseline gap-1.5 text-[0.86rem] font-medium text-accent hover:underline"
          >
            Ver su ficha
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}

      <fieldset className="-mx-5 mt-3 flex min-w-0 max-w-[100vw] items-center gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:max-w-none sm:flex-wrap sm:overflow-visible sm:px-0">
          <legend className="sr-only">Tipo de reporte</legend>
          {TIPOS.map((t) => {
            const c = t.v === "todos" ? null : color(COLOR_VIOLENCIA[t.v]);
            const sel = tipo === t.v;
            return (
              <button
                key={t.v}
                type="button"
                aria-pressed={sel}
                onClick={() => poner({ tipo: t.v === "todos" ? "" : t.v })}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded border px-3 text-[0.82rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:px-2.5 sm:py-1.5 ${
                  sel
                    ? "border-ink bg-surface font-medium text-ink"
                    : "border-rule text-ink-3 hover:border-ink-3 hover:text-ink-2"
                }`}
              >
                {c ? (
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-sm"
                    style={{ background: c, opacity: sel ? 1 : 0.55 }}
                  />
                ) : null}
                {t.label}
              </button>
            );
          })}
      </fieldset>

      {panel ? (
        <div id="panel-filtros" className="mt-3 rounded-lg border border-rule bg-surface p-4 sm:p-5">
          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="sr-only">Territorio</legend>
            {CLAVES_GEO.map(selGeo)}
          </fieldset>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Sel k="gestion" label="Gestión" pos={5} dic={idx.dic.g} />
            <Sel k="nivel" label="Nivel" pos={6} dic={idx.dic.n} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule-2 pt-4">
            <div className="flex flex-wrap items-center gap-4">
              {metrica === "tasa" ? (
                <label className="flex cursor-pointer items-center gap-2.5 text-[0.85rem] text-ink-2">
                  <input
                    type="checkbox"
                    checked={verCeros}
                    onChange={(e) => poner({ ceros: e.target.checked ? "1" : "" })}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Incluir colegios con 0 reportes
                  {cerosOcultos > 0 ? (
                    <span className="tabular text-ink-3">({nf(cerosOcultos)})</span>
                  ) : null}
                </label>
              ) : null}
              {q("nivel") ? (
                <p className="max-w-[40ch] text-[0.78rem] leading-snug text-ink-3">
                  Con un nivel elegido, cada fila muestra los reportes de ese nivel, no el
                  total del colegio.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {params.toString() ? (
                <button
                  type="button"
                  onClick={() => router.replace(pathname, { scroll: false })}
                  className={boton}
                >
                  Quitar filtros
                </button>
              ) : null}
              <button type="button" onClick={descargar} className={boton} disabled={total === 0}>
                Descargar CSV
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ══ LA PIEZA ════════════════════════════════════════════════════
          Todo lo necesario para que una captura se explique sola. */}
      <section
        aria-label="Ranking"
        className="mt-5 overflow-hidden rounded-xl border border-rule bg-surface"
      >
        {/* ── Portada ────────────────────────────────────────────
            Separa lo que la pieza afirma —métrica, año, universo— de las filas
            que lo sostienen, para que un recorte siga leyéndose como algo
            emitido por alguien y no como una captura de una hoja de cálculo.
            El corte lo marca un filete grueso del color del tipo elegido. */}
        <div className="border-b border-rule px-5 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink">
              <span aria-hidden className="h-2 w-2 rounded-sm bg-accent" />
              Observatorio Escolar
            </p>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-3">
              Ranking descriptivo
            </p>
          </div>

          <p className="meta mt-8">
            {metrica === "tasa" ? "Tasa de reportes" : "Reportes registrados"}
            {tipo === "todos" ? "" : ` · ${TIPOS.find((x) => x.v === tipo)!.label}`}
          </p>

          {/* display-l y no display-xl: "Colegios con más reportes registrados"
              son cinco palabras largas, y a 6 rem ocupan tres líneas que se
              comen la pieza entera. La escala grande es para un titular corto. */}
          <h2 className="titular mt-4 max-w-[17ch] text-display-l text-ink">
            {titulo}
          </h2>

          <div className="mt-9 flex flex-wrap items-end gap-x-8 gap-y-5 border-t border-rule pt-7">
            <div className="flex items-end gap-4">
              <p className="cifra text-[clamp(3.2rem,8vw,5rem)] text-accent">{anio}</p>
              <p className="pb-1.5 font-mono text-[0.66rem] uppercase leading-relaxed tracking-[0.1em] text-ink-3">
                {esParcial ? (
                  <>
                    año en curso
                    <span className="block">hasta agosto</span>
                  </>
                ) : esPrincipal ? (
                  <>
                    último año
                    <span className="block">completo</span>
                  </>
                ) : (
                  <>
                    año
                    <span className="block">completo</span>
                  </>
                )}
              </p>
            </div>

            <dl className="ml-auto flex gap-x-10 gap-y-3">
              <div>
                <dd className="cifra text-cifra-m text-ink">{nf(universo.conReportes)}</dd>
                <dt className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">
                  colegios
                </dt>
              </div>
              <div>
                <dd className="cifra text-cifra-m text-ink">{nf(universo.reportes)}</dd>
                <dt className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">
                  reportes registrados
                </dt>
              </div>
            </dl>
          </div>

          <p className="mt-6 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-ink-2">
            {territorio}
          </p>
          {filtros.ignorados.length ? (
            <p className="mt-2 max-w-prose text-[0.82rem] leading-relaxed text-accent">
              No se aplicó {filtros.ignorados.map((v) => `«${v}»`).join(", ")}: no es un
              valor de estos datos. La tabla muestra el universo sin ese filtro.
            </p>
          ) : null}
          {filtros.geo.ambiguos.map((a) => (
            <p key={a.valor} className="mt-2 max-w-prose text-[0.82rem] leading-relaxed text-accent">
              Hay {nf(a.n)} distritos llamados «{a.valor}» y la tabla incluye los {nf(a.n)}.
              Elige el departamento o la provincia para quedarte con uno.
            </p>
          ))}
          {metrica === "tasa" ? (
            <p className="mt-2 max-w-prose text-[0.82rem] leading-relaxed text-ink-3">
              Métrica secundaria. Solo existe en {idx.anio_tasa}, el año con censo de
              alumnos, y a partir de {nf(idx.matricula_minima)} alumnos.
              {sinTasa > 0 ? ` ${nf(sinTasa)} colegios quedan fuera por eso.` : ""}
            </p>
          ) : null}
        </div>

        {/* ── Filas ──────────────────────────────────────────────── */}
        {total === 0 ? (
          <div className="px-5 py-12 sm:px-10">
            <p className="text-[0.95rem] font-medium text-ink-2">Ningún colegio cumple</p>
            <p className="mt-1.5 max-w-prose text-[0.85rem] text-ink-3">
              Prueba quitando un filtro o cambiando de año.
            </p>
          </div>
        ) : (
          <ol className="px-5 sm:px-10">
            {visibles.map((p, i) => {
              const posicion = pagina * POR_PAGINA + i + 1;
              return (
                <Fila
                  key={`${p.fila[1]}-${i}`}
                  p={p}
                  posicion={posicion}
                  destacado={posicion <= DESTACADOS}
                />
              );
            })}
          </ol>
        )}

        {/* Leyenda del indicador. La regla del proyecto es que el color nunca
            viaja solo: sin esto, la barrita lateral sería decoración. */}
        {metrica === "reportes" && idx.distribucion?.[anio] ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule px-5 py-3.5 sm:px-10">
            <span className={clsMeta}>Dónde cae en {anio}</span>
            <span className="flex items-center gap-2">
              {(["corriente", "p75", "p90", "p95", "p99"] as TramoDistribucion[]).map((x) => (
                <span
                  key={x}
                  aria-hidden
                  className="h-2.5 w-5 rounded-sm"
                  style={{ background: colorPorTramo(x) }}
                />
              ))}
            </span>
            <span className="text-[0.78rem] text-ink-3">
              de la mediana ({numeroCorto(idx.distribucion[anio].mediana)} reportes) al
              1 % con más registros, entre los {nf(idx.distribucion[anio].n)} colegios del
              país con al menos uno
            </span>
          </div>
        ) : null}

        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule px-5 py-4 font-mono text-[0.66rem] uppercase tracking-[0.09em] text-ink-3 sm:px-10">
          <span>
            Fuente SíseVe · {anio}
            {esParcial ? " · hasta agosto" : ""}
            {metrica === "tasa" ? ` · alumnos Censo Educativo ${idx.anio_padron}` : ""}
          </span>
          <span className="text-ink-2">observatorioescolar.netlify.app</span>
        </p>
      </section>

      {paginas > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setPagina((x) => Math.max(0, x - 1))}
            disabled={pagina === 0}
            className={`${boton} disabled:opacity-40`}
          >
            ← Anterior
          </button>
          <p className="tabular text-[0.84rem] text-ink-3">
            {nf(pagina * POR_PAGINA + 1)}–{nf(Math.min((pagina + 1) * POR_PAGINA, total))} de{" "}
            {nf(total)}
          </p>
          <button
            type="button"
            onClick={() => setPagina((x) => Math.min(paginas - 1, x + 1))}
            disabled={pagina >= paginas - 1}
            className={`${boton} disabled:opacity-40`}
          >
            Siguiente →
          </button>
        </div>
      ) : null}
    </div>
  );
}
