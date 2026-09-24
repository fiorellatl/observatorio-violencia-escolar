"use client";

import { useState, type ReactNode } from "react";
import { medir } from "@/lib/analytics";

/**
 * Pestañas de año para contenido que ya viene pintado del servidor.
 *
 * Cada año llega como un panel completo: el servidor calcula y dibuja todos,
 * y aquí solo se elige cuál se ve. Así las piezas siguen siendo de servidor
 * y el botón de compartir de cada panel ya lleva los datos de SU año —no
 * puede exportar un año distinto del que está en pantalla—.
 */
export function SelectorAnio({
  anios,
  inicial,
  paneles,
  bloque,
}: {
  anios: { anio: string; etiqueta: string }[];
  inicial: string;
  paneles: Record<string, ReactNode>;
  bloque: string;
}) {
  const [anio, setAnio] = useState(inicial);
  return (
    <div>
      <div role="group" aria-label="Año" className="flex w-fit overflow-hidden rounded border border-rule">
        {anios.map((a) => (
          <button
            key={a.anio}
            type="button"
            aria-pressed={anio === a.anio}
            onClick={() => {
              setAnio(a.anio);
              medir("select_year", { anio: a.anio, bloque });
            }}
            className={`tabular min-h-11 px-3 text-[0.84rem] transition-colors duration-150 ease-suave sm:min-h-0 sm:py-2 ${
              anio === a.anio ? "bg-surface font-medium text-ink" : "text-ink-3 hover:bg-surface hover:text-ink-2"
            }`}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>
      <div className="mt-6">{paneles[anio]}</div>
    </div>
  );
}
