/**
 * Las agregaciones de la ficha de un colegio.
 *
 * Viven aquí, y no dentro de un componente, porque DOS cosas las necesitan:
 * los gráficos que se ven en pantalla y la radiografía que se comparte. Si
 * cada uno hiciera su propia suma, bastaría un arreglo aplicado a medias para
 * que la imagen afirmara algo que la página no dice —y la imagen se va sola,
 * sin la página al lado que la corrija—.
 *
 * Nada de esto inventa un dato: todo sale de los conteos ya anonimizados de
 * la capa pública.
 */
import { norm } from "@/lib/format";
import type { YearCounts } from "@/lib/types";

export interface ServicioFicha {
  nivel: string;
  anios: Record<string, YearCounts>;
}

/**
 * Qué nivel está mirando el usuario.
 *
 * Se acepta tanto "primaria" como la etiqueta completa: un enlace escrito a
 * mano no tiene por qué saber que el nivel se llama "Inicial - Cuna-Jardín".
 * Cadena vacía = toda la institución, que es también el caso de un colegio
 * con un solo servicio, donde el filtro no significa nada.
 */
export function resolverNivel(servicios: ServicioFicha[], pedido: string | null): string {
  if (servicios.length < 2) return "";
  return servicios.find((s) => norm(s.nivel) === norm(pedido ?? ""))?.nivel ?? "";
}

/** Los conteos que mandan: los del nivel elegido, o los de la institución. */
export function conteosDe(
  servicios: ServicioFicha[],
  institucion: Record<string, YearCounts>,
  nivel: string
): Record<string, YearCounts> {
  if (!nivel) return institucion;
  return servicios.find((s) => s.nivel === nivel)?.anios ?? {};
}

/** Una categoría con su conteo y su peso sobre el total del año. */
export interface CategoriaAnual {
  clave: string;
  label: string;
  color: string;
  valor: number;
  /** Sobre el total de reportes DEL AÑO, no sobre la suma de categorías. */
  pct: number;
}

/**
 * Descompone un año en categorías.
 *
 * Devuelve solo las que tienen algún reporte: una pieza que muestra «0 %»
 * presenta como hallazgo lo que es simplemente ausencia de registro.
 */
export function categoriasDelAnio(
  conteos: YearCounts | undefined,
  claves: string[],
  etiquetas: Record<string, string>,
  colores: Record<string, string>
): CategoriaAnual[] {
  const total = conteos?.total ?? 0;
  return claves
    .map((k) => {
      const valor = Number(conteos?.[k as keyof YearCounts]) || 0;
      return {
        clave: k,
        label: etiquetas[k] ?? k,
        color: colores[k],
        valor,
        pct: total > 0 ? (valor / total) * 100 : 0,
      };
    })
    .filter((c) => c.valor > 0);
}

/** Puntos por año listos para los gráficos de categorías. */
export function puntosPorAnio(
  conteos: Record<string, YearCounts>,
  anios: string[],
  claves: string[],
  pandemia: string[],
  parcial: string
) {
  return anios.map((a) => {
    const c = conteos[a];
    const valores: Record<string, number> = {};
    for (const k of claves) valores[k] = Number(c?.[k as keyof YearCounts]) || 0;
    return {
      anio: a,
      total: c?.total ?? 0,
      pandemia: pandemia.includes(a),
      parcial: a === parcial,
      valores,
    };
  });
}
