"use client";

import { ShareImage } from "@/components/ShareImage";
import { dibujarCiberbullying } from "@/lib/share/datos";

type Anio = { anio: string; parcial: boolean; ciber: number; acoso: number; total: number };

/** El botón de historia de la pieza de ciberbullying. Va aparte porque la
    sección es de servidor y `dibujar` tiene que vivir en el cliente. */
export function CompartirCiberbullying({ anios }: { anios: Anio[] }) {
  return (
    <ShareImage
      titulo="El ciberbullying en los reportes, para historias"
      microcopy="Descarga en formato historia de Instagram"
      eventoDescarga="download_dato"
      contexto={{ bloque: "acoso", pieza: "ciberbullying" }}
      alineacion="izquierda"
      dibujar={() => dibujarCiberbullying({ anios })}
      archivo={() => ["ciberbullying", anios[0].anio, anios[anios.length - 1].anio]}
    />
  );
}
