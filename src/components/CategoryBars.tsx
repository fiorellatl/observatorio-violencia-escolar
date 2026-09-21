"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dec, nf } from "@/lib/format";

/**
 * Categorías comparadas año a año, en barras agrupadas.
 *
 * POR QUÉ NO UNA LÍNEA. Una línea dibuja una trayectoria continua y sugiere
 * que entre 2022 y 2023 hubo un recorrido: aquí no lo hay. Lo que existe son
 * conteos anuales discretos, y cada uno es una medición independiente. La
 * barra dice exactamente eso —esta cantidad, este año— y deja comparar
 * categorías dentro del año, que es la pregunta de estas dos secciones.
 *
 * POR QUÉ AGRUPADAS Y NO APILADAS AL 100 %. Las dos familias de categorías
 * —tipo de violencia y presunto agresor— SÍ reparten el total: se comprobó
 * contra la capa pública que cada una suma exactamente el total del año en
 * los 46.921 año-colegio con reportes, sin una sola excepción, en los catorce
 * años. Una apilada normalizada sería por tanto legítima, y aun así no se usa:
 * borra la magnitud. Sobre una apilada al 100 %, un año con 173 reportes y uno
 * con 5 se ven idénticos, y esta sección trata justamente de cómo cambia el
 * volumen. La composición se lee igual de bien con el conmutador de «% del
 * año», que no sacrifica la escala.
 *
 * POR QUÉ COLUMNAS Y NO BARRAS HORIZONTALES. Con trece años y tres
 * categorías, agrupar en horizontal da treinta y nueve filas apiladas: en un
 * teléfono, un scroll interminable. En columnas el año es el eje y la pieza
 * cabe de una vez; cuando no cabe, se desplaza en horizontal con el ancho
 * mínimo que cada grupo necesita para seguir siendo legible.
 *
 * El modo porcentaje divide entre el total de reportes DEL AÑO. Cuando un año
 * no tiene reportes no hay porcentaje que calcular: se muestra el conteo antes
 * que un 0 % inventado.
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

export function CategoryBars({
  series,
  puntos,
  alto = 300,
}: {
  series: SerieDef[];
  puntos: PuntoSerie[];
  alto?: number;
}) {
  const [modo, setModo] = useState<Modo>("conteo");

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
    }
    return fila;
  });

  const pandemia = puntos.filter((p) => p.pandemia).map((p) => p.anio);
  const parcial = puntos.find((p) => p.parcial)?.anio;

  if (puntos.every((p) => p.total === 0)) {
    return (
      <p className="py-6 text-[0.88rem] text-ink-3">
        Sin reportes registrados en ningún año.
      </p>
    );
  }

  // Ancho mínimo por grupo de año: por debajo de esto las barras dejan de
  // distinguirse y el eje se convierte en una mancha.
  const minimo = puntos.length * (series.length * 14 + 26);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {/* Leyenda escrita: el color nunca viaja solo. */}
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {series.map((s) => (
            <li key={s.clave} className="flex items-center gap-2 text-[0.88rem] text-ink-2">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-[2px]"
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

      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div style={{ height: alto, minWidth: `max(100%, ${minimo}px)` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datos}
              margin={{ top: 16, right: 6, bottom: 4, left: -18 }}
              barCategoryGap="22%"
              barGap={3}
            >
              <CartesianGrid stroke="var(--rule-2)" vertical={false} />
              <XAxis
                dataKey="anio"
                tickLine={false}
                axisLine={{ stroke: "var(--rule)" }}
                tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                interval={0}
                minTickGap={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={50}
                allowDecimals={false}
                tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                tickFormatter={(v: number) =>
                  modo === "porcentaje" ? `${Math.round(v)} %` : String(v)
                }
              />

              {pandemia.length ? (
                <ReferenceArea
                  x1={pandemia[0]}
                  x2={pandemia[pandemia.length - 1]}
                  fill="var(--ink-3)"
                  fillOpacity={0.07}
                  label={{
                    value: "colegios cerrados",
                    position: "insideTop",
                    offset: 6,
                    style: {
                      fill: "var(--ink-3)",
                      fontSize: 10.5,
                      fontFamily: "var(--font-sans)",
                    },
                  }}
                />
              ) : null}

              <Tooltip
                cursor={{ fill: "var(--rule-2)", fillOpacity: 0.5 }}
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
                        {nf(p?.total ?? 0)} reportes registrados ese año
                      </p>
                    </div>
                  );
                }}
              />

              {series.map((s) => (
                <Bar key={s.clave} dataKey={s.clave} name={s.label} isAnimationActive={false}>
                  {/* Los años cerrados van atenuados también en la barra: la
                      franja de fondo sola se pierde al desplazarse en lateral. */}
                  {datos.map((d, i) => (
                    <Cell key={i} fill={s.color} fillOpacity={d.pandemia ? 0.35 : 1} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {parcial ? (
        <p className="mt-3 text-[0.78rem] text-ink-3">
          {parcial} es un año en curso: no es comparable con uno cerrado.
        </p>
      ) : null}

      {modo === "porcentaje" ? (
        <p className="mt-3 text-[0.78rem] text-ink-3">
          Sobre el total de reportes registrados ese año.
        </p>
      ) : null}
    </div>
  );
}
