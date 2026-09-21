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
import { useEsMovil } from "@/lib/useEsMovil";

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
 * COLUMNAS EN ESCRITORIO, BARRAS HORIZONTALES EN EL TELÉFONO.
 * En una pantalla ancha el año es el eje horizontal y los catorce grupos
 * caben de una vez. En 375 px no caben: el gráfico medía 952 px dentro de un
 * hueco de 343 y escondía seiscientos píxeles detrás de un scroll lateral que
 * nadie descubre. Girarlo resuelve el problema sin quitar un solo año —el
 * año pasa al eje vertical, las barras crecen hacia la derecha y el recorrido
 * se hace con el scroll de la página, que es el gesto natural del teléfono—.
 *
 * Es un cambio de PRESENTACIÓN: mismos datos, mismas series, mismos colores y
 * el mismo conmutador. No hay una segunda versión del componente.
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
  const movil = useEsMovil();

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

  // En vertical, cada grupo de año necesita su sitio: una banda por serie más
  // el aire entre grupos. Es lo que hace la pieza legible sin apretarla.
  const altoMovil = puntos.length * (series.length * 18 + 26) + 40;

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
              className={`min-h-11 px-3.5 text-[0.82rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:px-3 sm:py-1.5 ${
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

      <div style={{ height: movil ? altoMovil : alto }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={datos}
            layout={movil ? "vertical" : "horizontal"}
            margin={
              movil
                ? { top: 4, right: 14, bottom: 4, left: 2 }
                : { top: 16, right: 6, bottom: 4, left: -18 }
            }
            barCategoryGap={movil ? "18%" : "22%"}
            barGap={movil ? 2 : 3}
          >
            <CartesianGrid
              stroke="var(--rule-2)"
              vertical={movil}
              horizontal={!movil}
            />

            {/* Girar el gráfico intercambia el papel de los dos ejes: el de
                categorías pasa a ser el vertical y el numérico, el horizontal. */}
            <XAxis
              {...(movil
                ? {
                    type: "number" as const,
                    tickLine: false,
                    axisLine: false,
                    tickFormatter: (v: number) =>
                      modo === "porcentaje" ? `${Math.round(v)} %` : String(v),
                  }
                : {
                    type: "category" as const,
                    dataKey: "anio",
                    tickLine: false,
                    axisLine: { stroke: "var(--rule)" },
                    interval: 0,
                    minTickGap: 4,
                  })}
              tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            />
            <YAxis
              {...(movil
                ? {
                    type: "category" as const,
                    dataKey: "anio",
                    width: 42,
                    tickLine: false,
                    axisLine: { stroke: "var(--rule)" },
                    interval: 0,
                  }
                : {
                    type: "number" as const,
                    width: 50,
                    tickLine: false,
                    axisLine: false,
                    allowDecimals: false,
                    tickFormatter: (v: number) =>
                      modo === "porcentaje" ? `${Math.round(v)} %` : String(v),
                  })}
              tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
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
