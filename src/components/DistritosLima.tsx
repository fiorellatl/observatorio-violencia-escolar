"use client";

import { useMemo, useState } from "react";
import { PiezaNoche } from "@/components/PiezaNoche";
import { ShareImage } from "@/components/ShareImage";
import type { DistritosLima as Datos } from "@/lib/hallazgos";
import {
  RAMPA,
  SIN_DATO,
  dibujarConcentracion,
  dibujarMapaDistritos,
  dibujarRankingDistritos,
  periodo,
  type DistritoTasa,
} from "@/lib/share/datos";

/**
 * Los distritos de Lima: mapa de calor, ranking y reparto, con filtro de año.
 *
 * Las tres piezas comparten el filtro porque cuentan lo mismo desde tres
 * lados: dónde se registra más por alumno, en qué orden, y si eso es
 * concentración o solo tamaño. Cada una se descarga como historia de
 * Instagram con el año elegido.
 *
 * EL COLOR MARCA EL CUARTO DE LA TABLA DE ESE AÑO, no tramos fijos: 2026 va
 * de enero a agosto y con tramos pensados para un año completo casi todo
 * caía en el más oscuro. La leyenda escribe los cortes de cada año.
 */

const dec = (v: number) => v.toFixed(1).replace(".", ",");
const miles = (n: number) => n.toLocaleString("en-US").replace(/,/g, ".");

export function DistritosLima({ datos, anioInicial, anioParcial }: { datos: Datos; anioInicial: string; anioParcial: string }) {
  const anios = Object.keys(datos.anios).sort();
  const [anio, setAnio] = useState(anioInicial);
  const parcial = anio === anioParcial;
  const { filas, total } = datos.anios[anio];

  const v = useMemo(() => {
    const con = filas.filter((f): f is typeof f & { tasa: number } => f.tasa != null).sort((a, b) => b.tasa - a.tasa);
    const sin = filas.filter((f) => f.tasa == null).map((f) => f.nombre).sort((a, b) => a.localeCompare(b, "es"));
    // Cuartos de la tabla: el primer cuarto es el tono más claro.
    const cuarto = new Map(con.map((f, k) => [f.nombre, Math.min(3, Math.floor((4 * (con.length - 1 - k)) / con.length))]));
    const color = (n: string) => {
      const q = cuarto.get(n);
      return q == null ? SIN_DATO : RAMPA[q];
    };
    const rangos = [0, 1, 2, 3].map((q) => {
      const t = con.filter((f) => cuarto.get(f.nombre) === q).map((f) => f.tasa);
      return t.length ? `${dec(Math.min(...t))}–${dec(Math.max(...t))}` : "—";
    });
    const reparto = [...filas].sort((a, b) => b.pctReportes - a.pctReportes);
    const top10 = reparto.slice(0, 10);
    return {
      con: con as DistritoTasa[],
      sin,
      color,
      rangos,
      reparto,
      top10: {
        reportes: top10.reduce((s, f) => s + f.pctReportes, 0),
        alumnos: top10.reduce((s, f) => s + f.pctAlumnos, 0),
      },
    };
  }, [filas]);

  const maximo = v.con[0];
  const minimo = v.con[v.con.length - 1];
  const muestra = v.reparto.slice(0, 12);
  const resto = {
    n: v.reparto.length - 12,
    pctReportes: v.reparto.slice(12).reduce((s, f) => s + f.pctReportes, 0),
    pctAlumnos: v.reparto.slice(12).reduce((s, f) => s + f.pctAlumnos, 0),
  };
  const ctx = { anio, bloque: "distritos" };

  const filtro = (
    <div role="group" aria-label="Año" className="flex flex-wrap gap-2">
      {anios.map((a) => (
        <button
          key={a}
          type="button"
          aria-pressed={a === anio}
          onClick={() => setAnio(a)}
          className={`min-h-11 rounded-full border px-4 text-[0.9rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:py-1.5 ${
            a === anio ? "border-ink bg-ink font-medium text-paper" : "border-rule text-ink-2 hover:border-ink-3"
          }`}
        >
          {a === anioParcial ? `${a} (ene–ago)` : a}
        </button>
      ))}
    </div>
  );

  const nota = (
    <>
      Tasa: reportes de {periodo(anio, parcial)} por cada 1.000 alumnos del Censo Educativo 2024, el último
      publicado. Solo hay tasa con al menos 10 colegios y 20 reportes; sin datos suficientes:{" "}
      {v.sin.join(", ")}.{parcial ? " Año en curso: no se compara con un año completo." : ""} Más reportes no
      prueba más violencia: prueba que ahí se denuncia más.
    </>
  );

  return (
    <div className="space-y-6">
      {filtro}

      {/* ── Mapa de calor ─────────────────────────────────────────── */}
      <PiezaNoche
        antetitulo={`Reportes por alumno · Lima · ${periodo(anio, parcial)}`}
        titulo={
          <>
            ¿Qué distrito de Lima registra más reportes de <span className="text-menta">violencia escolar</span> por
            alumno?
          </>
        }
        respuesta={
          <>
            {maximo.nombre}: <span className="text-menta">{dec(maximo.tasa)}</span> por cada 1.000 alumnos.{" "}
            {minimo.nombre}: {dec(minimo.tasa)}.
          </>
        }
        nota={nota}
      >
        <div className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            {[maximo, minimo].map((d, i) => (
              <div key={d.nombre}>
                <p className="meta-noche !text-noche-ink">{d.nombre}</p>
                <p className={`cifra mt-1 ${i ? "text-[2.4rem] text-noche-ink" : "text-[4rem] text-menta"}`}>{dec(d.tasa)}</p>
                <p className="mt-1 font-mono text-[0.72rem] text-noche-ink-2">
                  por cada 1.000 alumnos · {miles(d.reportes)} reportes · {miles(d.alumnos)} alumnos
                </p>
              </div>
            ))}
            <ul className="space-y-1.5" aria-label="Leyenda">
              {RAMPA.map((c, i) => (
                <li key={c} className="flex items-center gap-3 font-mono text-[0.72rem] text-noche-ink-2">
                  <span className="inline-block h-3 w-8 rounded-sm" style={{ background: c }} />
                  {["Cuarto más bajo", "Segundo cuarto", "Tercer cuarto", "Cuarto más alto"][i]} · {v.rangos[i]}
                </li>
              ))}
              <li className="flex items-center gap-3 font-mono text-[0.72rem] text-noche-ink-3">
                <span className="inline-block h-3 w-8 rounded-sm" style={{ background: SIN_DATO }} />
                Pocos datos
              </li>
            </ul>
          </div>
          <svg
            viewBox={datos.viewBox.join(" ")}
            className="mx-auto h-auto max-h-[34rem] w-full"
            role="img"
            aria-label={`Mapa de Lima Metropolitana: reportes por cada 1.000 alumnos en ${periodo(anio, parcial)}`}
          >
            {datos.geometria.map((g) => {
              const f = filas.find((x) => x.nombre === g.nombre);
              return (
                <path key={g.nombre} d={g.d} fill={v.color(g.nombre)} stroke="var(--noche)" strokeWidth={1.4}>
                  {/* Un solo texto: con varios hijos, <title> hidrataba distinto. */}
                  <title>
                    {`${g.nombre}${
                      f?.tasa != null
                        ? `: ${dec(f.tasa)} por cada 1.000 alumnos (${miles(f.reportes)} reportes)`
                        : ": pocos datos"
                    }`}
                  </title>
                </path>
              );
            })}
          </svg>
        </div>
        <div className="mt-6">
          <ShareImage
            titulo="Mapa de distritos para historias"
            microcopy="Descarga en formato historia de Instagram"
            eventoDescarga="download_dato"
            contexto={{ ...ctx, pieza: "mapa" }}
            alineacion="izquierda"
            dibujar={() =>
              dibujarMapaDistritos({
                anio,
                parcial,
                viewBox: datos.viewBox,
                geometria: datos.geometria,
                color: v.color,
                maximo,
                minimo,
                cortes: v.rangos,
              })
            }
            archivo={() => ["mapa-distritos-lima", anio]}
          />
        </div>
      </PiezaNoche>

      {/* ── Ranking ───────────────────────────────────────────────── */}
      <PiezaNoche
        antetitulo={`Ranking · Lima · ${periodo(anio, parcial)}`}
        titulo={
          <>
            Los {v.con.length} distritos, de más a menos reportes de <span className="text-menta">violencia escolar</span>{" "}
            por alumno
          </>
        }
        respuesta="Busca el tuyo. Los primeros puestos son distritos del centro, no los más poblados."
        nota={nota}
      >
        <ol className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
          {v.con.map((d, k) => (
            <li key={d.nombre} className="grid grid-cols-[1.8rem_1fr_4.5rem_3rem] items-center gap-2 text-[0.95rem]">
              <span className="text-right font-mono text-[0.72rem] text-noche-ink-3">{k + 1}</span>
              <span className="truncate text-noche-ink" title={`${miles(d.reportes)} reportes · ${miles(d.alumnos)} alumnos`}>
                {d.nombre}
              </span>
              <span className="h-2.5 rounded-sm" style={{ width: `${Math.max(6, (100 * d.tasa) / maximo.tasa)}%`, background: v.color(d.nombre) }} />
              <span className={`cifra text-right ${k < 3 ? "text-menta" : "text-noche-ink"}`}>{dec(d.tasa)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <ShareImage
            titulo="Ranking de distritos para historias"
            microcopy="Descarga en formato historia de Instagram"
            eventoDescarga="download_dato"
            contexto={{ ...ctx, pieza: "ranking" }}
            alineacion="izquierda"
            dibujar={() => dibujarRankingDistritos({ anio, parcial, filas: v.con, color: v.color })}
            archivo={() => ["ranking-distritos-lima", anio]}
          />
        </div>
      </PiezaNoche>

      {/* ── Reparto: ¿concentración o tamaño? ─────────────────────── */}
      <PiezaNoche
        antetitulo={`Reparto de reportes · Lima · ${periodo(anio, parcial)}`}
        titulo={
          <>
            ¿Se concentran los <span className="text-menta">reportes de violencia</span> en unos pocos distritos?
          </>
        }
        respuesta={
          <>
            Casi no: se reparten como los alumnos. Los 10 distritos con más reportes suman el{" "}
            <span className="text-menta">{Math.round(v.top10.reportes)} %</span> de los reportes y el{" "}
            {Math.round(v.top10.alumnos)} % de los alumnos.
          </>
        }
        nota={
          <>
            {miles(total)} reportes de {periodo(anio, parcial)} en los {filas.length} distritos de Lima Metropolitana.
            Alumnos: Censo Educativo 2024. Un distrito con más reportes que alumnos registra más de lo que su tamaño
            haría esperar; con menos, registra menos.
          </>
        }
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
          {[
            ["bg-menta", "% de los reportes"],
            ["bg-noche-ink-4", "% de los alumnos"],
          ].map(([c, t]) => (
            <li key={t} className="flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-noche-ink-2">
              <span className={`inline-block h-2.5 w-6 rounded-sm ${c}`} />
              {t}
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-3">
          {muestra.map((f) => {
            const tope = Math.max(...muestra.flatMap((x) => [x.pctReportes, x.pctAlumnos]));
            return (
              <div key={f.nombre} className="grid grid-cols-[minmax(8rem,13rem)_1fr] items-center gap-4">
                <dt className="truncate text-[0.95rem] font-medium text-noche-ink">{f.nombre}</dt>
                <dd className="space-y-1">
                  {[
                    [f.pctReportes, "bg-menta", "text-noche-ink"],
                    [f.pctAlumnos, "bg-noche-ink-4", "text-noche-ink-3"],
                  ].map(([val, bg, tx], j) => (
                    <div key={j} className="flex items-center gap-2.5">
                      <span className={`block h-2.5 rounded-sm ${bg}`} style={{ width: `${(80 * (val as number)) / tope}%` }} />
                      <span className={`cifra whitespace-nowrap text-[0.78rem] ${tx}`}>{dec(val as number)}&nbsp;%</span>
                    </div>
                  ))}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-4 text-[0.9rem] text-noche-ink-2">
          Otros {resto.n} distritos: {dec(resto.pctReportes)} % de los reportes · {dec(resto.pctAlumnos)} % de los alumnos
        </p>
        <div className="mt-6">
          <ShareImage
            titulo="Reparto por distrito para historias"
            microcopy="Descarga en formato historia de Instagram"
            eventoDescarga="download_dato"
            contexto={{ ...ctx, pieza: "reparto" }}
            alineacion="izquierda"
            dibujar={() =>
              dibujarConcentracion({ anio, parcial, filas: muestra, resto, top10: v.top10, total })
            }
            archivo={() => ["reparto-distritos-lima", anio]}
          />
        </div>
      </PiezaNoche>
    </div>
  );
}
