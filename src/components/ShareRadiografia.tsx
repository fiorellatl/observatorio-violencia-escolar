"use client";

import { useSearchParams } from "next/navigation";
import { ShareImage } from "@/components/ShareImage";
import { categoriasDelAnio, conteosDe, resolverNivel, type ServicioFicha } from "@/lib/ficha";
import { dibujarRadiografia, type DatosRadiografia } from "@/lib/share/radiografia";
import type { YearCounts } from "@/lib/types";

/**
 * Puente entre la ficha —que es un componente de servidor— y el lienzo, que
 * solo existe en el navegador.
 *
 * NO RECALCULA NADA POR SU CUENTA. Usa las mismas funciones de agregación que
 * los gráficos de la página (`@/lib/ficha`) y lee el mismo parámetro de URL
 * que las pestañas de nivel, así que la imagen siempre sale del estado que se
 * está viendo: si alguien está mirando "Primaria", la radiografía es la de
 * primaria, no la de la institución entera.
 *
 * EL CONTEXTO SE CAE CUANDO HAY UN NIVEL ELEGIDO, a propósito. La mediana con
 * la que se compara sale del reparto de totales POR INSTITUCIÓN; enfrentar a
 * ella el conteo de un solo nivel compararía dos cosas distintas y haría
 * parecer bajo a cualquier colegio grande.
 */
export function ShareRadiografia({
  base,
  servicios,
  institucion,
  tipos,
  actores,
}: {
  base: Omit<DatosRadiografia, "total" | "serie" | "tipos" | "actores"> & {
    aniosSerie: string[];
    pandemia: string[];
  };
  servicios: ServicioFicha[];
  institucion: Record<string, YearCounts>;
  /** Claves, rótulos y color en hexadecimal: el canvas no resuelve `var()`. */
  tipos: { claves: string[]; etiquetas: Record<string, string>; colores: Record<string, string> };
  actores: { claves: string[]; etiquetas: Record<string, string>; colores: Record<string, string> };
}) {
  const params = useSearchParams();

  const armar = (): DatosRadiografia => {
    const nivel = resolverNivel(servicios, params.get("ver"));
    const fuente = conteosDe(servicios, institucion, nivel);
    const delAnio = fuente[base.anio];

    return {
      ...base,
      // El nivel elegido se dice en la pieza: sin eso, una radiografía de
      // primaria y otra de todo el colegio serían indistinguibles.
      nivel: nivel || null,
      total: delAnio?.total ?? 0,
      serie: base.aniosSerie.map((a) => ({
        anio: a,
        valor: fuente[a]?.total ?? 0,
        pandemia: base.pandemia.includes(a),
      })),
      tipos: categoriasDelAnio(delAnio, tipos.claves, tipos.etiquetas, tipos.colores),
      actores: categoriasDelAnio(delAnio, actores.claves, actores.etiquetas, actores.colores),
      contexto: nivel ? null : base.contexto,
    };
  };

  return (
    <ShareImage
      titulo="Radiografía del colegio"
      microcopy="Genera una radiografía del colegio"
      eventoDescarga="download_radiografia"
      contexto={{ colegio: base.nombre, anio: base.anio }}
      alineacion="izquierda"
      dibujar={() => dibujarRadiografia(armar())}
      archivo={() => [
        "radiografia",
        base.nombre,
        resolverNivel(servicios, params.get("ver")),
        base.anio,
      ]}
    />
  );
}
