"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nf, norm, slugify } from "@/lib/format";
import { useBrowseIndex } from "@/lib/useBrowseIndex";
import type { BrowseRow } from "@/lib/types";

/**
 * Buscador grande, para la portada.
 *
 * Comparte índice con el buscador global de la cabecera: el hook cachea la
 * descarga a nivel de módulo, así que abrir la paleta después de escribir aquí
 * no vuelve a pedir nada.
 */
export function SearchBox({
  autoFocus = false,
  placeholder = "Busca un colegio, distrito o código modular",
}: {
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [consulta, setConsulta] = useState("");
  const [sel, setSel] = useState(-1);
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

  const hits = useMemo(() => {
    const t = norm(consulta);
    if (t.length < 3 || !datos) return [];
    const soloDigitos = /^\d+$/.test(t);
    const out: { fila: BrowseRow; score: number }[] = [];

    for (const fila of datos.filas) {
      const [nombre, cm] = fila;
      let score = -1;

      if (soloDigitos) {
        // Código modular: se acepta con y sin ceros por delante.
        if (cm === t.padStart(7, "0") || cm.replace(/^0+/, "") === t) score = 100;
        else if (cm.includes(t)) score = 40;
      } else {
        const n = norm(nombre);
        const d = norm(datos.dic.d[fila[2]] ?? "");
        if (n.startsWith(t)) score = 90;
        else if (n.includes(t)) score = 60;
        else if (d.startsWith(t)) score = 35;
        else if (d.includes(t) || norm(datos.dic.r[fila[4]] ?? "").includes(t)) score = 20;
      }

      if (score >= 0) out.push({ fila, score: score + Math.min(fila[7], 50) / 100 });
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 25).map((o) => o.fila);
  }, [consulta, datos]);

  useEffect(() => setSel(-1), [consulta]);

  const ir = useCallback(
    (fila: BrowseRow) => `/colegio/${slugify(fila[0], datos?.dic.d[fila[2]] ?? "", fila[1])}`,
    [datos]
  );

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
          pedir();
          setAbierto(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
          pedir();
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
          {error ? (
            <p className="px-4 py-3 text-[0.85rem] text-ink-2">
              No se pudo cargar el índice. Revisa tu conexión.
            </p>
          ) : cargando && !datos ? (
            <p className="px-4 py-3 text-[0.85rem] text-ink-3">Cargando el índice…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-[0.85rem] text-ink-3">
              Sin resultados. Prueba con menos palabras o con el código modular.
            </p>
          ) : (
            hits.map((fila, i) => (
              <Link
                key={`${fila[1]}-${i}`}
                href={ir(fila)}
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setSel(i)}
                className={`block border-b border-rule-2 px-4 py-2.5 last:border-b-0 ${
                  i === sel ? "bg-accent-soft" : ""
                }`}
              >
                <span className="block text-[0.92rem] font-medium leading-snug text-ink">
                  {fila[0]}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.76rem] text-ink-3">
                  <span>
                    {datos?.dic.d[fila[2]]}, {datos?.dic.r[fila[4]]}
                  </span>
                  {fila[6]?.length ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        {fila[6].map((k) => datos?.dic.n[k]).filter(Boolean).join(" · ")}
                      </span>
                    </>
                  ) : null}
                  <span aria-hidden>·</span>
                  <span className="tabular">
                    {nf(fila[7])} {fila[7] === 1 ? "reporte" : "reportes"}
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
