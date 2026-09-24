import type { RankingIndex, RankingRow } from "@/lib/types";

/**
 * Filtros territoriales del ranking: región (departamento), UGEL, provincia y
 * distrito.
 *
 * Viven aquí y no dentro del explorador porque la ficha de un colegio
 * (SchoolNav) reconstruye la misma lista para su «anterior / siguiente»: si
 * los dos filtraran distinto, el «21 de 184» de la ficha no sería la fila 21
 * de la tabla.
 *
 * La URL lleva nombres, como el resto de filtros, pero nunca se filtra por
 * nombre: cada valor se traduce a ids del índice. Hace falta porque un nombre
 * de distrito no identifica un distrito —«Miraflores» son tres, en Lima,
 * Arequipa y Huánuco— y por eso elegir un distrito fija también su provincia
 * y su región, que lo vuelven inequívoco. La UGEL no lo necesita: su nombre
 * visible ya es único (ver etiquetasUgel en el proveedor).
 *
 * No hay jerarquía estricta. Una UGEL puede cubrir distritos de dos regiones
 * (Contralmirante Villar atiende colegios de Máncora, en Piura) y un distrito
 * puede repartirse entre dos UGEL (Ate): los filtros se cruzan como
 * dimensiones independientes, y la dependencia solo decide qué opciones se
 * ofrecen y qué selección queda inválida al cambiar otra.
 */

export type ClaveGeo = "region" | "ugel" | "provincia" | "distrito";

/** Orden de presentación, de lo general a lo particular. */
export const CLAVES_GEO: ClaveGeo[] = ["region", "ugel", "provincia", "distrito"];

/** Posición del id en la fila del índice. */
export const POS_GEO: Record<ClaveGeo, number> = { region: 4, ugel: 10, provincia: 3, distrito: 2 };

/** Qué selecciones puede dejar sin sentido un cambio en cada filtro. */
export const DEPENDIENTES: Record<ClaveGeo, ClaveGeo[]> = {
  region: ["ugel", "provincia", "distrito"],
  ugel: ["distrito"],
  provincia: ["distrito"],
  distrito: [],
};

export interface FiltroGeo {
  clave: ClaveGeo;
  valor: string;
  ids: Set<number>;
}

export interface Geo {
  filtros: FiltroGeo[];
  /** Valores que no existen en los datos: no filtran y no se anuncian. */
  ignorados: string[];
  /** Nombres de distrito que siguen designando a más de uno. */
  ambiguos: { valor: string; n: number }[];
}

export const dicGeo = (idx: RankingIndex, k: ClaveGeo): string[] =>
  k === "region" ? idx.dic.r : k === "provincia" ? idx.dic.p : k === "distrito" ? idx.dic.d : (idx.dic.u ?? []);

/** [provinciaId, regiónId] de cada distrito. Una pasada por índice cargado. */
const cachePadres = new WeakMap<RankingIndex, [number, number][]>();
export function padresDistrito(idx: RankingIndex): [number, number][] {
  let p = cachePadres.get(idx);
  if (!p) {
    p = [];
    for (const f of idx.filas) p[f[2]] ??= [f[3], f[4]];
    cachePadres.set(idx, p);
  }
  return p;
}

/** Traduce los valores de la URL a ids. */
export function resolverGeo(idx: RankingIndex, leer: (k: ClaveGeo) => string): Geo {
  const filtros: FiltroGeo[] = [];
  const ignorados: string[] = [];
  const ambiguos: Geo["ambiguos"] = [];

  let region = -1;
  let provincia = -1;
  for (const clave of ["region", "ugel", "provincia"] as ClaveGeo[]) {
    const valor = leer(clave);
    if (!valor) continue;
    const id = dicGeo(idx, clave).indexOf(valor);
    if (id < 0) {
      ignorados.push(valor);
      continue;
    }
    if (clave === "region") region = id;
    if (clave === "provincia") provincia = id;
    filtros.push({ clave, valor, ids: new Set([id]) });
  }

  const distrito = leer("distrito");
  if (distrito) {
    const padres = padresDistrito(idx);
    const ids = new Set<number>();
    idx.dic.d.forEach((nombre, i) => {
      if (nombre !== distrito || !padres[i]) return;
      if (provincia >= 0 && padres[i][0] !== provincia) return;
      if (region >= 0 && padres[i][1] !== region) return;
      ids.add(i);
    });
    if (ids.size === 0) ignorados.push(distrito);
    else {
      filtros.push({ clave: "distrito", valor: distrito, ids });
      if (ids.size > 1) ambiguos.push({ valor: distrito, n: ids.size });
    }
  }

  return { filtros, ignorados, ambiguos };
}

export const cumpleGeo = (f: RankingRow, filtros: FiltroGeo[]): boolean =>
  filtros.every((x) => x.ids.has(f[POS_GEO[x.clave]] as number));

/**
 * Tras un cambio territorial, quita de `p` las selecciones que ya no tienen
 * ningún colegio en común con las demás.
 *
 * Las claves recién elegidas mandan: vienen de opciones que ya eran
 * compatibles con lo anterior. Las otras se comprueban de lo general a lo
 * particular contra lo que va quedando.
 */
export function depurarGeo(idx: RankingIndex, p: URLSearchParams, cambiadas: ClaveGeo[]): void {
  const geo = resolverGeo(idx, (k) => p.get(k) ?? "");
  const aceptados: FiltroGeo[] = [];
  const orden = [...cambiadas, ...CLAVES_GEO.filter((k) => !cambiadas.includes(k))];
  for (const k of orden) {
    const f = geo.filtros.find((x) => x.clave === k);
    if (!f) {
      // Con el nuevo contexto ya no designa nada —un distrito de Lima tras
      // pasar a Cusco—: quedarse en la URL solo produciría un aviso.
      if (!cambiadas.includes(k)) p.delete(k);
      continue;
    }
    if (cambiadas.includes(k) || idx.filas.some((r) => cumpleGeo(r, [...aceptados, f]))) {
      aceptados.push(f);
    } else {
      p.delete(k);
    }
  }
}
