"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ReportTrend } from "@/components/ReportTrend";
import { CategoryBars, type SerieDef } from "@/components/CategoryBars";
import { nf } from "@/lib/format";
import { PENSION, estadoPension } from "@/lib/pension";
import { COLOR_ACTOR, COLOR_VIOLENCIA, color } from "@/lib/viz/colors";
import { conteosDe, puntosPorAnio, resolverNivel } from "@/lib/ficha";
import type { YearCounts } from "@/lib/types";

/**
 * El nivel educativo como DIMENSIÓN, no como navegación.
 *
 * Antes, cada nivel de un colegio era una ficha distinta: Newton College
 * aparecía tres veces y ninguna de las tres decía cuántos reportes tiene el
 * colegio. Ahora la ficha es la institución y el nivel filtra lo que se
 * muestra dentro de ella, sin cambiar de página.
 *
 * El filtro vive en la URL como `ver`, no como `nivel`: `nivel` ya significa
 * otra cosa en esta misma dirección —el filtro del universo por el que se
 * navega entre colegios— y compartir la clave haría que cambiar de pestaña
 * cambiase también la lista de anterior/siguiente.
 *
 * Las tres secciones comparten una sola selección. Tres pestañas
 * independientes obligarían a elegir "Primaria" tres veces para leer la
 * ficha de primaria.
 */

export type ServicioVista = {
  nivel: string;
  anios: Record<string, YearCounts>;
  matricula: number | null;
  pension: number | null;
  anio_pension?: string | null;
  pension_estado?: import("@/lib/types").EstadoPension;
};

export function LevelBreakdown({
  servicios,
  institucion,
  anios,
  pandemia,
  parcial,
  principal,
  anioMatricula,
}: {
  servicios: ServicioVista[];
  institucion: Record<string, YearCounts>;
  /** Rango continuo de años: sin los vacíos, una línea uniría 2016 con 2022. */
  anios: string[];
  pandemia: string[];
  parcial: string;
  principal: string;
  anioMatricula?: string | null;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const unico = servicios.length < 2;
  // La misma resolución que usa la imagen que se comparte: si divergieran,
  // la radiografía podría salir de un nivel distinto del que está en pantalla.
  const activo = resolverNivel(servicios, params.get("ver"));

  const elegir = (nivel: string) => {
    const p = new URLSearchParams(params.toString());
    if (nivel) p.set("ver", nivel);
    else p.delete("ver");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /** Los conteos que mandan ahora: los del nivel elegido o los de todo. */
  const fuente = useMemo(
    () => conteosDe(servicios, institucion, activo),
    [activo, servicios, institucion]
  );

  const serie = anios.map((a) => ({
    anio: a,
    total: fuente[a]?.total ?? 0,
    pandemia: pandemia.includes(a),
    parcial: a === parcial,
  }));

  const puntos = (claves: string[]) =>
    puntosPorAnio(fuente, anios, claves, pandemia, parcial);

  const seriesTipo: SerieDef[] = [
    { clave: "psicologica", label: "Psicológica", color: color(COLOR_VIOLENCIA.psicologica) },
    { clave: "fisica", label: "Física", color: color(COLOR_VIOLENCIA.fisica) },
    { clave: "sexual", label: "Sexual", color: color(COLOR_VIOLENCIA.sexual) },
  ];
  const seriesActor: SerieDef[] = [
    { clave: "entre_escolares", label: "Entre estudiantes", color: color(COLOR_ACTOR.entre_escolares) },
    { clave: "personal_ie", label: "Un adulto del colegio", color: color(COLOR_ACTOR.personal_ie) },
  ];

  const Pestanas = () =>
    unico ? null : (
      <div role="group" aria-label="Filtrar por nivel educativo" className="flex flex-wrap gap-2">
        {[{ nivel: "" }, ...servicios].map((s) => {
          const v = "nivel" in s ? s.nivel : "";
          const sel = activo === v;
          return (
            <button
              key={v || "todos"}
              type="button"
              aria-pressed={sel}
              onClick={() => elegir(v)}
              className={`min-h-11 rounded border px-3.5 text-[0.84rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:px-3 sm:py-1.5 ${
                sel
                  ? "border-ink bg-surface font-medium text-ink"
                  : "border-rule text-ink-2 hover:border-ink-3 hover:text-ink"
              }`}
            >
              {v || "Todos"}
            </button>
          );
        })}
      </div>
    );

  const rotulo = activo ? ` · ${activo}` : "";
  const seccion = "scroll-mt-24 border-t border-rule py-10 sm:py-14";
  const enCurso = parcial;
  const hayPension = servicios.some((s) => s.pension != null);
  const rango = `${anios[0]}–${anios[anios.length - 1]}`;

  return (
    <>
      {/* ── Evolución ──────────────────────────────────────────── */}
      <section id="evolucion" className={seccion}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h2 className="font-display text-display-l font-medium">
              Evolución de los reportes
            </h2>
            <p className="mt-2 text-[0.9rem] text-ink-2">
              Reportes registrados por año{activo ? ` en ${activo.toLowerCase()}` : " en toda la institución"}.
            </p>
          </div>
          <DataSourceBadge fuente="SíseVe" anio={rango} />
        </div>

        <div className="mb-6">
          <Pestanas />
        </div>

        <ReportTrend data={serie} alto={340} />

        {serie.some((p) => p.pandemia) ? (
          <div className="mt-5">
            <MethodologyNote tono="aviso" href="/metodologia">
              En {pandemia.join(" y ")} los colegios estuvieron cerrados: la caída del
              registro no se lee como menos violencia.
            </MethodologyNote>
          </div>
        ) : null}
      </section>

      {/* ── Desglose por nivel ─────────────────────────────────── */}
      {unico ? null : (
        <section id="niveles" className={seccion}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 className="font-display text-display-l font-medium">Datos por nivel</h2>
              <p className="mt-2 text-[0.9rem] text-ink-2">
                Esta institución presta {nf(servicios.length)} servicios educativos, cada
                uno con su propio código modular.
              </p>
            </div>
          </div>

          {/* La tabla medía 544 px y en un teléfono escondía las dos últimas
              columnas tras un scroll lateral. Desde `sm` sigue siendo la misma
              tabla; por debajo, cada nivel se lee como un bloque. */}
          <div className="hidden sm:block sm:overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[0.9rem]">
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className="meta py-2.5 text-left">
                    Nivel
                  </th>
                  <th scope="col" className="meta py-2.5 text-right"># alumnos</th>
                  <th scope="col" className="meta py-2.5 text-right">
                    Reportes {principal}
                  </th>
                  <th scope="col" className="meta py-2.5 text-right">
                    Reportes {enCurso}
                  </th>
                  {hayPension ? (
                    <th scope="col" className="meta py-2.5 text-right">
                      Pensión
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {servicios.map((s) => (
                  <tr
                    key={s.nivel}
                    className={`border-b border-rule-2 transition-colors duration-150 ease-suave ${
                      activo === s.nivel ? "bg-accent-soft/60" : ""
                    }`}
                  >
                    <th scope="row" className="py-3 text-left font-medium text-ink">
                      {s.nivel}
                    </th>
                    <td className="tabular py-3 text-right text-ink-2">
                      {s.matricula != null ? nf(s.matricula) : "—"}
                    </td>
                    <td className="tabular py-3 text-right font-medium text-ink">
                      {nf(s.anios[principal]?.total ?? 0)}
                    </td>
                    <td className="tabular py-3 text-right text-ink-2">
                      {nf(s.anios[enCurso]?.total ?? 0)}
                    </td>
                    {hayPension ? (
                      <td className="tabular py-3 text-right text-ink-2">
                        {s.pension != null ? (
                          `S/ ${nf(s.pension)}`
                        ) : (
                          // Un guion no dice nada; el motivo, sí. Va en
                          // versalita pequeña para no competir con las cifras.
                          <span className="text-[0.76rem] text-ink-3" title={PENSION[estadoPension(s)].largo}>
                            {PENSION[estadoPension(s)].corto}
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
                <tr className="border-b-2 border-ink">
                  <th scope="row" className="py-3 text-left font-semibold text-ink">
                    Toda la institución
                  </th>
                  <td className="tabular py-3 text-right font-medium text-ink">
                    {servicios.every((s) => s.matricula != null)
                      ? nf(servicios.reduce((a, s) => a + (s.matricula ?? 0), 0))
                      : "—"}
                  </td>
                  <td className="cifra py-3 text-right text-[1.15rem] text-ink">
                    {nf(institucion[principal]?.total ?? 0)}
                  </td>
                  <td className="tabular py-3 text-right font-medium text-ink">
                    {nf(institucion[enCurso]?.total ?? 0)}
                  </td>
                  {hayPension ? <td className="py-3 text-right text-ink-3">—</td> : null}
                </tr>
              </tbody>
            </table>
          </div>

          {/* La misma tabla, desplegada: un bloque por nivel con sus cifras en
              pares rótulo/valor. Mismos datos, sin scroll lateral. */}
          <ul className="sm:hidden">
            {[...servicios, null].map((sv) => {
              const esTotal = sv === null;
              const a = esTotal ? institucion : sv.anios;
              const mat = esTotal
                ? servicios.every((x) => x.matricula != null)
                  ? servicios.reduce((acc, x) => acc + (x.matricula ?? 0), 0)
                  : null
                : sv.matricula;
              return (
                <li
                  key={esTotal ? "total" : sv.nivel}
                  className={`border-b py-4 ${
                    esTotal ? "border-b-0 border-t-2 border-ink" : "border-rule-2"
                  } ${!esTotal && activo === sv.nivel ? "bg-accent-soft/60" : ""}`}
                >
                  <p className="text-[0.95rem] font-semibold text-ink">
                    {esTotal ? "Toda la institución" : sv.nivel}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {[
                      [`Reportes ${principal}`, nf(a[principal]?.total ?? 0)],
                      [`Reportes ${enCurso}`, nf(a[enCurso]?.total ?? 0)],
                      ["# alumnos", mat != null ? nf(mat) : "—"],
                      ...(hayPension
                        ? ([
                            [
                              "Pensión",
                              esTotal
                                ? "—"
                                : sv.pension != null
                                  ? `S/ ${nf(sv.pension)}`
                                  : PENSION[estadoPension(sv)].corto,
                            ],
                          ] as [string, string][])
                        : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-2">
                        <dt className="text-[0.8rem] text-ink-3">{k}</dt>
                        <dd className="tabular text-[0.88rem] font-medium text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 max-w-prose text-[0.78rem] leading-relaxed text-ink-3">
            El número de alumnos procede del Censo Educativo{" "}
            {anioMatricula ?? "—"} y se suma entre niveles porque cada uno atiende a una
            población distinta. La pensión no se suma: la declara cada servicio por
            separado.
          </p>
        </section>
      )}

      {/* ── Tipo de violencia ──────────────────────────────────── */}
      <section id="tipos" className={seccion}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-display text-display-l font-medium">
              ¿Qué tipo de violencia se registra?
            </h2>
            <p className="mt-2 text-[0.9rem] text-ink-2">
              Cada categoría por año{rotulo}, no el acumulado.
            </p>
          </div>
          <DataSourceBadge fuente="SíseVe" anio={rango} />
        </div>

        <div className="mb-6">
          <Pestanas />
        </div>

        <CategoryBars
          series={seriesTipo}
          puntos={puntos(["psicologica", "fisica", "sexual"])}
          alto={320}
        />
      </section>

      {/* ── Quién ejerce ───────────────────────────────────────── */}
      <section id="actores" className={seccion}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-display text-display-l font-medium">
              ¿Quién aparece como presunto agresor?
            </h2>
            <p className="mt-2 text-[0.9rem] text-ink-2">
              Presunto: el registro de una alerta no es una responsabilidad probada.
            </p>
          </div>
          <DataSourceBadge fuente="SíseVe" anio={rango} />
        </div>

        <div className="mb-6">
          <Pestanas />
        </div>

        <CategoryBars
          series={seriesActor}
          puntos={puntos(["entre_escolares", "personal_ie"])}
          alto={280}
        />

        <p className="mt-4 max-w-prose text-[0.8rem] leading-relaxed text-ink-3">
          El acoso escolar y el ciberacoso se registran solo entre estudiantes. Cuando el
          presunto agresor es un adulto del colegio, el sistema lo clasifica bajo otras
          categorías, como castigo físico o trato humillante.
        </p>
      </section>
    </>
  );
}
