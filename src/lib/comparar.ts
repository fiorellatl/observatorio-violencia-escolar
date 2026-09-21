import { getMeta } from "@/lib/data/provider";
import { getContexto, type ContextoDistribucion } from "@/lib/distribucion";
import type { Institution } from "@/lib/types";

/**
 * El contraste entre dos o tres colegios.
 *
 * POR QUÉ ESTE MÓDULO EXISTE, Y NO SOLO UNA TABLA
 * Poner tres columnas de cifras una al lado de otra es facilísimo y es
 * exactamente donde una comparación se vuelve deshonesta: el lector lee
 * "76 frente a 31" y concluye "el primero es peor", que es justo lo que los
 * datos de SíseVe no permiten afirmar. Una tabla sola invita a esa lectura y
 * no la corrige.
 *
 * Así que la comparación empieza por el contraste, no por la tabla. Y el
 * contraste responde tres preguntas que la tabla no puede:
 *
 *   1. ¿Están en posiciones distintas del reparto, o la diferencia cabe
 *      dentro del mismo tramo? Una diferencia de cuatro reportes entre dos
 *      colegios del 1 % superior no los separa en nada.
 *   2. ¿El orden cambia al mirar la tasa? Es lo más útil que puede decir esta
 *      página: un colegio grande registra más reportes casi por definición, y
 *      cuando el orden se da la vuelta al dividir por alumnos, eso es el
 *      hallazgo.
 *   3. ¿Se puede comparar siquiera? Sin denominador no hay tasa, y decirlo
 *      vale más que rellenar la celda.
 *
 * NINGUNA FRASE DE AQUÍ CALIFICA A UN COLEGIO. Se habla de registro, de
 * posición y de reparto. No hay peor, mejor, peligroso ni seguro.
 */

/**
 * Cuántos colegios caben en una comparación.
 *
 * Vive aquí y no en el componente por una razón que costó encontrar: un valor
 * exportado desde un módulo `"use client"` NO llega al servidor como valor.
 * Next lo sustituye por una referencia de cliente, así que `slice(0, MAXIMO)`
 * se convertía en `slice(0, [Function])` y la página se quedaba sin colegios
 * sin dar ningún error. Las constantes compartidas entre servidor y cliente
 * van en un módulo neutro.
 *
 * Tres caben en una pantalla; cuatro obligan a comparar de dos en dos
 * mentalmente, que es lo contrario de lo que hace esta página.
 */
export const MAXIMO = 3;

export interface ColegioComparado {
  inst: Institution;
  /** Reportes del año principal —el último completo—. */
  conteo: number;
  /** Posición en la distribución nacional de ese año. */
  ctx: ContextoDistribucion | null;
}

export function compararColegios(
  instituciones: Institution[],
  anio: string
): ColegioComparado[] {
  return instituciones.map((inst) => {
    const conteo = inst.anios[anio]?.total ?? 0;
    return { inst, conteo, ctx: getContexto(conteo, anio) };
  });
}

export interface Contraste {
  /** Etiqueta corta para la tarjeta. */
  clase: "posicion" | "orden" | "denominador";
  texto: string;
}

const lista = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

/**
 * Las frases que se publican, en orden de importancia.
 *
 * Se redactan aquí y no en el componente por la misma razón que los insights:
 * este es el punto donde se decide qué NO se dice, y repartirlo entre vistas
 * garantizaría que alguna se despistara.
 */
export function contrastes(cs: ColegioComparado[], anio: string): Contraste[] {
  const out: Contraste[] = [];
  if (cs.length < 2) return out;

  const nombre = (c: ColegioComparado) => c.inst.nombre;

  /* ── 1. ¿La diferencia los separa dentro del reparto? ──────────────── */
  const conCtx = cs.filter((c) => c.ctx);
  if (conCtx.length === cs.length) {
    const tramos = new Set(cs.map((c) => c.ctx!.tramo));
    const cuentas = cs.map((c) => c.conteo);
    const brecha = Math.max(...cuentas) - Math.min(...cuentas);

    if (tramos.size === 1) {
      out.push({
        clase: "posicion",
        texto:
          `Los ${cs.length === 2 ? "dos" : "tres"} caen en el mismo tramo de la ` +
          `distribución de ${anio}${
            brecha > 0
              ? `: la diferencia de ${brecha} reporte${brecha === 1 ? "" : "s"} no los separa.`
              : "."
          }`,
      });
    } else {
      // Ordenados de mayor a menor posición, para que la frase se lea sola.
      const orden = [...cs].sort((a, b) => b.ctx!.percentil - a.ctx!.percentil);
      out.push({
        clase: "posicion",
        texto: `Ocupan posiciones distintas del reparto de ${anio}. ${orden
          .map((c) => `${nombre(c)}: ${c.ctx!.frase.replace(/^Está|^Registra|^Su/, (m) =>
            m === "Su" ? "su" : m.toLowerCase()
          )}`)
          .join(" ")}`,
      });
    }
  }

  /* ── 2. ¿Cambia el orden al dividir por alumnos? ───────────────────── */
  // Se usa la MISMA tasa que el resto del sitio —la del año transversal—, no
  // una calculada aquí: dos definiciones de tasa en el mismo producto serían
  // dos números distintos con el mismo nombre.
  //
  // Y el conteo que se compara contra ella es el DE ESE MISMO AÑO, no el del
  // año principal. Enfrentar los reportes de 2025 a una tasa de 2024 daba una
  // frase que parecía explicar la inversión por el tamaño del colegio cuando
  // en realidad la producían dos años distintos.
  const t = getMeta().anio_transversal;
  const conTasa = cs.filter((c) => c.inst.tasa_2024 != null && c.inst.matricula != null);
  if (conTasa.length >= 2) {
    const deT = (c: ColegioComparado) => c.inst.anios[t]?.total ?? 0;
    const porConteo = [...conTasa].sort((a, b) => deT(b) - deT(a));
    const porTasa = [...conTasa].sort((a, b) => b.inst.tasa_2024! - a.inst.tasa_2024!);

    if (porConteo[0].inst.slug !== porTasa[0].inst.slug && deT(porConteo[0]) > deT(porTasa[0])) {
      const a = porConteo[0];
      const b = porTasa[0];
      out.push({
        clase: "orden",
        texto:
          `En ${t}, ${nombre(a)} registró más reportes que ${nombre(b)} ` +
          `(${deT(a)} frente a ${deT(b)}), pero ${nombre(b)} registró más por cada ` +
          `1.000 alumnos: tiene ${b.inst.matricula!.toLocaleString("es-PE")} estudiantes ` +
          `frente a ${a.inst.matricula!.toLocaleString("es-PE")}.`,
      });
    }
  }

  /* ── 3. ¿Falta el denominador de alguno? ───────────────────────────── */
  const sinTasa = cs.filter((c) => c.inst.tasa_2024 == null);
  if (sinTasa.length > 0 && cs.length > sinTasa.length) {
    out.push({
      clase: "denominador",
      texto:
        `La tasa no se puede comparar entre todos: falta el número de alumnos de ` +
        `${lista(sinTasa.map(nombre))}.`,
    });
  } else if (sinTasa.length === cs.length) {
    out.push({
      clase: "denominador",
      texto:
        "Ninguno tiene número de alumnos publicado, así que solo se pueden comparar " +
        "conteos: un colegio con el doble de estudiantes registra más casi por definición.",
    });
  }

  return out;
}
