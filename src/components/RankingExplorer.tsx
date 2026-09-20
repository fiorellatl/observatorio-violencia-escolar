"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dec, nf, slugify } from "@/lib/format";
import { boton, campo, meta as clsMeta } from "@/lib/ui";
import { COLOR_VIOLENCIA, color } from "@/lib/viz/colors";
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
 *      posición va pequeña y la tasa, tercera. "89,3 por 1.000" no le dice
 *      nada a nadie a primera vista, y ponerlo grande solo aparenta rigor.
 *   4. El cambio se cuenta en reportes ("+24 respecto a 2025"), no en puestos:
 *      "subió 1.062 posiciones" es cierto y no significa nada.
 *
 * LÍMITE DEL DATO QUE LA INTERFAZ RESPETA
 * Hay un solo padrón con el número de alumnos. La tasa se muestra ÚNICAMENTE
 * en el año que le corresponde a ese padrón; en cualquier otro año dice "sin
 * dato". Dividir los reportes de 2022 por los alumnos de 2026 daría un número
 * con aspecto de tasa que no describe a ninguna población real.
 */

type Metrica = "reportes" | "tasa";
type Tipo = "todos" | "fisica" | "psicologica" | "sexual";

const TIPOS: { v: Tipo; label: string; corto: string; pos: number }[] = [
  { v: "todos", label: "Todos los reportes", corto: "", pos: 0 },
  { v: "fisica", label: "Físicos", corto: "de violencia física", pos: 1 },
  { v: "psicologica", label: "Psicológicos", corto: "de violencia psicológica", pos: 2 },
  { v: "sexual", label: "Sexuales", corto: "de violencia sexual", pos: 3 },
];

const POR_PAGINA = 20;

type Puesto = {
  fila: RankingRow;
  valor: number;
  conteo: number;
  total: number;
  tasa: number | null;
  previo: number;
};

/** Trayectoria mínima del colegio. Sin ejes: es una forma, no un gráfico. */
function Sparkline({
  valores,
  anios,
  activo,
}: {
  valores: number[];
  anios: string[];
  activo: string;
}) {
  const max = Math.max(...valores, 1);
  const w = 74;
  const h = 22;
  const paso = valores.length > 1 ? w / (valores.length - 1) : w;
  const puntos = valores.map((v, i) => [i * paso, h - (v / max) * (h - 3) - 1.5] as const);
  const d = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const iActivo = anios.indexOf(activo);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      role="img"
      aria-label={anios.map((a, i) => `${a}: ${valores[i]}`).join(", ")}
    >
      <path d={d} fill="none" stroke="var(--viz-slate)" strokeWidth="1.25" strokeLinejoin="round" />
      {puntos.map((p, i) => (
        <circle
          key={anios[i]}
          cx={p[0]}
          cy={p[1]}
          r={i === iActivo ? 2.6 : 1.4}
          fill={i === iActivo ? "var(--viz-blue)" : "var(--viz-mute)"}
        >
          <title>
            {anios[i]}: {valores[i]} {valores[i] === 1 ? "reporte" : "reportes"}
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
  const anio = q("anio") || idx?.anios[idx.anios.length - 1] || "";
  const posTipo = TIPOS.find((t) => t.v === tipo)!.pos;

  /** Solo hay padrón para un año: fuera de él, no hay tasa. */
  const hayTasa = !!idx && anio === idx.anio_tasa;
  const esParcial = !!idx && anio === idx.anio_parcial;

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

  const candidatos = useMemo(() => {
    if (!idx) return [];
    const b = (dic: string[], v: string) => (v ? dic.indexOf(v) : -1);
    const r = b(idx.dic.r, q("region"));
    const pr = b(idx.dic.p, q("provincia"));
    const d = b(idx.dic.d, q("distrito"));
    const g = b(idx.dic.g, q("gestion"));
    const n = b(idx.dic.n, q("nivel"));
    return idx.filas.filter(
      (f) =>
        (r < 0 || f[4] === r) &&
        (pr < 0 || f[3] === pr) &&
        (d < 0 || f[2] === d) &&
        (g < 0 || f[5] === g) &&
        (n < 0 || f[6] === n)
    );
  }, [idx, q]);

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
      const c = f[8][anio];
      const conteo = c ? c[posTipo] : 0;
      const total = c ? c[0] : 0;
      reportesTotal += total;
      if (total > 0) conReportes++;

      const mat = f[7];
      const tasa = hayTasa && mat >= idx.matricula_minima ? (conteo / mat) * 1000 : null;
      const previo = anioPrevio ? (f[8][anioPrevio]?.[posTipo] ?? 0) : 0;

      if (metrica === "tasa") {
        if (tasa === null) {
          fuera++;
          continue;
        }
        if (conteo === 0 && !verCeros) {
          ceros++;
          continue;
        }
        out.push({ fila: f, valor: tasa, conteo, total, tasa, previo });
      } else {
        if (conteo === 0) continue;
        out.push({ fila: f, valor: conteo, conteo, total, tasa, previo });
      }
    }

    out.sort((a, b) => b.valor - a.valor || a.fila[0].localeCompare(b.fila[0], "es"));
    return {
      puestos: out,
      sinTasa: fuera,
      cerosOcultos: ceros,
      universo: { colegios: candidatos.length, reportes: reportesTotal, conReportes },
    };
  }, [idx, candidatos, anio, posTipo, metrica, verCeros, hayTasa, anioPrevio]);

  /**
   * Posición del año anterior. Solo se calcula si el universo comparado es el
   * mismo: con otros filtros, "subió N puestos" compararía dos tablas
   * distintas y sería falso.
   */
  const posicionPrevia = useMemo(() => {
    if (!idx || metrica !== "reportes" || !anioPrevio) return null;
    const lista = candidatos
      .map((f) => ({ cm: f[1], v: f[8][anioPrevio]?.[posTipo] ?? 0, n: f[0] }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || a.n.localeCompare(b.n, "es"));
    const m = new Map<string, number>();
    lista.forEach((x, k) => m.set(x.cm, k + 1));
    return m;
  }, [idx, candidatos, anioPrevio, posTipo, metrica]);

  const total = puestos.length;
  const visibles = puestos.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const paginas = Math.ceil(total / POR_PAGINA);
  const filtrosActivos = ["region", "provincia", "distrito", "gestion", "nivel"].filter((k) => q(k)).length;

  const descargar = () => {
    if (!idx) return;
    const cab = ["posicion", "colegio", "codigo_modular", "distrito", "provincia", "region",
                 "gestion", "nivel", "anio", "reportes_del_tipo", "reportes_totales",
                 "num_alumnos", "tasa_por_1000"];
    const filas = puestos.map((p, i) => [
      i + 1, `"${p.fila[0].replace(/"/g, '""')}"`, p.fila[1],
      `"${idx.dic.d[p.fila[2]]}"`, `"${idx.dic.p[p.fila[3]]}"`, `"${idx.dic.r[p.fila[4]]}"`,
      `"${idx.dic.g[p.fila[5]]}"`, `"${idx.dic.n[p.fila[6]]}"`,
      anio, p.conteo, p.total, p.fila[7] || "", p.tasa != null ? p.tasa.toFixed(2) : "",
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
  if (!idx) return <div className="h-96 animate-pulse rounded-lg border border-rule bg-surface" />;

  const Sel = ({ k, label, pos, dic }: { k: string; label: string; pos: number; dic: string[] }) => {
    const vistos = new Set<number>();
    for (const f of candidatos) vistos.add(f[pos] as number);
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
      : `Colegios con más reportes ${suf} registrados`.replace("  ", " ");

  return (
    <div>
      {/* ── Año y contexto del universo ─────────────────────────── */}
      <div className="border-y border-rule py-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <label htmlFor="r-anio" className={`${clsMeta} block`}>
              Año
            </label>
            <div className="mt-2 flex items-baseline gap-3">
              <select
                id="r-anio"
                value={anio}
                disabled={metrica === "tasa"}
                onChange={(e) => poner({ anio: e.target.value })}
                className="cifra border-0 bg-transparent p-0 text-cifra-l text-ink outline-none disabled:opacity-60"
              >
                {[...idx.anios].reverse().map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {esParcial ? (
                <span className="rounded border border-rule bg-surface px-2 py-1 text-[0.78rem] text-ink-2">
                  año en curso
                </span>
              ) : null}
            </div>
            {esParcial ? (
              <p className="mt-2 text-[0.8rem] text-ink-3">
                Datos registrados hasta agosto. No es comparable con un año completo.
              </p>
            ) : null}
            {metrica === "tasa" ? (
              <p className="mt-2 max-w-[38ch] text-[0.8rem] text-ink-3">
                La tasa solo existe en {idx.anio_tasa}: es el año del padrón con el número
                de alumnos.
              </p>
            ) : null}
          </div>

          <dl className="flex flex-wrap gap-x-9 gap-y-4">
            {[
              ["Colegios con reportes", nf(universo.conReportes)],
              ["Reportes registrados", nf(universo.reportes)],
              ["En esta tabla", nf(total)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className={clsMeta}>{k}</dt>
                <dd className="cifra mt-1.5 text-cifra-m text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── Modo ────────────────────────────────────────────────── */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {(
          [
            ["reportes", "Más reportes registrados",
             "Ordena por cantidad de reportes registrados. El número absoluto puede estar relacionado con el tamaño del colegio."],
            ["tasa", "Mayor tasa de reportes",
             `Permite comparar colegios de distinto tamaño cuando conocemos su número de alumnos. Solo ${idx.anio_tasa}, y solo con al menos ${nf(idx.matricula_minima)} alumnos.`],
          ] as [Metrica, string, string][]
        ).map(([v, t, desc]) => (
          <button
            key={v}
            type="button"
            aria-pressed={metrica === v}
            onClick={() => poner({ metrica: v === "reportes" ? "" : v })}
            className={`rounded-lg border p-4 text-left transition-colors duration-150 ease-suave ${
              metrica === v
                ? "border-ink bg-surface"
                : "border-rule bg-transparent hover:border-ink-3"
            }`}
          >
            <span
              className={`block text-[0.98rem] font-medium ${
                metrica === v ? "text-ink" : "text-ink-2"
              }`}
            >
              {t}
            </span>
            <span className="mt-1.5 block text-[0.82rem] leading-relaxed text-ink-3">{desc}</span>
          </button>
        ))}
      </div>

      {/* ── Tipo de reporte ─────────────────────────────────────── */}
      <fieldset className="mt-6">
        <legend className={`${clsMeta} mb-2.5`}>Tipo de reporte</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => {
            const c = t.v === "todos" ? null : color(COLOR_VIOLENCIA[t.v]);
            return (
              <button
                key={t.v}
                type="button"
                aria-pressed={tipo === t.v}
                onClick={() => poner({ tipo: t.v === "todos" ? "" : t.v })}
                className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[0.85rem] transition-colors duration-150 ease-suave ${
                  tipo === t.v
                    ? "border-ink bg-surface font-medium text-ink"
                    : "border-rule text-ink-2 hover:border-ink-3"
                }`}
              >
                {c ? (
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
                ) : null}
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ── Territorio ──────────────────────────────────────────── */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Sel k="region" label="Región" pos={4} dic={idx.dic.r} />
        <Sel k="provincia" label="Provincia" pos={3} dic={idx.dic.p} />
        <Sel k="distrito" label="Distrito" pos={2} dic={idx.dic.d} />
        <Sel k="gestion" label="Gestión" pos={5} dic={idx.dic.g} />
        <Sel k="nivel" label="Nivel" pos={6} dic={idx.dic.n} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
              {cerosOcultos > 0 ? <span className="tabular text-ink-3">({nf(cerosOcultos)})</span> : null}
            </label>
          ) : null}
          {filtrosActivos > 0 ? (
            <span className="text-[0.82rem] text-ink-3">
              {filtrosActivos} {filtrosActivos === 1 ? "filtro activo" : "filtros activos"}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {params.toString() ? (
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className={boton}>
              Quitar filtros
            </button>
          ) : null}
          <button type="button" onClick={descargar} className={boton} disabled={total === 0}>
            Descargar CSV
          </button>
        </div>
      </div>

      {/* ── Título dinámico ─────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-display-m font-medium text-balance">
        {titulo}
        <span className="text-ink-3"> · {anio}</span>
      </h2>
      {metrica === "tasa" && sinTasa > 0 ? (
        <p className="mt-2 max-w-prose text-[0.85rem] leading-relaxed text-ink-2">
          {nf(sinTasa)} colegios del filtro quedan fuera porque no conocemos su número de
          alumnos o tienen menos de {nf(idx.matricula_minima)}.
        </p>
      ) : null}

      {/* ── Filas ───────────────────────────────────────────────── */}
      {total === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-rule p-6">
          <p className="text-[0.92rem] font-medium text-ink-2">Ningún colegio cumple</p>
          <p className="mt-1.5 max-w-prose text-[0.85rem] text-ink-3">
            Prueba quitando un filtro o cambiando de año.
          </p>
        </div>
      ) : (
        <>
          <ol className="mt-6 border-t border-rule">
            {visibles.map((p, i) => {
              const posicion = pagina * POR_PAGINA + i + 1;
              const distrito = idx.dic.d[p.fila[2]];
              const provincia = idx.dic.p[p.fila[3]];
              const region = idx.dic.r[p.fila[4]];
              const gestion = idx.dic.g[p.fila[5]];
              const nivel = idx.dic.n[p.fila[6]];
              const alumnos = p.fila[7];
              const prevPos = posicionPrevia?.get(p.fila[1]) ?? null;
              const delta = p.conteo - p.previo;
              const serie = idx.anios.map((a) => p.fila[8][a]?.[posTipo] ?? 0);
              const href = `/colegio/${slugify(p.fila[0], distrito, p.fila[1])}`;

              return (
                <li key={`${p.fila[1]}-${i}`} className="border-b border-rule-2">
                  <Link
                    href={href}
                    className="group block px-1 py-5 transition-colors duration-150 ease-suave hover:bg-accent-soft/50"
                  >
                    <div className="flex gap-4 sm:gap-6">
                      <span className="tabular w-7 shrink-0 pt-1 font-mono text-[0.82rem] text-ink-3 sm:w-9">
                        {posicion}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[1.05rem] font-medium leading-snug text-ink group-hover:text-accent">
                          {p.fila[0]}
                        </p>
                        <p className="mt-1 text-[0.8rem] text-ink-3">
                          {distrito}
                          {provincia && provincia !== distrito ? ` · ${provincia}` : ""} · {region}
                        </p>
                        <p className="text-[0.8rem] text-ink-3">
                          {nivel} · {gestion}
                        </p>

                        {/* Cifras en móvil: bajo el nombre, en columna. */}
                        <dl className="mt-3.5 flex flex-wrap gap-x-7 gap-y-2 sm:hidden">
                          <div>
                            <dd className="cifra text-[1.5rem] text-ink">{nf(p.conteo)}</dd>
                            <dt className={clsMeta}>reportes</dt>
                          </div>
                          <div>
                            <dd className="cifra text-[1.5rem] text-ink">
                              {alumnos ? nf(alumnos) : "—"}
                            </dd>
                            <dt className={clsMeta}># alumnos</dt>
                          </div>
                          <div>
                            <dd className="tabular text-[1.05rem] text-ink-2">
                              {p.tasa != null ? dec(p.tasa, 1) : "—"}
                            </dd>
                            <dt className={clsMeta}>
                              {p.tasa != null ? "por 1.000" : hayTasa ? "sin # alumnos" : "sin dato"}
                            </dt>
                          </div>
                        </dl>

                        {anioPrevio ? (
                          <p className="mt-3 text-[0.84rem] text-ink-2">
                            <span className="tabular">
                              {nf(p.conteo)} en {anio} · {nf(p.previo)} en {anioPrevio}
                            </span>
                            {delta !== 0 ? (
                              <span className="tabular ml-2 text-ink-3">
                                <span aria-hidden>{delta > 0 ? "↑" : "↓"}</span>{" "}
                                {delta > 0 ? "+" : ""}
                                {nf(delta)} reportes
                              </span>
                            ) : (
                              <span className="ml-2 text-ink-3">sin cambio</span>
                            )}
                          </p>
                        ) : null}

                        {prevPos ? (
                          <p className="mt-1 text-[0.78rem] text-ink-3">
                            Posición en {anioPrevio}: {nf(prevPos)}
                          </p>
                        ) : null}
                      </div>

                      {/* Cifras en pantalla ancha: columnas a la derecha. */}
                      <dl className="hidden shrink-0 items-start gap-8 sm:flex">
                        <div className="w-[4.5rem] text-right">
                          <dd className="cifra text-[1.85rem] text-ink">{nf(p.conteo)}</dd>
                          <dt className={`${clsMeta} mt-1 block`}>reportes</dt>
                        </div>
                        <div className="w-[4.5rem] text-right">
                          <dd className="cifra text-[1.5rem] text-ink-2">
                            {alumnos ? nf(alumnos) : "—"}
                          </dd>
                          <dt className={`${clsMeta} mt-1 block`}># alumnos</dt>
                        </div>
                        <div className="w-[5rem] text-right">
                          <dd
                            className="tabular text-[1.05rem] text-ink-2"
                            title="Permite comparar colegios de distintos tamaños. No representa personas afectadas ni casos únicos."
                          >
                            {p.tasa != null ? dec(p.tasa, 1) : "—"}
                          </dd>
                          <dt className={`${clsMeta} mt-1 block leading-tight`}>
                            {p.tasa != null
                              ? "reportes / 1.000 alumnos"
                              : hayTasa
                                ? "sin # alumnos"
                                : "sin dato"}
                          </dt>
                        </div>
                        <div className="hidden w-[4.6rem] shrink-0 pt-1 lg:block">
                          <Sparkline valores={serie} anios={idx.anios} activo={anio} />
                          <span className={`${clsMeta} mt-1 block`}>
                            {idx.anios[0]}–{idx.anios[idx.anios.length - 1]}
                          </span>
                        </div>
                      </dl>
                    </div>

                    <span className="mt-3 inline-flex items-baseline gap-1.5 text-[0.84rem] font-medium text-accent sm:mt-2">
                      Ver colegio
                      <span
                        aria-hidden
                        className="transition-transform duration-150 ease-suave group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {paginas > 1 ? (
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setPagina((x) => Math.max(0, x - 1))}
                disabled={pagina === 0}
                className={`${boton} disabled:opacity-40`}
              >
                ← Anterior
              </button>
              <p className="tabular text-[0.84rem] text-ink-3">
                {pagina + 1} de {nf(paginas)}
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
        </>
      )}

      <p className="mt-7 border-t border-rule pt-5 text-[0.78rem] leading-relaxed text-ink-3">
        Reportes: SíseVe · {anio}
        {esParcial ? " (hasta agosto)" : ""}.{" "}
        {hayTasa
          ? `Número de alumnos: ESCALE · ${idx.anio_tasa}.`
          : `Sin tasa para ${anio}: el padrón con el número de alumnos corresponde a ${idx.anio_tasa}.`}{" "}
        La trayectoria muestra {idx.anios[0]}–{idx.anios[idx.anios.length - 1]}; 2020 y 2021
        quedan fuera porque los colegios estuvieron cerrados.
      </p>
    </div>
  );
}
