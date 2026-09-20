"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { dec, nf } from "@/lib/format";
import { campo, meta as clsMeta } from "@/lib/ui";

/** [slug, nombre, gestión, nivel, matrícula, reportes, tasa, distrito, provincia, región] */
type Fila = [string, string, string, string, number, number, number, string, string, string];

type Punto = {
  slug: string;
  nombre: string;
  gestion: string;
  nivel: string;
  matricula: number;
  reportes: number;
  tasa: number;
  distrito: string;
  provincia: string;
  region: string;
};

/**
 * ¿Los colegios más grandes registran más reportes?
 *
 * La versión anterior era un scatter correcto que casi nadie sabía leer: la
 * mitad de la nube aplastada contra el eje, "ESCALA LOG" como etiqueta y
 * ninguna pista de qué se estaba mirando. Aquí el gráfico va acompañado de
 * cómo leerlo, de qué muestra y de qué no permite concluir, y todas las cifras
 * de esos textos se calculan de los mismos datos que se dibujan: si se filtra,
 * el texto cambia con el gráfico.
 *
 * La escala logarítmica se mantiene —la matrícula abarca dos órdenes de
 * magnitud y en lineal la nube se apelmaza— pero deja de ser protagonista: las
 * marcas del eje son cifras redondas y la advertencia va en letra pequeña.
 *
 * SIN SELECTOR DE AÑO, a propósito: la tasa solo existe para el año con
 * padrón de matrícula. Ofrecer otros años obligaría a dividir por un
 * denominador que no corresponde a ese año.
 */
const TICKS = [100, 200, 500, 1000, 2000, 5000, 10000];

function percentil(orden: number[], p: number): number {
  if (orden.length === 0) return 0;
  const i = (orden.length - 1) * p;
  const bajo = Math.floor(i);
  const alto = Math.ceil(i);
  // Interpolación lineal: con n par, la mediana es la media de los dos
  // valores centrales, no el de abajo. La diferencia es pequeña, pero el
  // número del gráfico y el del texto tienen que ser el mismo número.
  return bajo === alto ? orden[bajo] : orden[bajo] + (orden[alto] - orden[bajo]) * (i - bajo);
}

export function ScatterPanel({
  anio,
  matriculaMinima,
  alto = 400,
}: {
  anio: string;
  matriculaMinima: number;
  alto?: number;
}) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState(false);
  const [verCeros, setVerCeros] = useState(true);
  const [region, setRegion] = useState("");
  const [gestion, setGestion] = useState("");
  const [nivel, setNivel] = useState("");

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

  const todos = useMemo<Punto[]>(
    () =>
      (filas ?? [])
        .filter((f) => f[4] > 0)
        .map((f) => ({
          slug: f[0],
          nombre: f[1],
          gestion: f[2],
          nivel: f[3],
          matricula: f[4],
          reportes: f[5],
          tasa: f[6],
          distrito: f[7],
          provincia: f[8],
          region: f[9],
        })),
    [filas]
  );

  const universo = useMemo(
    () =>
      todos.filter(
        (p) =>
          (!region || p.region === region) &&
          (!gestion || p.gestion === gestion) &&
          (!nivel || p.nivel === nivel)
      ),
    [todos, region, gestion, nivel]
  );

  const puntos = verCeros ? universo : universo.filter((p) => p.reportes > 0);

  /**
   * Descriptivos del universo filtrado. Alimentan «Lo que vemos», así que se
   * recalculan con cada filtro: un texto que dijera 50,8 % mientras el gráfico
   * muestra Arequipa sería peor que no tener texto.
   */
  const d = useMemo(() => {
    const n = universo.length;
    if (n === 0) return null;
    const conReportes = universo.filter((p) => p.reportes > 0);
    const ceros = n - conReportes.length;
    const tasas = conReportes.map((p) => p.tasa).sort((a, b) => a - b);
    const p90 = percentil(tasas, 0.9);
    const altas = conReportes.filter((p) => p.tasa >= p90);
    const mats = altas.map((p) => p.matricula).sort((a, b) => a - b);
    const chicos = universo.filter((p) => p.matricula < 300);
    const grandes = universo.filter((p) => p.matricula >= 600);
    const cerosEn = (g: Punto[]) =>
      g.length ? (g.filter((p) => p.reportes === 0).length / g.length) * 100 : 0;
    const medianaDe = (g: Punto[]) => {
      const t = g.filter((p) => p.reportes > 0).map((p) => p.tasa).sort((a, b) => a - b);
      return t.length ? percentil(t, 0.5) : 0;
    };
    return {
      n,
      ceros,
      pctCeros: (ceros / n) * 100,
      conReportes: conReportes.length,
      mediana: percentil(tasas, 0.5),
      p90,
      max: tasas.length ? tasas[tasas.length - 1] : 0,
      altas: altas.length,
      matMedianaAltas: mats.length ? percentil(mats, 0.5) : 0,
      chicos: { n: chicos.length, ceros: cerosEn(chicos), mediana: medianaDe(chicos) },
      grandes: { n: grandes.length, ceros: cerosEn(grandes), mediana: medianaDe(grandes) },
    };
  }, [universo]);

  const opciones = useMemo(() => {
    const u = (f: (p: Punto) => string) =>
      [...new Set(todos.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    return { region: u((p) => p.region), gestion: u((p) => p.gestion), nivel: u((p) => p.nivel) };
  }, [todos]);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-6">
        <p className="text-[0.9rem] font-medium text-ink-2">No se pudo cargar el gráfico</p>
        <p className="mt-1.5 text-[0.84rem] text-ink-3">Revisa tu conexión y recarga la página.</p>
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

  const ticks = TICKS.filter(
    (t) => t >= Math.min(...universo.map((p) => p.matricula), 100) * 0.9 &&
           t <= Math.max(...universo.map((p) => p.matricula), 100) * 1.2
  );

  return (
    <div>
      {/* ── Cómo leerlo ─────────────────────────────────────────── */}
      <div className="grid gap-x-10 gap-y-7 border-y border-rule py-6 sm:grid-cols-2">
        <div>
          <p className={clsMeta}>Cómo leerlo</p>
          <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-2">
            Cada punto es un colegio.
          </p>
          <ul className="mt-2.5 space-y-1.5 text-[0.94rem] leading-relaxed text-ink-2">
            <li>
              <span aria-hidden className="mr-2 text-ink-3">
                →
              </span>
              Más a la derecha, más estudiantes.
            </li>
            <li>
              <span aria-hidden className="mr-2 text-ink-3">
                ↑
              </span>
              Más arriba, más reportes registrados por cada 1.000 estudiantes.
            </li>
          </ul>
        </div>

        <div>
          <p className={clsMeta}>¿Qué es «por cada 1.000 estudiantes»?</p>
          <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-2">
            Una forma de comparar colegios de distinto tamaño. Una tasa de 8 significa
            aproximadamente 8 reportes registrados por cada 1.000 estudiantes matriculados.
          </p>
          <p className="mt-2.5 text-[0.84rem] leading-relaxed text-ink-3">
            No significa que 8 de cada 1.000 estudiantes hayan sufrido violencia, ni que
            sean 8 personas o 8 casos distintos: son reportes registrados en SíseVe.
          </p>
        </div>
      </div>

      {/* ── Controles ───────────────────────────────────────────── */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Región", region, setRegion, opciones.region],
            ["Gestión", gestion, setGestion, opciones.gestion],
            ["Nivel", nivel, setNivel, opciones.nivel],
          ] as [string, string, (v: string) => void, string[]][]
        ).map(([label, valor, set, opts]) => (
          <div key={label}>
            <label htmlFor={`sc-${label}`} className={`${clsMeta} block`}>
              {label}
            </label>
            <select
              id={`sc-${label}`}
              value={valor}
              onChange={(e) => set(e.target.value)}
              className={`${campo} mt-1.5`}
            >
              <option value="">Todas</option>
              {opts.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.84rem] text-ink-2" role="status" aria-live="polite">
          <span className="tabular font-medium text-ink">{nf(puntos.length)}</span> colegios
          en el gráfico
          {d ? (
            <span className="text-ink-3">
              {" "}
              · {dec(d.pctCeros, 1)} % registró 0 reportes en {anio}
            </span>
          ) : null}
        </p>
        <label className="flex cursor-pointer items-center gap-2.5 text-[0.86rem] text-ink-2">
          <input
            type="checkbox"
            checked={verCeros}
            onChange={(e) => setVerCeros(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Mostrar colegios con 0 reportes
          {d ? <span className="tabular text-ink-3">({nf(d.ceros)})</span> : null}
        </label>
      </div>

      {/* ── El gráfico ──────────────────────────────────────────── */}
      <figure className="mt-5">
        <div style={{ height: alto }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 14, bottom: 42, left: 8 }}>
              <CartesianGrid stroke="var(--rule-3)" />
              <XAxis
                type="number"
                dataKey="matricula"
                scale="log"
                domain={["auto", "auto"]}
                allowDataOverflow
                ticks={ticks.length >= 3 ? ticks : undefined}
                tickLine={false}
                axisLine={{ stroke: "var(--rule)" }}
                tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                label={{
                  value: "MATRÍCULA",
                  position: "insideBottom",
                  offset: -22,
                  style: {
                    fill: "var(--ink-3)",
                    fontSize: 10.5,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.09em",
                  },
                }}
              />
              <YAxis
                type="number"
                dataKey="tasa"
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              />
              <ZAxis range={[24, 24]} />

              {d && d.mediana > 0 ? (
                <ReferenceLine
                  y={d.mediana}
                  stroke="var(--ink-3)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  label={{
                    value: `mediana con ≥1 reporte: ${dec(d.mediana, 1)}`,
                    position: "right",
                    style: {
                      fill: "var(--ink-3)",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                    },
                  }}
                />
              ) : null}

              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "var(--ink-3)" }}
                wrapperStyle={{ pointerEvents: "auto" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Punto;
                  return (
                    <div className="max-w-[17rem] rounded-lg border border-rule bg-surface-2 p-3.5 shadow-lg shadow-black/10">
                      <p className="text-[0.92rem] font-medium leading-snug text-ink">
                        {p.nombre}
                      </p>
                      <p className="mt-0.5 text-[0.76rem] text-ink-3">
                        {p.distrito}
                        {p.provincia && p.provincia !== p.distrito ? ` · ${p.provincia}` : ""}
                        {p.region ? ` · ${p.region}` : ""}
                      </p>
                      <p className="mt-0.5 text-[0.76rem] text-ink-3">
                        {p.nivel} · {p.gestion}
                      </p>

                      <dl className="mt-3 space-y-1.5 border-t border-rule-3 pt-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[0.8rem] text-ink-2">Matrícula</dt>
                          <dd className="tabular text-[0.88rem] font-medium">
                            {nf(p.matricula)}{" "}
                            <span className="text-[0.74rem] font-normal text-ink-3">
                              estudiantes
                            </span>
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[0.8rem] text-ink-2">Reportes registrados</dt>
                          <dd className="tabular text-[0.88rem] font-medium">
                            {nf(p.reportes)}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[0.8rem] text-ink-2">Tasa</dt>
                          <dd className="tabular text-[0.88rem] font-medium">
                            {dec(p.tasa, 1)}{" "}
                            <span className="text-[0.74rem] font-normal text-ink-3">
                              por 1.000
                            </span>
                          </dd>
                        </div>
                      </dl>

                      <p className="mt-2.5 text-[0.72rem] leading-snug text-ink-3">
                        {p.reportes === 0
                          ? `Ningún reporte registrado en ${anio}. No significa que no haya ocurrido nada.`
                          : `Son ${nf(p.reportes)} reportes registrados en ${anio}, no necesariamente ${nf(p.reportes)} personas ni ${nf(p.reportes)} casos distintos.`}
                      </p>

                      <p className="mt-2.5 border-t border-rule-3 pt-2 text-[0.8rem] font-medium text-accent">
                        Ver colegio →
                      </p>
                    </div>
                  );
                }}
              />

              <Scatter
                data={puntos}
                fill="var(--data-1)"
                fillOpacity={0.4}
                stroke="var(--surface)"
                strokeWidth={0.5}
                isAnimationActive={false}
                onClick={(p: unknown) => {
                  const d2 = p as Punto | undefined;
                  if (d2?.slug) window.location.href = `/colegio/${d2.slug}`;
                }}
                className="cursor-pointer"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <figcaption className="mt-2 text-[0.78rem] leading-relaxed text-ink-3">
          Eje vertical: reportes registrados por cada 1.000 estudiantes en {anio}. Eje
          horizontal: matrícula, en escala logarítmica para que quepan en el mismo gráfico
          colegios de 100 y de 2.500 estudiantes. La línea punteada es la mediana{" "}
          <strong className="font-semibold text-ink-2">
            calculada solo entre los colegios que registraron al menos un reporte
          </strong>
          ; la del universo completo sería 0, porque más de la mitad no registró ninguno.
          Pasa el cursor por un punto para ver el colegio, o haz clic para abrir su ficha.
        </figcaption>
      </figure>

      {/* ── Lo que vemos ────────────────────────────────────────── */}
      {d ? (
        <div className="mt-9 grid gap-x-10 gap-y-7 border-t border-rule pt-7 sm:grid-cols-2">
          <div>
            <p className={clsMeta}>Lo que vemos</p>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-2">
              De los {nf(d.n)} colegios de este universo,{" "}
              <strong className="font-semibold text-ink">
                {nf(d.ceros)} ({dec(d.pctCeros, 1)} %)
              </strong>{" "}
              no registraron ningún reporte en {anio}. Es la situación más frecuente, y por
              eso la franja inferior del gráfico está tan poblada.
            </p>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-2">
              Entre los {nf(d.conReportes)} que sí registraron alguno —y solo entre
              ellos— la mitad queda por debajo de{" "}
              <strong className="font-semibold text-ink">{dec(d.mediana, 1)}</strong> reportes
              por 1.000 estudiantes. Una décima parte supera{" "}
              {dec(d.p90, 1)}, y el valor más alto llega a {dec(d.max, 1)}.
            </p>
            {d.chicos.n > 30 && d.grandes.n > 30 ? (
              <>
              <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-2">
                Los colegios de menos de 300 estudiantes registraron cero reportes con mayor
                frecuencia ({dec(d.chicos.ceros, 1)} %) que los de 600 o más (
                {dec(d.grandes.ceros, 1)} %). Entre los colegios que registraron al menos un
                reporte, la tasa mediana fue de {dec(d.chicos.mediana, 1)} frente a{" "}
                {dec(d.grandes.mediana, 1)} por cada 1.000 estudiantes.
              </p>
              <p className="mt-3 text-[0.88rem] leading-relaxed text-ink-3">
                Esta es una diferencia observada en los datos. No permite determinar por qué
                ocurre ni concluir que exista más o menos violencia en uno de los grupos.
              </p>
              </>
            ) : null}
          </div>

          <div>
            <p className={clsMeta}>Lo que este gráfico no nos dice</p>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-2">
              Esta comparación no permite determinar que el tamaño de un colegio cause más o
              menos reportes. Los reportes también pueden estar relacionados con el contexto
              institucional, las características del alumnado, el territorio y la capacidad
              de reportar de cada comunidad educativa.
            </p>
            <p className="mt-3 text-[0.84rem] leading-relaxed text-ink-3">
              Tampoco dice dónde hay más violencia. Un colegio en la parte baja del gráfico
              puede ser uno donde nada se reporta.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-7 border-t border-rule pt-7 text-[0.9rem] text-ink-3">
          Ningún colegio cumple estos filtros.
        </p>
      )}
    </div>
  );
}
