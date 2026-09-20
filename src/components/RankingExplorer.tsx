"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dec, nf, slugify } from "@/lib/format";
import { boton, campo, meta as clsMeta } from "@/lib/ui";
import type { RankingIndex, RankingRow } from "@/lib/types";

/**
 * Explorador de rankings descriptivos.
 *
 * El ranking existe porque la pregunta "¿qué colegios registraron más
 * reportes?" es legítima y esconderla no la responde: la deja a merced de
 * quien la conteste peor. Lo que no puede pasar es que la tabla se lea como
 * "colegios más violentos", y de eso se ocupan tres decisiones concretas:
 *
 *   1. El título nombra siempre la métrica ("más reportes registrados",
 *      "mayor tasa"), nunca una cualidad del colegio.
 *   2. Conteo y tasa son dos ordenaciones distintas que jamás se mezclan.
 *      Ordenar por conteo ordena, en buena medida, por tamaño del colegio.
 *   3. Cada fila lleva su denominador cuando existe, y dice "sin tasa" cuando
 *      no, en vez de caer al final en silencio.
 *
 * LÍMITE DEL DATO: solo hay un padrón de matrícula (ESCALE 2026), así que la
 * tasa se ofrece únicamente para el año transversal. Calcularla para 2022 o
 * 2025 con la matrícula de 2026 produciría una serie de tasas inventada.
 */

type Metrica = "reportes" | "tasa";
type Tipo = "todos" | "fisica" | "psicologica" | "sexual";

const TIPOS: { v: Tipo; label: string; pos: number }[] = [
  { v: "todos", label: "Todos los tipos", pos: 0 },
  { v: "fisica", label: "Física", pos: 1 },
  { v: "psicologica", label: "Psicológica", pos: 2 },
  { v: "sexual", label: "Sexual", pos: 3 },
];

const TITULO: Record<Tipo, string> = {
  todos: "Colegios con más reportes registrados",
  fisica: "Colegios con más reportes de violencia física",
  psicologica: "Colegios con más reportes de violencia psicológica",
  sexual: "Colegios con más reportes de violencia sexual",
};

const POR_PAGINA = 25;

type Puesto = {
  fila: RankingRow;
  valor: number;
  reportes: number;
  tasa: number | null;
  previo: number | null;
};

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
  const tipo: Tipo = (TIPOS.find((t) => t.v === q("tipo"))?.v ?? "todos") as Tipo;
  const verCeros = q("ceros") === "1";
  const anio = q("anio") || idx?.anio_tasa || "";

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

  // La tasa solo existe para el año transversal: si se pide, se fija ahí.
  useEffect(() => {
    if (idx && metrica === "tasa" && anio !== idx.anio_tasa) {
      poner({ anio: idx.anio_tasa });
    }
  }, [idx, metrica, anio, poner]);

  const candidatos = useMemo(() => {
    if (!idx) return [];
    const buscar = (dic: string[], v: string) => (v ? dic.indexOf(v) : -1);
    const r = buscar(idx.dic.r, q("region"));
    const p = buscar(idx.dic.p, q("provincia"));
    const d = buscar(idx.dic.d, q("distrito"));
    const g = buscar(idx.dic.g, q("gestion"));
    const n = buscar(idx.dic.n, q("nivel"));
    return idx.filas.filter((f) => {
      if (r >= 0 && f[4] !== r) return false;
      if (p >= 0 && f[3] !== p) return false;
      if (d >= 0 && f[2] !== d) return false;
      if (g >= 0 && f[5] !== g) return false;
      if (n >= 0 && f[6] !== n) return false;
      return true;
    });
  }, [idx, q]);

  const posTipo = TIPOS.find((t) => t.v === tipo)!.pos;

  const { puestos, sinTasa, cerosOcultos } = useMemo(() => {
    if (!idx) return { puestos: [] as Puesto[], sinTasa: 0, cerosOcultos: 0 };

    const previoDe = (f: RankingRow) => {
      const i = idx.anios.indexOf(anio);
      const ant = i > 0 ? idx.anios[i - 1] : null;
      return ant ? (f[8][ant]?.[posTipo] ?? 0) : null;
    };

    let fuera = 0;
    let ceros = 0;
    const out: Puesto[] = [];

    for (const f of candidatos) {
      const c = f[8][anio];
      const valorTipo = c ? c[posTipo] : 0;
      const reportes = c ? c[0] : 0;
      const mat = f[7];
      const tasa =
        mat >= idx.matricula_minima ? (valorTipo / mat) * 1000 : null;

      if (metrica === "tasa") {
        if (tasa === null) {
          fuera++;
          continue;
        }
        if (valorTipo === 0 && !verCeros) {
          ceros++;
          continue;
        }
        out.push({ fila: f, valor: tasa, reportes, tasa, previo: previoDe(f) });
      } else {
        if (valorTipo === 0) continue;
        out.push({ fila: f, valor: valorTipo, reportes, tasa, previo: previoDe(f) });
      }
    }

    out.sort((a, b) => b.valor - a.valor || a.fila[0].localeCompare(b.fila[0], "es"));
    return { puestos: out, sinTasa: fuera, cerosOcultos: ceros };
  }, [idx, candidatos, anio, posTipo, metrica, verCeros]);

  /** Posición del año anterior, para la columna de cambio. */
  const posicionPrevia = useMemo(() => {
    if (!idx || metrica !== "reportes") return null;
    const i = idx.anios.indexOf(anio);
    if (i <= 0) return null;
    const ant = idx.anios[i - 1];
    const lista = candidatos
      .map((f) => ({ cm: f[1], v: f[8][ant]?.[posTipo] ?? 0, n: f[0] }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || a.n.localeCompare(b.n, "es"));
    const m = new Map<string, number>();
    lista.forEach((x, k) => m.set(x.cm, k + 1));
    return { mapa: m, anio: ant };
  }, [idx, candidatos, anio, posTipo, metrica]);

  const mediana = useMemo(() => {
    if (metrica !== "tasa" || puestos.length === 0) return null;
    const v = puestos.map((p) => p.valor).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  }, [puestos, metrica]);

  const total = puestos.length;
  const visibles = puestos.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const paginas = Math.ceil(total / POR_PAGINA);

  const descargar = () => {
    const cab = ["posicion", "colegio", "codigo_modular", "distrito", "provincia", "region", "gestion", "nivel", "anio", "reportes_tipo", "reportes_total", "matricula", "tasa_por_1000"];
    const filas = puestos.map((p, i) => [
      i + 1,
      `"${p.fila[0].replace(/"/g, '""')}"`,
      p.fila[1],
      `"${idx!.dic.d[p.fila[2]]}"`,
      `"${idx!.dic.p[p.fila[3]]}"`,
      `"${idx!.dic.r[p.fila[4]]}"`,
      `"${idx!.dic.g[p.fila[5]]}"`,
      `"${idx!.dic.n[p.fila[6]]}"`,
      anio,
      Math.round(p.valor === p.tasa ? p.fila[8][anio]?.[posTipo] ?? 0 : p.valor),
      p.reportes,
      p.fila[7] || "",
      p.tasa != null ? p.tasa.toFixed(2) : "",
    ]);
    const csv = [cab.join(","), ...filas.map((f) => f.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `observatorio-reportes-${tipo}-${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Select = ({ k, label, dic }: { k: string; label: string; dic: string[] }) => {
    const vistos = new Set<number>();
    const pos = { region: 4, provincia: 3, distrito: 2, gestion: 5, nivel: 6 }[k]!;
    for (const f of candidatos) vistos.add(f[pos] as number);
    // Si el filtro está activo, sus opciones no deben reducirse a sí mismo.
    const opts = q(k)
      ? dic.filter(Boolean)
      : [...vistos].map((i) => dic[i]).filter(Boolean);
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

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-6">
        <p className="text-[0.92rem] font-medium text-ink-2">No se pudo cargar el índice</p>
        <p className="mt-1.5 text-[0.85rem] text-ink-3">Revisa tu conexión y recarga.</p>
      </div>
    );
  }

  if (!idx) {
    return (
      <div className="h-64 animate-pulse rounded-lg border border-rule bg-surface" />
    );
  }

  const titulo =
    metrica === "tasa"
      ? tipo === "todos"
        ? "Colegios con mayor tasa de reportes registrados"
        : `Colegios con mayor tasa de reportes de violencia ${TIPOS.find((t) => t.v === tipo)!.label.toLowerCase()}`
      : TITULO[tipo];

  return (
    <div>
      {/* ── Controles ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-rule bg-surface p-4 sm:p-5">
        <fieldset>
          <legend className={`${clsMeta} mb-2`}>Ordenar por</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["reportes", "Número de reportes"],
                ["tasa", `Tasa por 1.000 estudiantes`],
              ] as [Metrica, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={metrica === v}
                onClick={() => poner({ metrica: v === "reportes" ? "" : v })}
                className={`rounded border px-3 py-1.5 text-[0.85rem] transition-colors duration-150 ease-suave ${
                  metrica === v
                    ? "border-accent bg-accent-soft font-medium text-accent"
                    : "border-rule bg-surface text-ink-2 hover:border-ink-3"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="r-tipo" className={`${clsMeta} block`}>
              Tipo de violencia
            </label>
            <select
              id="r-tipo"
              value={tipo}
              onChange={(e) => poner({ tipo: e.target.value === "todos" ? "" : e.target.value })}
              className={`${campo} mt-1.5`}
            >
              {TIPOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="r-anio" className={`${clsMeta} block`}>
              Año
            </label>
            <select
              id="r-anio"
              value={anio}
              disabled={metrica === "tasa"}
              onChange={(e) => poner({ anio: e.target.value })}
              className={`${campo} mt-1.5 disabled:opacity-50`}
            >
              {idx.anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                  {a === idx.anio_parcial ? " (incompleto)" : ""}
                </option>
              ))}
            </select>
          </div>

          <Select k="region" label="Región" dic={idx.dic.r} />
          <Select k="distrito" label="Distrito" dic={idx.dic.d} />
          <Select k="gestion" label="Gestión" dic={idx.dic.g} />
          <Select k="nivel" label="Nivel" dic={idx.dic.n} />
        </div>

        {metrica === "tasa" ? (
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[0.86rem] text-ink-2">
            <input
              type="checkbox"
              checked={verCeros}
              onChange={(e) => poner({ ceros: e.target.checked ? "1" : "" })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Incluir colegios con 0 reportes
            {cerosOcultos > 0 ? (
              <span className="tabular text-ink-3">({nf(cerosOcultos)} ocultos)</span>
            ) : null}
          </label>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule-2 pt-3.5">
          <p className="text-[0.84rem] text-ink-2" role="status" aria-live="polite">
            <span className="tabular font-medium text-ink">{nf(total)}</span> colegios en
            esta tabla
            {metrica === "tasa" && mediana != null ? (
              <span className="text-ink-3">
                {" "}
                · mediana <span className="tabular">{dec(mediana, 1)}</span> por 1.000
              </span>
            ) : null}
          </p>
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
      </div>

      {/* ── Título dinámico ───────────────────────────────────── */}
      <h2 className="mt-10 font-display text-display-m font-medium text-balance">
        {titulo}
        <span className="text-ink-3"> · {anio}</span>
      </h2>

      {metrica === "tasa" ? (
        <p className="mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-2">
          Solo entran colegios con matrícula conocida de al menos{" "}
          {nf(idx.matricula_minima)} estudiantes.{" "}
          {sinTasa > 0 ? (
            <>
              {nf(sinTasa)} colegios del filtro quedan fuera porque no tenemos un
              denominador válido para ellos.
            </>
          ) : null}{" "}
          Arriba de una tabla ordenada por tasa suelen aparecer colegios pequeños: con
          200 estudiantes, cada reporte vale cinco veces más que en uno de 1.000.
        </p>
      ) : (
        <p className="mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-2">
          Ordenar por número de reportes ordena también, en buena medida, por tamaño del
          colegio. Para comparar colegios de distinto tamaño, usa la tasa.
        </p>
      )}

      {/* ── Tabla / filas ─────────────────────────────────────── */}
      {total === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-rule p-6">
          <p className="text-[0.92rem] font-medium text-ink-2">Ningún colegio cumple</p>
          <p className="mt-1.5 max-w-prose text-[0.85rem] text-ink-3">
            Prueba quitando algún filtro o cambiando de año.
          </p>
        </div>
      ) : (
        <>
          <ol className="mt-6 overflow-hidden rounded-lg border border-rule bg-surface">
            {visibles.map((p, i) => {
              const posicion = pagina * POR_PAGINA + i + 1;
              const distrito = idx.dic.d[p.fila[2]];
              const region = idx.dic.r[p.fila[4]];
              const nivel = idx.dic.n[p.fila[6]];
              const gestion = idx.dic.g[p.fila[5]];
              const prev = posicionPrevia?.mapa.get(p.fila[1]) ?? null;
              const delta = prev != null ? prev - posicion : null;
              const conteoTipo = p.fila[8][anio]?.[posTipo] ?? 0;

              return (
                <li key={`${p.fila[1]}-${i}`} className="border-b border-rule-2 last:border-b-0">
                  <Link
                    href={`/colegio/${slugify(p.fila[0], distrito, p.fila[1])}`}
                    className="flex gap-4 px-4 py-3.5 transition-colors duration-150 ease-suave hover:bg-accent-soft/60"
                  >
                    <span className="tabular w-8 shrink-0 pt-0.5 font-mono text-[0.86rem] text-ink-3">
                      {posicion}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95rem] font-medium leading-snug text-ink">
                        {p.fila[0]}
                      </span>
                      <span className="mt-0.5 block text-[0.78rem] text-ink-3">
                        {distrito}, {region}
                        {nivel ? ` · ${nivel}` : ""} · {gestion}
                      </span>

                      {/* En móvil las cifras van aquí, bajo el nombre. */}
                      <span className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 sm:hidden">
                        <span className="tabular text-[0.9rem] font-medium text-ink">
                          {nf(conteoTipo)} {conteoTipo === 1 ? "reporte" : "reportes"}
                        </span>
                        <span className="tabular text-[0.82rem] text-ink-3">
                          {p.tasa != null ? `${dec(p.tasa, 1)} / 1.000` : "sin tasa"}
                        </span>
                        {p.fila[7] ? (
                          <span className="tabular text-[0.82rem] text-ink-3">
                            {nf(p.fila[7])} estudiantes
                          </span>
                        ) : null}
                      </span>

                      {delta != null && delta !== 0 ? (
                        <span className="mt-1.5 block text-[0.78rem] text-ink-3">
                          <span aria-hidden>{delta > 0 ? "↑" : "↓"}</span>{" "}
                          {delta > 0 ? "Subió" : "Bajó"} {Math.abs(delta)}{" "}
                          {Math.abs(delta) === 1 ? "posición" : "posiciones"} respecto a{" "}
                          {posicionPrevia?.anio}
                        </span>
                      ) : null}
                    </span>

                    {/* En pantalla ancha, columnas alineadas a la derecha. */}
                    <span className="hidden shrink-0 items-baseline gap-6 sm:flex">
                      <span className="w-20 text-right">
                        <span className="cifra block text-[1.3rem] font-medium text-ink">
                          {nf(conteoTipo)}
                        </span>
                        <span className={`${clsMeta} block`}>reportes</span>
                      </span>
                      <span className="w-20 text-right">
                        {p.tasa != null ? (
                          <>
                            <span className="cifra block text-[1.3rem] font-medium text-ink">
                              {dec(p.tasa, 1)}
                            </span>
                            <span className={`${clsMeta} block`}>por 1.000</span>
                          </>
                        ) : (
                          <span className="block text-[0.8rem] leading-snug text-ink-3">
                            sin tasa
                          </span>
                        )}
                      </span>
                      <span className="w-20 text-right">
                        {p.fila[7] ? (
                          <>
                            <span className="tabular block text-[0.95rem] text-ink-2">
                              {nf(p.fila[7])}
                            </span>
                            <span className={`${clsMeta} block`}>matrícula</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {paginas > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
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
                onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
                disabled={pagina >= paginas - 1}
                className={`${boton} disabled:opacity-40`}
              >
                Siguiente →
              </button>
            </div>
          ) : null}
        </>
      )}

      <p className="mt-6 text-[0.78rem] leading-relaxed text-ink-3">
        Año de los reportes: {anio} (SíseVe).
        {metrica === "tasa" || puestos.some((p) => p.tasa != null)
          ? " Año de la matrícula: 2026 (ESCALE)."
          : ""}
      </p>
    </div>
  );
}
