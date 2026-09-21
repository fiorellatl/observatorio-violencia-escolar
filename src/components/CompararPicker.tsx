"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { nf, norm, slugify } from "@/lib/format";
import { useBrowseIndex } from "@/lib/useBrowseIndex";
import { campo } from "@/lib/ui";
import type { BrowseRow } from "@/lib/types";

/**
 * Elegir los colegios a comparar.
 *
 * NO CALCULA NADA. Lo único que hace es escribir slugs en la URL; la página,
 * que es de servidor, los resuelve con `getInstitution` y `getContexto`, las
 * mismas funciones que usa la ficha. Así la comparación no puede decir algo
 * distinto de lo que dice cada ficha por separado, y el estado se puede
 * compartir por enlace: `?colegio=a&colegio=b` es una comparación concreta,
 * citable en un reportaje.
 *
 * Comparte el índice de navegación con el buscador de la portada y con la
 * paleta: el hook lo cachea a nivel de módulo, así que llegar aquí desde una
 * búsqueda no vuelve a descargarlo.
 */
export function CompararPicker({
  elegidos,
  maximo,
}: {
  /** Los que ya están en la URL, con su nombre resuelto en el servidor. */
  elegidos: { slug: string; nombre: string; lugar: string }[];
  /**
   * El tope llega como prop y no como import, a propósito. Importarlo desde
   * `@/lib/comparar` arrastraba a este componente de cliente toda la cadena
   * `comparar → distribucion → provider → node:fs`, y el bundle del navegador
   * reventaba al intentar leer el disco. La regla es del servidor: aquí solo
   * se obedece.
   */
  maximo: number;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const { datos, cargando, error, pedir } = useBrowseIndex();

  useEffect(() => {
    const t = setTimeout(() => setConsulta(q), 120);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const ya = useMemo(() => new Set(elegidos.map((e) => e.slug)), [elegidos]);
  const lleno = elegidos.length >= maximo;

  const hits = useMemo(() => {
    const t = norm(consulta);
    if (t.length < 3 || !datos) return [];
    const soloDigitos = /^\d+$/.test(t);
    const out: { fila: BrowseRow; slug: string; score: number }[] = [];

    for (const fila of datos.filas) {
      const [nombre, cm] = fila;
      let score = -1;

      if (soloDigitos) {
        if (cm === t.padStart(7, "0") || cm.replace(/^0+/, "") === t) score = 100;
        else if (cm.includes(t)) score = 40;
      } else {
        const n = norm(nombre);
        const d = norm(datos.dic.d[fila[2]] ?? "");
        if (n.startsWith(t)) score = 90;
        else if (n.includes(t)) score = 60;
        else if (d.startsWith(t)) score = 35;
        else if (d.includes(t)) score = 20;
      }
      if (score < 0) continue;

      const slug = slugify(nombre, datos.dic.d[fila[2]] ?? "", cm);
      if (ya.has(slug)) continue;
      out.push({ fila, slug, score: score + Math.min(fila[7], 50) / 100 });
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 8);
  }, [consulta, datos, ya]);

  const ir = (slugs: string[]) => {
    const p = new URLSearchParams(params.toString());
    p.delete("colegio");
    for (const s of slugs) p.append("colegio", s);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const anadir = (slug: string) => {
    if (lleno) return;
    ir([...elegidos.map((e) => e.slug), slug]);
    setQ("");
    setAbierto(false);
  };

  const quitar = (slug: string) =>
    ir(elegidos.filter((e) => e.slug !== slug).map((e) => e.slug));

  return (
    <div>
      {elegidos.length > 0 ? (
        <ul className="mb-4 flex flex-wrap gap-2">
          {elegidos.map((e) => (
            <li
              key={e.slug}
              className="flex items-center gap-2.5 rounded-full border border-rule bg-surface py-1.5 pl-4 pr-1.5"
            >
              <span className="text-[0.88rem] font-medium text-ink">{e.nombre}</span>
              <span className="text-[0.76rem] text-ink-3">{e.lugar}</span>
              <button
                type="button"
                onClick={() => quitar(e.slug)}
                aria-label={`Quitar ${e.nombre} de la comparación`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-rule-2 hover:text-ink"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={caja} className="relative max-w-xl">
        <label htmlFor="buscar-comparar" className="sr-only">
          Buscar un colegio para comparar
        </label>
        <input
          id="buscar-comparar"
          type="search"
          value={q}
          disabled={lleno}
          onFocus={() => {
            pedir();
            setAbierto(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setAbierto(true);
          }}
          placeholder={
            lleno
              ? `Ya son ${maximo}: quita uno para añadir otro`
              : "Añade un colegio por nombre, distrito o código modular"
          }
          autoComplete="off"
          className={`${campo} disabled:cursor-not-allowed disabled:text-ink-3`}
        />

        {abierto && !lleno && consulta.trim().length >= 3 ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-rule bg-surface-2 shadow-lg shadow-black/10">
            {cargando ? (
              <p className="px-4 py-3 text-[0.85rem] text-ink-3">Cargando colegios…</p>
            ) : error ? (
              <p className="px-4 py-3 text-[0.85rem] text-ink-2">
                No se pudo cargar la lista. Recarga la página.
              </p>
            ) : hits.length === 0 ? (
              <p className="px-4 py-3 text-[0.85rem] text-ink-3">
                Ningún colegio coincide con «{consulta}».
              </p>
            ) : (
              <ul>
                {hits.map(({ fila, slug }) => (
                  <li key={slug}>
                    <button
                      type="button"
                      onClick={() => anadir(slug)}
                      className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent-soft/60"
                    >
                      <span className="min-w-0 flex-1 truncate text-[0.92rem] text-ink">
                        {fila[0]}
                      </span>
                      <span className="shrink-0 text-[0.78rem] text-ink-3">
                        {datos?.dic.d[fila[2]]} · {datos?.dic.r[fila[4]]}
                      </span>
                      <span className="tabular shrink-0 text-[0.78rem] text-ink-3">
                        {nf(fila[7])}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
