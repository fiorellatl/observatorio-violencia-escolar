"use client";

import {
  Bar,
  BarChart,
  Cell,
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
 * 2020 y 2021 se pintan huecos, no de color: los colegios estuvieron cerrados y
 * la caída no significa menos violencia. El último año va rayado porque es
 * parcial. La diferencia es de forma, no solo de color, para que se lea también
 * en escala de grises.
 */
export function ReportTrend({ data, alto = 230 }: { data: TrendPoint[]; alto?: number }) {
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
          <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell
                key={d.anio}
                fill={d.pandemia ? "transparent" : d.parcial ? "url(#rayas)" : "var(--data-1)"}
                stroke={d.pandemia ? "var(--ink-3)" : "none"}
                strokeWidth={d.pandemia ? 1.5 : 0}
                strokeDasharray={d.pandemia ? "3 2" : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
