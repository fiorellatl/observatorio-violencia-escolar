"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { dec, nf } from "@/lib/format";
import type { CrossRow } from "@/lib/types";

type ClaveX = "matricula" | "pension";

/**
 * Dispersión de colegios: una variable del colegio frente a su tasa de reportes.
 *
 * El eje X va en escala logarítmica porque tanto la matrícula como la pensión
 * abarcan dos órdenes de magnitud; en escala lineal la mayoría de los puntos se
 * apelmaza contra el eje y el gráfico deja de informar.
 */
export function ScatterXY({
  data,
  xKey,
  xLabel,
  formatoX,
  alto = 360,
}: {
  data: CrossRow[];
  xKey: ClaveX;
  xLabel: string;
  formatoX?: (v: number) => string;
  alto?: number;
}) {
  const puntos = data.filter((d) => {
    const x = d[xKey];
    return typeof x === "number" && x > 0;
  });

  const fmt =
    formatoX ?? ((v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)));

  return (
    <div style={{ height: alto }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 12, bottom: 34, left: 4 }}>
          <CartesianGrid stroke="var(--rule-2)" />
          <XAxis
            type="number"
            dataKey={xKey}
            scale="log"
            domain={["auto", "auto"]}
            allowDataOverflow
            tickLine={false}
            axisLine={{ stroke: "var(--rule)" }}
            tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickFormatter={fmt}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -18,
              style: {
                fill: "var(--ink-3)",
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em",
              },
            }}
          />
          <YAxis
            type="number"
            dataKey="tasa"
            tickLine={false}
            axisLine={false}
            width={46}
            tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
          <ZAxis range={[26, 26]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--ink-3)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as CrossRow;
              return (
                <div className="rounded-lg border border-rule bg-surface px-3 py-2 text-[0.78rem] shadow-sm">
                  <p className="font-semibold text-ink">{d.nombre}</p>
                  <p className="text-ink-3">
                    {d.distrito} · {d.gestion}
                  </p>
                  <p className="tabular mt-1 font-mono text-ink-2">
                    {nf(d.matricula)} estudiantes · {nf(d.reportes)} reportes
                  </p>
                  {d.pension ? (
                    <p className="tabular font-mono text-ink-2">
                      Pensión S/ {nf(d.pension)}
                    </p>
                  ) : null}
                  <p className="tabular font-mono font-semibold text-ink">
                    {dec(d.tasa, 1)} por 1,000
                  </p>
                </div>
              );
            }}
          />
          <Scatter
            data={puntos}
            fill="var(--data-1)"
            fillOpacity={0.45}
            stroke="var(--surface)"
            strokeWidth={0.5}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
