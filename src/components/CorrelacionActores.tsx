"use client";

import { useState } from "react";
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
import { COLOR_ACTOR, color } from "@/lib/viz/colors";
import { useEsMovil } from "@/lib/useEsMovil";

export interface DatosCorrelacion {
  anios: string[];
  anio_parcial: string;
  datos: Record<
    string,
    { puntos: [number, number, number][]; colegios: number; r: number | null; ambos: number }
  >;
}

/**
 * ¿Los colegios que registran violencia entre alumnos registran también
 * violencia de un adulto?
 *
 * CADA MARCA ES UN PAR DE VALORES, NO UN COLEGIO, y esa es la decisión de
 * diseño que hay que entender. Los conteos son enteros pequeños y se repiten
 * muchísimo: en 2025 los 6.134 colegios ocupan 198 posiciones distintas y el
 * par (1, 0) reúne a 1.451 de ellos. Dibujar 6.134 marcas sobre 198 sitios
 * escondería al 97 % debajo de la de encima, y el gráfico aparentaría
 * doscientos colegios en vez de seis mil. Aquí el tamaño de la marca dice
 * cuántos colegios hay en ese punto, que es la información que el
 * solapamiento destruía.
 *
 * LA CORRELACIÓN SE CALCULA SOBRE LOS COLEGIOS, no sobre las marcas: cada par
 * pesa tantas veces como colegios agrupa. El gráfico agrupa, la estadística
 * no.
 *
 * EL UNIVERSO SON LOS COLEGIOS CON AL MENOS UN REPORTE ESE AÑO. Incluir a los
 * que no registraron nada triplicaría la r —de 0,108 a 0,291 en 2025— sin que
 * exista ninguna relación nueva: solo añade once mil puntos en el origen. Un
 * colegio sin reportes tampoco es un cero comparable, porque los datos no
 * distinguen «no ocurrió nada» de «no hay quien registre».
 */
export function CorrelacionActores({ datos }: { datos: DatosCorrelacion }) {
  const movil = useEsMovil();
  const [anio, setAnio] = useState(
    datos.anios.filter((a) => a !== datos.anio_parcial).slice(-1)[0] ?? datos.anios[0]
  );
  const d = datos.datos[anio];

  const cAlumnos = color(COLOR_ACTOR.entre_escolares);
  const filas = d.puntos.map(([x, y, n]) => ({ x, y, n }));
  const maxN = Math.max(...d.puntos.map((p) => p[2]), 1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div
          role="group"
          aria-label="Año"
          className="flex overflow-hidden rounded border border-rule"
        >
          {datos.anios.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={anio === a}
              onClick={() => setAnio(a)}
              className={`tabular min-h-11 px-3 text-[0.84rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:py-2 ${
                anio === a
                  ? "bg-surface font-medium text-ink"
                  : "text-ink-3 hover:bg-surface hover:text-ink-2"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="text-[0.8rem] text-ink-3">
          {nf(d.colegios)} colegios con al menos un reporte
          {anio === datos.anio_parcial ? " · año en curso" : ""}
        </p>
      </div>

      {/* La cifra que responde la pregunta, antes del gráfico: r cercano a
          cero significa que saber cuánto registra un colegio de un tipo no
          dice casi nada sobre el otro. */}
      <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <p className="flex items-baseline gap-2.5">
          <span className="meta">Correlación (r)</span>
          <span className="cifra text-cifra-l text-ink">{dec(d.r ?? 0, 2)}</span>
        </p>
        <p className="max-w-[46ch] text-[0.9rem] leading-snug text-ink-2">
          {Math.abs(d.r ?? 0) < 0.2
            ? "Casi ninguna asociación: los colegios que más registran violencia entre alumnos no son los que más registran violencia de un adulto."
            : "Hay una asociación débil entre ambos registros."}
        </p>
      </div>

      <div style={{ height: movil ? 320 : 380 }} className="mt-6 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 14, bottom: 42, left: 4 }}>
            <CartesianGrid stroke="var(--rule-2)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Entre alumnos"
              tickLine={false}
              axisLine={{ stroke: "var(--rule)" }}
              tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              label={{
                value: "Reportes entre alumnos",
                position: "insideBottom",
                offset: -18,
                style: { fill: "var(--ink-2)", fontSize: 12, fontFamily: "var(--font-sans)" },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="De un adulto"
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              label={{
                value: "De un adulto",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--ink-2)", fontSize: 12, fontFamily: "var(--font-sans)" },
              }}
            />
            {/* El área dice cuántos colegios hay en ese punto. */}
            <ZAxis type="number" dataKey="n" range={[18, 520]} domain={[1, maxN]} />

            <Tooltip
              cursor={{ stroke: "var(--rule)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { x: number; y: number; n: number };
                return (
                  <div className="rounded-lg border border-rule bg-surface-2 px-3.5 py-3 text-[0.82rem] shadow-sm">
                    <p className="cifra text-[1.05rem] text-ink">{nf(p.n)}</p>
                    <p className="text-ink-2">
                      {p.n === 1 ? "colegio" : "colegios"} con
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-ink-2">
                      <li>
                        <span className="tabular font-medium text-ink">{nf(p.x)}</span> entre
                        alumnos
                      </li>
                      <li>
                        <span className="tabular font-medium text-ink">{nf(p.y)}</span> de un
                        adulto
                      </li>
                    </ul>
                  </div>
                );
              }}
            />
            <Scatter data={filas} fill={cAlumnos} fillOpacity={0.45} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 max-w-prose text-[0.78rem] leading-relaxed text-ink-3">
        Cada círculo agrupa a los colegios con los mismos dos valores y su tamaño dice cuántos
        son: {nf(d.colegios)} colegios caben en {nf(d.puntos.length)} posiciones. Solo entran
        los que registraron algo ese año —quien no registró nada no aporta un cero comparable— y{" "}
        {dec((d.ambos / d.colegios) * 100, 0)} % registró los dos tipos.
      </p>
    </div>
  );
}
