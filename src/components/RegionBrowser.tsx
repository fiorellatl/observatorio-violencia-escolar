"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { nf, slugify } from "@/lib/format";
import type { SearchRow } from "@/lib/types";

/**
 * Navegación región → distrito → colegio.
 *
 * Para quien no recuerda el nombre exacto del colegio, que es casi todo el
 * mundo. Antes esto era una tabla de 26 filas inertes; ahora cada nivel lleva
 * al siguiente sin cambiar de página, reutilizando el mismo índice que ya
 * descarga el buscador.
 *
 * Las barras no son un ranking: miden cuántas instituciones tienen reportes
 * registrados, que es sobre todo el tamaño del sistema educativo de cada zona.
 */
export function RegionBrowser({ filas }: { filas: SearchRow[] }) {
  const [region, setRegion] = useState<string | null>(null);
  const [distrito, setDistrito] = useState<string | null>(null);

  const regiones = useMemo(() => {
    const m = new Map<string, number>();
    for (const [, , r] of filas) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filas]);

  const maxRegion = Math.max(...regiones.map(([, n]) => n), 1);

  const distritos = useMemo(() => {
    if (!region) return [];
    const m = new Map<string, number>();
    for (const [, d, r] of filas) if (r === region) m.set(d, (m.get(d) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filas, region]);

  const colegios = useMemo(() => {
    if (!region || !distrito) return [];
    return filas
      .filter(([, d, r]) => r === region && d === distrito)
      .sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filas, region, distrito]);

  return (
    <div>
      {/* Migas: también son los controles para retroceder. */}
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-[0.84rem]">
        <button
          type="button"
          onClick={() => {
            setRegion(null);
            setDistrito(null);
          }}
          className={region ? "text-accent hover:underline" : "font-medium text-ink"}
        >
          Todas las regiones
        </button>
        {region ? (
          <>
            <span aria-hidden className="text-ink-3">
              /
            </span>
            <button
              type="button"
              onClick={() => setDistrito(null)}
              className={distrito ? "text-accent hover:underline" : "font-medium text-ink"}
            >
              {region}
            </button>
          </>
        ) : null}
        {distrito ? (
          <>
            <span aria-hidden className="text-ink-3">
              /
            </span>
            <span className="font-medium text-ink">{distrito}</span>
          </>
        ) : null}
      </nav>

      {/* Nivel 1: regiones, con barra para que el volumen se lea */}
      {!region ? (
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {regiones.map(([r, n]) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => setRegion(r)}
                className="group flex w-full items-center gap-3 border-b border-rule-2 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[0.9rem] text-ink group-hover:text-accent">
                  {r}
                </span>
                <span
                  aria-hidden
                  className="hidden h-1.5 shrink-0 rounded-sm bg-accent sm:block"
                  style={{
                    width: `${Math.max((n / maxRegion) * 90, 3)}px`,
                    opacity: 0.35,
                  }}
                />
                <span className="tabular w-14 text-right font-mono text-[0.82rem] font-semibold text-ink-2">
                  {nf(n)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Nivel 2: distritos */}
      {region && !distrito ? (
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {distritos.map(([d, n]) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => setDistrito(d)}
                className="group flex w-full items-baseline gap-3 border-b border-rule-2 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[0.88rem] text-ink group-hover:text-accent">
                  {d}
                </span>
                <span className="tabular font-mono text-[0.8rem] text-ink-3">{nf(n)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Nivel 3: colegios */}
      {region && distrito ? (
        <>
          <p className="mb-3 text-[0.84rem] text-ink-2">
            {nf(colegios.length)}{" "}
            {colegios.length === 1 ? "servicio educativo" : "servicios educativos"} con
            reportes registrados en {distrito}. Un mismo colegio puede aparecer varias
            veces: el Estado le da un código modular a cada nivel.
          </p>
          <ul className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
            {colegios.map((c) => (
              <li key={c[3]}>
                <Link
                  href={`/colegio/${slugify(c[0], c[1], c[3])}`}
                  className="group flex items-baseline gap-3 border-b border-rule-2 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-[0.88rem] leading-snug text-ink group-hover:text-accent">
                    {c[0]}
                    <span className="ml-2 text-[0.75rem] text-ink-3">
                      {c[5] ? `${c[5]} · ` : ""}
                      <span className="font-mono">{c[3]}</span>
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-mono text-[0.8rem] text-ink-2">
                    {nf(c[4])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
