"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { ChartTooltip } from "@/components/ChartTooltip";
import { dec, nf } from "@/lib/format";
import { boton } from "@/lib/ui";

/** [slug, nombre, gestión, nivel, matrícula, reportes, tasa] */
type Fila = [string, string, string, string, number, number, number];

type Punto = {
  slug: string;
  nombre: string;
  gestion: string;
  nivel: string;
  matricula: number;
  reportes: number;
  tasa: number;
};

/**
 * Dispersión de colegios: matrícula frente a tasa de reportes.
 *
 * Se descarga sus propios datos en vez de recibirlos por props. Cuando
 * viajaban dentro del HTML, /datos pesaba 976 KB y los pagaba cualquiera que
 * abriera la página, llegara o no hasta aquí.
 *
 * El eje X va en escala logarítmica: la matrícula abarca dos órdenes de
 * magnitud y en escala lineal casi todos los puntos se apelmazan contra el eje.
 *
 * Los colegios con cero reportes se muestran por defecto. Son parte del
 * fenómeno —y son la mitad de la nube—; esconderlos haría parecer que todo
 * colegio registra algo.
 */
export function ScatterPanel({
  anio,
  matriculaMinima,
  alto = 380,
}: {
  anio: string;
  matriculaMinima: number;
  alto?: number;
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState(false);
  const [verCeros, setVerCeros] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetch("/data/cross-2024.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Fila[]>;
      })
      .then((d) => vivo && setFilas(d))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);

  const { puntos, ceros } = useMemo(() => {
    if (!filas) return { puntos: [] as Punto[], ceros: 0 };
    const todos: Punto[] = filas
      .filter((f) => f[4] > 0)
      .map((f) => ({
        slug: f[0],
        nombre: f[1],
        gestion: f[2],
        nivel: f[3],
        matricula: f[4],
        reportes: f[5],
        tasa: f[6],
      }));
    return {
      puntos: verCeros ? todos : todos.filter((p) => p.reportes > 0),
      ceros: todos.filter((p) => p.reportes === 0).length,
    };
  }, [filas, verCeros]);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-6">
        <p className="text-[0.88rem] text-ink-2">No se pudo cargar el gráfico.</p>
        <p className="mt-1 text-[0.82rem] text-ink-3">Revisa tu conexión y recarga.</p>
      </div>
    );
  }

  if (!filas) {
    return (
      <div
        style={{ height: alto }}
        className="flex w-full items-center justify-center rounded-lg border border-rule-2"
      >
        <p className="text-[0.85rem] text-ink-3">Cargando el gráfico…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-[0.82rem] text-ink-3">
          {nf(puntos.length)} colegios
        </p>
        <button
          type="button"
          onClick={() => setVerCeros((v) => !v)}
          aria-pressed={verCeros}
          className={boton}
        >
          <span
            aria-hidden
            className={`h-2.5 w-2.5 rounded-sm border ${
              verCeros ? "border-accent bg-accent" : "border-rule"
            }`}
          />
          Mostrar colegios sin reportes
          <span className="tabular text-ink-3">({nf(ceros)})</span>
        </button>
      </div>

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
              tickLine={false}
              axisLine={{ stroke: "var(--rule)" }}
              tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              label={{
                value: "ESTUDIANTES MATRICULADOS (ESCALA LOGARÍTMICA)",
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
              label={{
                value: "REPORTES POR 1,000",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: {
                  fill: "var(--ink-3)",
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.08em",
                  textAnchor: "middle",
                },
              }}
            />
            <ZAxis range={[26, 26]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "var(--ink-3)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Punto;
                return (
                  <ChartTooltip
                    titulo={`${d.nombre} · ${anio}`}
                    filas={[
                      { label: "Reportes registrados", valor: d.reportes },
                      { label: "Estudiantes", valor: d.matricula },
                      { label: "Tasa", valor: d.tasa, decimales: 1, sufijo: "/1.000" },
                    ]}
                    nota={`${d.nivel} · ${d.gestion}`}
                    fuente="SíseVe + ESCALE"
                  />
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
              onClick={(p: unknown) => {
                const d = p as Punto | undefined;
                if (d?.slug) router.push(`/colegio/${d.slug}`);
              }}
              className="cursor-pointer"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[0.78rem] text-ink-3">
        Cada punto es un colegio con matrícula de al menos {nf(matriculaMinima)}{" "}
        estudiantes. Haz clic en un punto para abrir su ficha. La mediana de los que sí
        registran reportes está en{" "}
        <span className="tabular">
          {dec(
            (() => {
              const v = puntos.filter((p) => p.tasa > 0).map((p) => p.tasa).sort((a, b) => a - b);
              return v.length ? v[Math.floor(v.length / 2)] : 0;
            })(),
            1
          )}
        </span>{" "}
        por 1.000.
      </p>
    </div>
  );
}
