import { getCross } from "@/lib/data/provider";
import type { CrossRow } from "@/lib/types";

/**
 * El corte transversal, como archivo estático.
 *
 * Se sirve aparte en lugar de viajar dentro del HTML de /datos: esos 3.881
 * puntos pesaban 900 KB en la página, que todo el mundo pagaba aunque nunca
 * llegara a desplazarse hasta el gráfico. Ahora el gráfico los pide cuando se
 * monta.
 *
 * Viaja como arrays y no como objetos —las claves repetidas 3.881 veces son
 * la mitad del archivo— y sin el nombre del distrito ni la pensión, que el
 * gráfico no usa.
 */
export const dynamic = "force-static";

/** [slug, nombre, gestión, nivel, matrícula, reportes, tasa] */
export type CrossCompacta = [string, string, string, string, number, number, number];

export function GET() {
  const filas: CrossCompacta[] = getCross().map((c: CrossRow) => [
    c.slug,
    c.nombre,
    c.gestion,
    c.nivel,
    c.matricula,
    c.reportes,
    c.tasa,
  ]);

  return Response.json(filas, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
