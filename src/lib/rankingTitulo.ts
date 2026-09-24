/**
 * El titular del ranking, con los filtros que cambian lo que se está viendo.
 *
 * La página se comparte por captura y por enlace. Si el titular dice
 * «Colegios con más reportes» sobre una tabla filtrada por Miraflores, quien
 * recibe la imagen cree que es el país. Por eso el lugar, la gestión y el
 * nivel entran en el titular, no solo en el subtítulo.
 *
 * Una sola función para la página, la imagen compartible y la vista previa
 * del enlace: si divergieran, el enlace prometería una tabla y la imagen
 * mostraría otra.
 */

export interface FiltrosTitular {
  metrica: "reportes" | "tasa";
  /** « física», « psicológica», « sexual» o "". */
  tipo: string;
  gestion?: string;
  nivel?: string;
  region?: string;
  provincia?: string;
  ugel?: string;
  distrito?: string;
  /** Región entre paréntesis cuando el nombre del distrito se repite. */
  distritoRegion?: string;
}

/** El lugar más preciso que se haya elegido, dicho como se dice en español. */
export function lugarRanking(f: FiltrosTitular): string {
  if (f.distrito) return f.distritoRegion ? `${f.distrito} (${f.distritoRegion})` : f.distrito;
  if (f.provincia) return `la provincia de ${f.provincia}`;
  if (f.ugel) return `la ${f.ugel}`;
  if (f.region) return f.region;
  return "";
}

export function tituloRanking(f: FiltrosTitular): string {
  const gestion = f.gestion?.startsWith("Priv") ? " privados" : f.gestion?.startsWith("Púb") ? " públicos" : "";
  const nivel = f.nivel ? ` de ${f.nivel.split(" - ")[0].toLowerCase()}` : "";
  // Sin lugar elegido, el universo es el país, y se dice: una imagen
  // compartida sin territorio no deja saber de dónde es.
  const lugar = lugarRanking(f) || "el Perú";
  const donde = ` en ${lugar}`;
  return f.metrica === "tasa"
    ? `Colegios${gestion}${nivel} con mayor tasa de reportes de violencia${f.tipo}${donde}`
    : `Colegios${gestion}${nivel} con más reportes de violencia${f.tipo} registrados${donde}`;
}
