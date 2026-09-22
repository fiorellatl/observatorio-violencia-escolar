"use client";

import { useMemo, useState } from "react";
import { dec, nf } from "@/lib/format";
import { ESCALA_SECUENCIAL } from "@/lib/viz/colors";
import type { FilaTerritorio } from "@/lib/types";

/**
 * Dónde se registra más, por alumno.
 *
 * LA LECTURA QUE HAY QUE IMPEDIR
 * Una tasa territorial alta NO dice que allí haya más violencia. Dice que
 * allí se registra más: más confianza en el canal, más personal que reporta,
 * más protocolo aplicado. Tacna registra seis veces más por alumno que Puno,
 * y eso describe dos sistemas de reporte antes que dos infancias. Por eso la
 * pieza no se llama «dónde hay más violencia», el color no va de verde a
 * rojo, y el territorio que encabeza no recibe ningún tratamiento de podio.
 *
 * POR QUÉ BARRAS HORIZONTALES Y NO UN MAPA
 * Un mapa del Perú dedica la mayor parte de su superficie a las regiones con
 * menos estudiantes y comprime Lima, que concentra a un tercio del alumnado,
 * en una mancha diminuta: la geometría del país no guarda relación con el
 * dato. Una barra por territorio, ordenada, se compara de un vistazo y cabe
 * en un teléfono. El mapa puede venir después como complemento, no como la
 * forma principal de leer esto.
 *
 * SIN DENOMINADOR NO HAY BARRA. Un territorio donde falta el número de
 * alumnos de demasiadas instituciones aparece igualmente, con su conteo y
 * diciendo qué le falta, en vez de desaparecer de la lista o de colarse con
 * una tasa calculada sobre la mitad de sus colegios.
 */
export function TerritorioRanking({
  regiones,
  ugeles,
  anio,
  minimoReportes,
}: {
  regiones: FilaTerritorio[];
  ugeles: FilaTerritorio[];
  anio: string;
  minimoReportes: number;
}) {
  const [nivel, setNivel] = useState<"region" | "ugel">("region");
  const [todas, setTodas] = useState(false);

  const filas = nivel === "region" ? regiones : ugeles;

  const { conTasa, sinTasa, tope } = useMemo(() => {
    const con = filas.filter((f) => f.tasa != null).sort((a, b) => b.tasa! - a.tasa!);
    return {
      conTasa: con,
      sinTasa: filas.filter((f) => f.tasa == null),
      tope: con[0]?.tasa ?? 1,
    };
  }, [filas]);

  // En UGEL son más de doscientas: se enseñan las quince primeras y el resto
  // se despliega. En región caben las veinticinco.
  const limite = nivel === "region" ? conTasa.length : 15;
  const visibles = todas ? conTasa : conTasa.slice(0, limite);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div
          role="group"
          aria-label="Unidad territorial"
          className="flex overflow-hidden rounded border border-rule"
        >
          {(
            [
              ["region", `Regiones (${regiones.length})`],
              ["ugel", `UGEL (${ugeles.length})`],
            ] as const
          ).map(([v, t]) => (
            <button
              key={v}
              type="button"
              aria-pressed={nivel === v}
              onClick={() => {
                setNivel(v);
                setTodas(false);
              }}
              className={`min-h-11 px-3.5 text-[0.84rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:py-2 ${
                nivel === v
                  ? "bg-surface font-medium text-ink"
                  : "text-ink-3 hover:bg-surface hover:text-ink-2"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-[0.8rem] text-ink-3">
          Reportes de {anio} por cada 1.000 alumnos
        </p>
      </div>

      <ol className="mt-6">
        {visibles.map((f, i) => (
          <li key={f.nombre} className="border-b border-rule-2 py-3">
            <div className="flex items-baseline gap-3">
              <span className="tabular w-7 shrink-0 text-[0.78rem] text-ink-3">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[0.94rem] text-ink">
                {f.nombre}
                {f.region && nivel === "ugel" ? (
                  <span className="ml-2 text-[0.78rem] text-ink-3">{f.region}</span>
                ) : null}
              </span>
              <span className="cifra shrink-0 text-cifra-s text-ink">{dec(f.tasa!, 1)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 pl-10">
              <div className="h-[6px] flex-1 overflow-hidden rounded-sm bg-rule-2">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${Math.max(2, (f.tasa! / tope) * 100)}%`,
                    // Escala secuencial de un solo matiz: dice «más» y
                    // «menos», no «bien» y «mal».
                    background: ESCALA_SECUENCIAL[Math.min(4, Math.floor((f.tasa! / tope) * 5))],
                  }}
                />
              </div>
              <span className="tabular shrink-0 text-[0.76rem] text-ink-3">
                {nf(f.reportes)} en {nf(f.instituciones)} colegios
              </span>
            </div>
          </li>
        ))}
      </ol>

      {conTasa.length > visibles.length || todas ? (
        <button
          type="button"
          onClick={() => setTodas((x) => !x)}
          className="mt-4 min-h-11 text-[0.85rem] font-medium text-accent hover:underline"
        >
          {todas ? "Ver solo las primeras" : `Ver las ${nf(conTasa.length)} con tasa`}
        </button>
      ) : null}

      {sinTasa.length > 0 ? (
        <div className="mt-5 max-w-prose space-y-2 text-[0.78rem] leading-relaxed text-ink-3">
          {/* Dos motivos distintos, dos frases distintas: decir «faltan datos»
              para ambos escondería que en un caso el problema es el
              denominador y en el otro, que hay tan pocos reportes que la tasa
              la movería un solo colegio. */}
          {(
            [
              [
                "pocos_reportes",
                `registran menos de ${nf(minimoReportes)} reportes en el año: con tan pocos, la tasa la movería un solo colegio y no describiría el territorio`,
              ],
              [
                "sin_denominador",
                "les falta el número de alumnos de demasiadas instituciones, y una tasa calculada sobre una parte se leería como si fuera todo",
              ],
              [
                "territorio_pequeno",
                "tienen muy pocas instituciones para sostener una tasa",
              ],
            ] as const
          ).map(([motivo, explica]) => {
            const grupo = sinTasa.filter((f) => f.motivo === motivo);
            if (!grupo.length) return null;
            return (
              <p key={motivo}>
                <span className="font-medium text-ink-2">
                  {nf(grupo.length)} {nivel === "region" ? "regiones" : "UGEL"}
                </span>{" "}
                {explica}: {grupo.map((f) => f.nombre).slice(0, 3).join(", ")}
                {grupo.length > 3 ? ` y ${nf(grupo.length - 3)} más` : ""}. Su conteo sí está
                en los datos.
              </p>
            );
          })}
        </div>
      ) : null}

    </div>
  );
}
