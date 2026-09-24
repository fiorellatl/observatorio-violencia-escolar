"use client";

import { ShareImage } from "@/components/ShareImage";
import { dibujarSilencio } from "@/lib/share/datos";
import type { TramoTamano } from "@/lib/hallazgos";

/** El botón de historia de la pieza del silencio. Va aparte porque la
    pieza es de servidor y `dibujar` tiene que vivir en el cliente. */
export function CompartirSilencio({ anio, regiones, tramos }: { anio: string; regiones: number; tramos: TramoTamano[] }) {
  return (
    <ShareImage
      titulo="El silencio en los colegios grandes, para historias"
      microcopy="Descarga en formato historia de Instagram"
      eventoDescarga="download_dato"
      contexto={{ anio, bloque: "tamano", pieza: "silencio" }}
      alineacion="izquierda"
      dibujar={() => dibujarSilencio({ anio, regiones, tramos })}
      archivo={() => ["silencio-colegios-grandes", anio]}
    />
  );
}
