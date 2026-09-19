"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { nf } from "@/lib/format";

export interface TrendPoint {
  anio: string;
  total: number;
  pandemia?: boolean;
  parcial?: boolean;
}

/**
 * Reportes por año.
 *
 * 2020 y 2021 van bajo una franja sombreada y rotulada: los colegios estuvieron
 * cerrados y la caída no significa menos violencia. El último año va rayado
 * porque es parcial. Las tres diferencias son de forma además de color, para que
 * se lean también en escala de grises.
 */
export function ReportTrend({ data, alto = 230 }: { data: TrendPoint[]; alto?: number }) {
  // Los años de pandemia caen tan bajo que una barra hueca de 6 px no se ve, y
  // son justo los que hay que señalar. Se sombrea la franja completa: lo que
  // debe leerse es el hueco, no la barra.
  const pandemia = data.filter((d) => d.pandemia).map((d) => d.anio);
  const desde = pandemia[0];
  const hasta = pandemia[pandemia.length - 1];

  return (
    <div style={{ height: alto }} className="w-full">
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern id="rayas" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="var(--data-1)" fillOpacity="0.18" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--data-1)" strokeWidth="2.5" />
          </pattern>
        </defs>
      </svg>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 4, left: -18 }}>
          <XAxis
            dataKey="anio"
            tickLine={false}
            axisLine={{ stroke: "var(--rule)" }}
            tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: "var(--rule-2)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              fontSize: 12.5,
              color: "var(--ink)",
            }}
            labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
            formatter={(v: number) => [nf(v), "reportes"]}
            labelFormatter={(l: string) => {
              const p = data.find((d) => d.anio === l);
              if (p?.pandemia) return `${l} · colegios cerrados`;
              if (p?.parcial) return `${l} · año incompleto`;
              return l;
            }}
          />
          {desde ? (
            <ReferenceArea
              x1={desde}
              x2={hasta}
              fill="var(--ink-3)"
              fillOpacity={0.09}
              stroke="var(--ink-3)"
              strokeOpacity={0.3}
              strokeDasharray="3 3"
              label={{
                value: "colegios cerrados",
                position: "insideTop",
                offset: 10,
                style: {
                  fill: "var(--ink-3)",
                  fontSize: 10.5,
                  fontFamily: "var(--font-sans)",
                },
              }}
            />
          ) : null}
          <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell
                key={d.anio}
                fill={
                  d.pandemia
                    ? "var(--ink-3)"
                    : d.parcial
                      ? "url(#rayas)"
                      : "var(--data-1)"
                }
                fillOpacity={d.pandemia ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
