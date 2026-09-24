"use client";

import { ShareImage } from "@/components/ShareImage";
import { dibujarPensionComposicion, dibujarPensionTramos } from "@/lib/share/datos";
import type { Pensiones } from "@/lib/hallazgos";

/** Botones de historia de las dos piezas de pensión. Van aparte porque las
    piezas son de servidor y `dibujar` tiene que vivir en el cliente. */
export function CompartirPension({
  anio,
  parcial,
  anioAlumnos,
  datos,
  pieza,
}: {
  anio: string;
  parcial: boolean;
  anioAlumnos: string;
  datos: Pensiones;
  pieza: "tramos" | "composicion";
}) {
  return (
    <ShareImage
      titulo={pieza === "tramos" ? "Pensión y reportes, para historias" : "Qué se reporta según la pensión, para historias"}
      microcopy="Descarga en formato historia de Instagram"
      eventoDescarga="download_dato"
      contexto={{ anio, bloque: "pension", pieza }}
      alineacion="izquierda"
      dibujar={() =>
        pieza === "tramos"
          ? dibujarPensionTramos({ anio, parcial, anioAlumnos, tramos: datos.tramos, publicos: datos.publicos.tasa, colegios: datos.conPension })
          : dibujarPensionComposicion({
              anio,
              parcial,
              filas: datos.composicion.map((c) => ({ nombre: c.nombre, bajo: c.bajo, alto: c.alto, claro: c.claro })),
              colegiosAlto: datos.alto.colegios,
              colegiosBajo: datos.bajo.colegios,
            })
      }
      archivo={() => ["pension", pieza, anio]}
    />
  );
}
