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

/**
 * Matrícula frente a tasa de reportes.
 *
 * Eje X logarítmico porque el tamaño de los colegios abarca dos órdenes de
 * magnitud: en escala lineal el 90 % de los puntos se apelmaza contra el eje.
 */
export function ScatterSizeRate({ data, alto = 360 }: { data: CrossRow[]; alto?: number }) {
  // Se incluyen los colegios con tasa 0: son la mayoría y quedan sobre el eje.
  // Filtrarlos sería seleccionar sobre el resultado y haría parecer que todo
  // colegio tiene reportes.
  const puntos = data.filter((d) => d.matricula > 0);

  return (
    <div style={{ height: alto }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 12, bottom: 34, left: 4 }}>
          <CartesianGrid stroke="var(--rule-2)" />
          <XAxis
            type="number"
            dataKey="matricula"
            scale="log"
            domain={["auto", "auto"]}
            allowDataOverflow
            name="Matrícula"
            tickLine={false}
            axisLine={{ stroke: "var(--rule)" }}
            tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            label={{
              value: "MATRÍCULA (ESCALA LOG)",
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
            name="Reportes por 1,000"
            tickLine={false}
            axisLine={false}
            width={46}
            tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
          <ZAxis range={[26, 26]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--ink-3)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              fontSize: 12.5,
            }}
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
