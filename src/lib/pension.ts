import type { EstadoPension } from "@/lib/types";

/**
 * Cómo se dice cada estado de la pensión.
 *
 * Vive en un solo sitio porque la ficha, la tabla de niveles y su versión de
 * móvil enseñan lo mismo con tres formatos distintos, y la tentación de
 * escribir «Sin pensión» en la más estrecha es justo el error que este
 * módulo existe para evitar: no sabemos que no cobre, sabemos que no lo
 * hemos consultado.
 *
 * NINGÚN TEXTO AFIRMA GRATUIDAD salvo en el caso donde la gratuidad es la
 * norma —un colegio público— y aun ahí se dice por qué, no como conclusión.
 */
export const PENSION: Record<
  EstadoPension,
  { corto: string; largo: string; tono: "dato" | "neutro" | "ausente" }
> = {
  disponible: {
    corto: "—",
    largo: "",
    tono: "dato",
  },
  no_aplica: {
    corto: "No aplica",
    largo: "No aplica: los colegios públicos no cobran pensión.",
    tono: "neutro",
  },
  no_informada: {
    corto: "Sin declarar",
    largo: "Su ficha de Identicole no declara la pensión.",
    tono: "ausente",
  },
  sin_ficha: {
    corto: "Sin consultar",
    largo: "Su ficha de Identicole no se ha consultado: la cobertura es solo Lima.",
    tono: "ausente",
  },
  conflicto: {
    corto: "En revisión",
    largo:
      "SíseVe lo registra como público e Identicole como privado. No publicamos la pensión mientras las fuentes no coincidan.",
    tono: "ausente",
  },
};

/**
 * El estado de un servicio, con respaldo para datos antiguos.
 *
 * Un servicio generado antes de que existiera el campo no lo trae. En vez de
 * fallar o de inventarse un estado, se deduce lo mínimo que sí se sabe: si
 * hay importe está disponible, y si no, se admite que no se sabe por qué.
 */
export function estadoPension(s: {
  pension?: number | null;
  pension_estado?: EstadoPension;
  gestion?: string;
}): EstadoPension {
  if (s.pension_estado) return s.pension_estado;
  if (s.pension != null) return "disponible";
  return s.gestion?.startsWith("Públic") ? "no_aplica" : "sin_ficha";
}
