"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nf, norm, slugify } from "@/lib/format";
import type { SearchRow } from "@/lib/types";

/**
 * Buscador tolerante: nombre del colegio, código modular o distrito.
 *
 * El índice (1,3 MB) NO va en el bundle: se descarga la primera vez que alguien
 * escribe y el CDN lo cachea. Así la home carga ligera aunque el índice cubra
 * los 22 mil colegios.
 */
export function SearchBox({
  autoFocus = false,
  placeholder = "Busca un colegio, distrito o código modular",
}: {
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [sel, setSel] = useState(-1);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    if (rows || cargando) return;
    setCargando(true);
    try {
      const r = await fetch("/data/search-index.json");
      setRows((await r.json()) as SearchRow[]);
    } catch {
      setRows([]);
    } finally {
      setCargando(false);
    }
  }, [rows, cargando]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const hits = useMemo(() => {
    const t = norm(q);
    if (t.length < 3 || !rows) return [];
    const soloDigitos = /^\d+$/.test(t);
    const out: { row: SearchRow; score: number }[] = [];

    for (const row of rows) {
      const [nombre, distrito, region, cm, total] = row;
      let score = -1;

      if (soloDigitos) {
        // Código modular: acepta con y sin ceros por delante.
        if (cm === t.padStart(7, "0") || cm.replace(/^0+/, "") === t) score = 100;
        else if (cm.includes(t)) score = 40;
      } else {
        const n = norm(nombre);
        const d = norm(distrito);
        if (n.startsWith(t)) score = 90;
        else if (n.includes(t)) score = 60;
        else if (d.startsWith(t)) score = 35;
        else if (d.includes(t) || norm(region).includes(t)) score = 20;
      }

      if (score >= 0) out.push({ row, score: score + Math.min(total, 50) / 100 });
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 25).map((o) => o.row);
  }, [q, rows]);

  const ir = (row: SearchRow) => `/colegio/${slugify(row[0], row[1], row[3])}`;

  return (
    <div ref={caja} className="relative">
      <label htmlFor="buscador" className="sr-only">
        {placeholder}
      </label>
      <input
        id="buscador"
        type="text"
        role="combobox"
        aria-expanded={abierto && hits.length > 0}
        aria-controls="resultados-busqueda"
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        onFocus={() => {
          void cargar();
          setAbierto(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(-1);
          setAbierto(true);
          void cargar();
        }}
        onKeyDown={(e) => {
          if (!hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            window.location.href = ir(hits[Math.max(sel, 0)]);
          } else if (e.key === "Escape") {
            setAbierto(false);
          }
        }}
        className="w-full rounded-xl border-2 border-rule bg-surface px-4 py-3.5 text-[1.02rem] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
      />

      {abierto && q.trim().length >= 3 ? (
        <div
          id="resultados-busqueda"
          role="listbox"
          className="absolute z-30 mt-2 max-h-[22rem] w-full overflow-y-auto rounded-xl border border-rule bg-surface shadow-lg shadow-black/5"
        >
          {cargando && !rows ? (
            <p className="px-4 py-3 text-[0.85rem] text-ink-3">Cargando el índice…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-[0.85rem] text-ink-3">
              Sin resultados. Prueba con menos palabras o con el código modular.
            </p>
          ) : (
            hits.map((row, i) => (
              <Link
                key={`${row[3]}-${i}`}
                href={ir(row)}
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setSel(i)}
                className={`block border-b border-rule-2 px-4 py-2.5 last:border-b-0 ${
                  i === sel ? "bg-accent-soft" : ""
                }`}
              >
                <span className="block text-[0.92rem] font-medium leading-snug text-ink">
                  {row[0]}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.76rem] text-ink-3">
                  <span>
                    {row[1]}, {row[2]}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="tabular font-mono">{row[3]}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular">
                    {nf(row[4])} {row[4] === 1 ? "reporte" : "reportes"}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
