"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nf, norm } from "@/lib/format";
import { campo } from "@/lib/ui";
import type { RankingRow } from "@/lib/types";

/**
 * Encontrar un colegio dentro del ranking.
 *
 * NO DESCARGA NADA. Busca sobre `idx.filas`, el índice del ranking que la
 * página ya tiene en memoria: son las mismas instituciones que la tabla está
 * ordenando. Bajar además el índice de navegación para poder buscar sería
 * pedir dos veces los mismos nombres.
 *
 * UNA FILA ES UNA INSTITUCIÓN, no un nivel. El modelo institucional ya agrupa
 * primaria, secundaria e inicial bajo un solo colegio, así que buscar «Pedro
 * Ruiz Gallo» devuelve un resultado y no tres. No hay que deduplicar nada
 * aquí: la estructura de datos ya lo resolvió.
 *
 * NO ES UN FILTRO, y por eso está separado de ellos. Elegir un colegio no
 * cambia ni un solo filtro del usuario: lo señala dentro del ranking tal como
 * está, y si los filtros lo dejan fuera, lo dice en vez de ensanchar la
 * consulta por su cuenta.
 */
export function RankingBuscador({
  filas,
  dic,
  elegido,
  onElegir,
}: {
  filas: RankingRow[];
  dic: { r: string[]; d: string[] };
  /** Código modular señalado, o cadena vacía. */
  elegido: string;
  onElegir: (cm: string) => void;
}) {
  const [q, setQ] = useState("");
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState(-1);
  const caja = useRef<HTMLDivElement>(null);

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

  const hits = useMemo(() => {
    const t = norm(consulta);
    if (t.length < 3) return [];
    const soloDigitos = /^\d+$/.test(t);
    const out: { fila: RankingRow; score: number }[] = [];

    for (const fila of filas) {
      const [nombre, cm] = fila;
      let score = -1;
      if (soloDigitos) {
        if (cm === t.padStart(7, "0") || cm.replace(/^0+/, "") === t) score = 100;
        else if (cm.includes(t)) score = 40;
      } else {
        // `norm` quita tildes y baja a minúsculas, así que «jose» encuentra
        // «José» sin que haya que escribir el acento.
        const n = norm(nombre);
        if (n.startsWith(t)) score = 90;
        else if (n.includes(t)) score = 60;
        else if (norm(dic.d[fila[2]] ?? "").includes(t)) score = 25;
      }
      if (score >= 0) out.push({ fila, score: score + Math.min(fila[7], 50) / 100 });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 8).map((o) => o.fila);
  }, [consulta, filas, dic]);

  useEffect(() => setSel(-1), [consulta]);

  const elegir = (cm: string) => {
    onElegir(cm);
    setQ("");
    setAbierto(false);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, -1));
    } else if (e.key === "Enter" && sel >= 0) {
      e.preventDefault();
      elegir(hits[sel][1]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  return (
    <div ref={caja} className="relative">
      <label htmlFor="buscar-ranking" className="meta">
        Buscar colegio
      </label>
      <input
        id="buscar-ranking"
        type="search"
        value={q}
        role="combobox"
        aria-expanded={abierto && hits.length > 0}
        aria-controls="resultados-ranking"
        autoComplete="off"
        placeholder="Buscar colegio…"
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        className={`${campo} mt-1.5`}
      />

      {abierto && consulta.trim().length >= 3 ? (
        <div
          id="resultados-ranking"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-rule bg-surface-2 shadow-lg shadow-black/10"
        >
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-[0.85rem] text-ink-3">
              Ningún colegio del ranking coincide con «{consulta}».
            </p>
          ) : (
            <ul role="listbox" aria-label="Colegios encontrados">
              {hits.map((f, i) => (
                <li key={f[1]} role="option" aria-selected={i === sel}>
                  <button
                    type="button"
                    onMouseEnter={() => setSel(i)}
                    onClick={() => elegir(f[1])}
                    className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === sel ? "bg-accent-soft/60" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.92rem] text-ink">
                      {f[0]}
                    </span>
                    <span className="shrink-0 text-[0.78rem] text-ink-3">
                      {dic.d[f[2]]} · {dic.r[f[4]]}
                    </span>
                    <span className="tabular shrink-0 text-[0.78rem] text-ink-3">
                      {nf(f[7])}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {elegido ? (
        <button
          type="button"
          onClick={() => onElegir("")}
          className="mt-2 text-[0.8rem] text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          Quitar la búsqueda
        </button>
      ) : null}
    </div>
  );
}
