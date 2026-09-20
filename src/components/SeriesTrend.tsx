"use client";

import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dec, nf } from "@/lib/format";

/**
 * Varias categorías a lo largo del tiempo.
 *
 * Sustituye a los bloques de totales acumulados. Un acumulado de doce años
 * responde "cuántos reportes psicológicos hay en total", que es la pregunta
 * menos interesante: no distingue un colegio que registró todo en 2016 de uno
 * que lo registra cada año.
 *
 * POR QUÉ LÍNEAS Y NO BARRAS AGRUPADAS. Con doce años y tres categorías salen
 * treinta y seis barras que en un móvil miden dos píxeles. La línea aguanta
 * cualquier ancho y es la forma que mejor muestra lo único que importa aquí:
 * hacia dónde va cada categoría.
 *
 * NUNCA es un gráfico de sectores: un sector muestra una foto y esta sección
 * trata de la película.
 *
 * El modo porcentaje divide entre el total de reportes DEL AÑO, no entre la
 * suma de las categorías. Un reporte puede registrar más de un tipo de
 * violencia, así que las categorías no suman 100 % y la interfaz lo dice en
 * vez de normalizar por la puerta de atrás.
 */

export type SerieDef = { clave: string; label: string; color: string };

export type PuntoSerie = {
  anio: string;
  total: number;
  pandemia?: boolean;
  parcial?: boolean;
  valores: Record<string, number>;
};

type Modo = "conteo" | "porcentaje";

export function SeriesTrend({
  series,
  puntos,
  alto = 260,
  notaPorcentaje,
}: {
  series: SerieDef[];
  puntos: PuntoSerie[];
  alto?: number;
  /** Qué significa el porcentaje. Obligatorio: sin esto el modo miente. */
  notaPorcentaje: string;
}) {
  const [modo, setModo] = useState<Modo>("conteo");
  const id = useId().replace(/:/g, "");

  const datos = puntos.map((p) => {
    const fila: Record<string, string | number | boolean | undefined> = {
      anio: p.anio,
      total: p.total,
      pandemia: p.pandemia,
      parcial: p.parcial,
    };
    for (const s of series) {
      const v = p.valores[s.clave] ?? 0;
      fila[s.clave] = modo === "conteo" ? v : p.total > 0 ? (v / p.total) * 100 : 0;
      fila[`${s.clave}__n`] = v;
    }
    return fila;
  });

  const pandemia = puntos.filter((p) => p.pandemia).map((p) => p.anio);
  const parcial = puntos.find((p) => p.parcial)?.anio;
  const vacio = puntos.every((p) => p.total === 0);

  if (vacio) {
    return (
      <p className="py-6 text-[0.88rem] text-ink-3">
        Sin reportes registrados en ningún año.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {/* Leyenda escrita: el color nunca viaja solo. */}
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {series.map((s) => (
            <li key={s.clave} className="flex items-center gap-2 text-[0.85rem] text-ink-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>

        <div
          role="group"
          aria-label="Unidad del gráfico"
          className="flex shrink-0 overflow-hidden rounded border border-rule"
        >
          {(
            [
              ["conteo", "Reportes"],
              ["porcentaje", "% del año"],
            ] as [Modo, string][]
          ).map(([v, t]) => (
            <button
              key={v}
              type="button"
              aria-pressed={modo === v}
              onClick={() => setModo(v)}
              className={`px-3 py-1.5 text-[0.82rem] transition-colors duration-150 ease-suave ${
                modo === v
                  ? "bg-surface font-medium text-ink"
                  : "text-ink-3 hover:bg-surface hover:text-ink-2"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: alto }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 14, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid stroke="var(--rule-2)" vertical={false} />
            <XAxis
              dataKey="anio"
              tickLine={false}
              axisLine={{ stroke: "var(--rule)" }}
              tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              interval="preserveStartEnd"
              minTickGap={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={50}
              allowDecimals={false}
              tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v: number) => (modo === "porcentaje" ? `${Math.round(v)} %` : String(v))}
            />

            {pandemia.length ? (
              <ReferenceArea
                x1={pandemia[0]}
                x2={pandemia[pandemia.length - 1]}
                fill="var(--ink-3)"
                fillOpacity={0.07}
                stroke="var(--ink-3)"
                strokeOpacity={0.25}
                strokeDasharray="3 3"
                label={{
                  value: "colegios cerrados",
                  position: "insideTop",
                  offset: 8,
                  style: { fill: "var(--ink-3)", fontSize: 10.5, fontFamily: "var(--font-sans)" },
                }}
              />
            ) : null}
            {parcial ? (
              <ReferenceArea
                x1={parcial}
                x2={parcial}
                fill="var(--ink-3)"
                fillOpacity={0.05}
                label={{
                  value: "en curso",
                  position: "insideTop",
                  offset: 8,
                  style: { fill: "var(--ink-3)", fontSize: 10.5, fontFamily: "var(--font-sans)" },
                }}
              />
            ) : null}

            <Tooltip
              cursor={{ stroke: "var(--rule)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = puntos.find((x) => x.anio === label);
                return (
                  <div className="rounded-lg border border-rule bg-surface-2 px-3.5 py-3 text-[0.82rem] shadow-sm">
                    <p className="font-medium text-ink">
                      {label}
                      {p?.pandemia ? (
                        <span className="ml-2 font-normal text-ink-3">colegios cerrados</span>
                      ) : p?.parcial ? (
                        <span className="ml-2 font-normal text-ink-3">año en curso</span>
                      ) : null}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {series.map((s) => {
                        const n = p?.valores[s.clave] ?? 0;
                        return (
                          <li key={s.clave} className="flex items-baseline gap-2.5">
                            <span
                              aria-hidden
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ background: s.color }}
                            />
                            <span className="text-ink-2">{s.label}</span>
                            <span className="tabular ml-auto pl-4 font-medium text-ink">
                              {modo === "porcentaje" && p && p.total > 0
                                ? `${dec((n / p.total) * 100, 1)} %`
                                : nf(n)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="tabular mt-2 border-t border-rule-2 pt-1.5 text-[0.76rem] text-ink-3">
                      {nf(p?.total ?? 0)} reportes en total
                    </p>
                  </div>
                );
              }}
            />

            {series.map((s) => (
              <Line
                key={s.clave}
                type="monotone"
                dataKey={s.clave}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2.4, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 4.5, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
                id={`${id}-${s.clave}`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {modo === "porcentaje" ? (
        <p className="mt-3 max-w-prose text-[0.78rem] leading-relaxed text-ink-3">
          {notaPorcentaje}
        </p>
      ) : null}
    </div>
  );
}
