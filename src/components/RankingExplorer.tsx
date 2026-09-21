"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { dec, nf, slugify } from "@/lib/format";
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
  { v: "fisica", label: "Físicos", corto: "de violencia física", pos: 1 },
  { v: "psicologica", label: "Psicológicos", corto: "de violencia psicológica", pos: 2 },
  { v: "sexual", label: "Sexuales", corto: "de violencia sexual", pos: 3 },
];

/** Un cuantil interpolado puede no ser entero; no se finge que lo sea. */
const numeroCorto = (n: number) =>
  Number.isInteger(n) ? nf(n) : n.toFixed(1).replace(".", ",");

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
      if ("region" in cambios) {
        p.delete("provincia");
        p.delete("distrito");
      }
      if ("provincia" in cambios) p.delete("distrito");
      setPagina(0);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
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
    const out: { clave: string; valor: string; id: number; pos: number }[] = [];
    const ignorados: string[] = [];
    if (!idx) return { out, ignorados };
    const campos: [string, string[], number][] = [
      ["region", idx.dic.r, 4],
      ["provincia", idx.dic.p, 3],
      ["distrito", idx.dic.d, 2],
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
    return { out, ignorados };
  }, [idx, q]);

  const candidatos = useMemo(() => {
    if (!idx) return [];
    return idx.filas.filter((f) =>
      filtros.out.every(({ id, pos }) => {
        const v = f[pos];
        return Array.isArray(v) ? v.includes(id) : v === id;
      })
    );
  }, [idx, filtros]);

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
  const visibles = puestos.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const paginas = Math.ceil(total / POR_PAGINA);
  const filtrosActivos = filtros.out.length;

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
    const de = (k: string) => filtros.out.find((f) => f.clave === k)?.valor ?? "";
    const t = [de("distrito"), de("provincia"), de("region")].filter(Boolean);
    const lugar = t.length ? t.join(", ") : "Perú";
    const rasgos = [de("gestion"), de("nivel")].filter(Boolean);
    return rasgos.length ? `${lugar} · ${rasgos.join(" · ")}` : `${lugar} · todos los colegios`;
  })();

  const descargar = () => {
    if (!idx) return;
    const cab = ["posicion", "colegio", "codigo_modular", "distrito", "provincia", "region",
                 "gestion", "nivel", "anio", "reportes_del_tipo", "reportes_totales",
                 "num_alumnos", "tasa_por_1000"];
    const filas = puestos.map((p, i) => [
      i + 1, `"${p.fila[0].replace(/"/g, '""')}"`, p.fila[1],
      `"${idx.dic.d[p.fila[2]]}"`, `"${idx.dic.p[p.fila[3]]}"`, `"${idx.dic.r[p.fila[4]]}"`,
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
      <div>
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

  const suf = TIPOS.find((t) => t.v === tipo)!.corto;
  const titulo =
    metrica === "tasa"
      ? `Colegios con mayor tasa de reportes ${suf}`.trim()
      : `Colegios con más reportes ${suf} registrados`.replace(/\s{2,}/g, " ");

  /* ── Una fila del ranking ──────────────────────────────────────────── */
  const Fila = ({ p, posicion, destacado }: { p: Puesto; posicion: number; destacado: boolean }) => {
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
      <li className="border-b border-rule-2 last:border-b-0">
        <Link
          href={href}
          className="group flex items-stretch gap-3 py-4 transition-colors duration-150 ease-suave hover:bg-accent-soft/40 sm:gap-5 sm:py-5"
        >
          {/* Indicador de reparto: dónde cae este conteo dentro del año, en la
              escala secuencial. No califica al colegio; sitúa el número. */}
          {tramo ? (
            <span
              aria-hidden
              className="w-1 shrink-0 rounded-full"
              style={{ background: colorPorTramo(tramo) }}
            />
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
            className="cifra rounded border border-rule bg-surface px-3 py-1.5 text-[1.1rem] text-ink outline-none transition-colors duration-150 ease-suave hover:border-ink-3 focus:border-accent disabled:opacity-60"
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
                className={`px-3 py-2 text-[0.84rem] transition-colors duration-150 ease-suave ${
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

        <div className="flex items-center gap-2">
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
          <ShareButton
            etiqueta="Compartir"
            soloIconoEnMovil
            titulo={`${titulo} · ${anio} · ${territorio}`}
          />
        </div>
      </div>

      {/* Los tipos van en una tira propia que se desplaza en horizontal: en un
          teléfono, envolverlos en dos filas empuja la pieza fuera de la
          primera pantalla, que es justo lo que hay que ver. */}
      <fieldset className="-mx-5 mt-3 flex items-center gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
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
                className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1.5 text-[0.82rem] transition-colors duration-150 ease-suave ${
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
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Sel k="region" label="Región" pos={4} dic={idx.dic.r} />
            <Sel k="provincia" label="Provincia" pos={3} dic={idx.dic.p} />
            <Sel k="distrito" label="Distrito" pos={2} dic={idx.dic.d} />
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
