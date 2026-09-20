"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nf, norm, slugify } from "@/lib/format";
import { useBrowseIndex } from "@/lib/useBrowseIndex";
import type { BrowseRow } from "@/lib/types";

/**
 * Buscador global. Vive en la cabecera y se abre con Ctrl/Cmd + K.
 *
 * Busca por nombre, distrito y código modular. El código modular no se muestra
 * como protagonista —a nadie le dice nada— pero sí se acepta al escribir,
 * porque es lo que trae pegado quien viene de un documento oficial.
 */
const MAXIMO = 20;
const MINIMO = 2;

function puntuar(fila: BrowseRow, t: string, distrito: string, soloDigitos: boolean): number {
  const [nombre, cm] = fila;
  if (soloDigitos) {
    if (cm === t.padStart(7, "0") || cm.replace(/^0+/, "") === t) return 100;
    return cm.includes(t) ? 40 : -1;
  }
  const n = norm(nombre);
  if (n.startsWith(t)) return 90;
  if (n.includes(t)) return 60;
  const d = norm(distrito);
  if (d.startsWith(t)) return 35;
  return d.includes(t) ? 20 : -1;
}

export function CommandPalette() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [consulta, setConsulta] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const { datos, cargando, error, pedir } = useBrowseIndex();

  // Ctrl/Cmd + K abre; Escape cierra. Se registra una sola vez.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
      } else if (e.key === "Escape") {
        setAbierto(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    pedir();
    const t = setTimeout(() => input.current?.focus(), 30);
    // El fondo no debe desplazarse mientras el diálogo está abierto.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = previo;
    };
  }, [abierto, pedir]);

  // Debounce: teclear rápido no debe recorrer 22.000 filas en cada pulsación.
  useEffect(() => {
    const t = setTimeout(() => setConsulta(q), 120);
    return () => clearTimeout(t);
  }, [q]);

  const hits = useMemo(() => {
    const t = norm(consulta);
    if (t.length < MINIMO || !datos) return [];
    const soloDigitos = /^\d+$/.test(t);
    const out: { fila: BrowseRow; score: number }[] = [];
    for (const fila of datos.filas) {
      const s = puntuar(fila, t, datos.dic.d[fila[2]] ?? "", soloDigitos);
      if (s >= 0) out.push({ fila, score: s + Math.min(fila[7], 60) / 100 });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, MAXIMO).map((o) => o.fila);
  }, [consulta, datos]);

  useEffect(() => setSel(0), [consulta]);

  const ir = useCallback(
    (fila: BrowseRow) => {
      const distrito = datos?.dic.d[fila[2]] ?? "";
      setAbierto(false);
      setQ("");
      router.push(`/colegio/${slugify(fila[0], distrito, fila[1])}`);
    },
    [datos, router]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && hits[sel]) {
      e.preventDefault();
      ir(hits[sel]);
    }
  };

  // Mantiene visible la fila seleccionada al navegar con el teclado.
  useEffect(() => {
    lista.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        onMouseEnter={pedir}
        // Vive en la barra de noche: se estiliza contra ese fondo, no contra el papel.
        className="flex items-center gap-2 rounded-full border border-noche-rule-2 px-3.5 py-1.5 text-[0.8rem] text-noche-ink-3 transition-colors duration-150 ease-suave hover:border-menta hover:text-menta"
        aria-label="Buscar un colegio"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>Buscar colegio</span>
        <kbd className="hidden font-mono text-[0.68rem] tracking-[0.08em] text-noche-ink-4 sm:inline">
          ⌘K
        </kbd>
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 px-4 pt-[12vh] backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar un colegio"
            className="w-full max-w-xl overflow-hidden rounded-xl border border-rule bg-surface shadow-2xl shadow-black/20"
          >
            <div className="flex items-center gap-3 border-b border-rule px-4">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-ink-3">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={input}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Busca un colegio…"
                autoComplete="off"
                spellCheck={false}
                aria-controls="paleta-resultados"
                aria-autocomplete="list"
                role="combobox"
                aria-expanded={hits.length > 0}
                className="w-full bg-transparent py-3.5 text-[1rem] text-ink outline-none placeholder:text-ink-3"
              />
              <kbd className="shrink-0 rounded border border-rule px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-3">
                esc
              </kbd>
            </div>

            <div id="paleta-resultados" ref={lista} role="listbox" className="max-h-[46vh] overflow-y-auto">
              {error ? (
                <p className="px-4 py-6 text-[0.86rem] text-ink-2">
                  No se pudo cargar el índice de colegios. Revisa tu conexión y vuelve a
                  intentarlo.
                </p>
              ) : cargando && !datos ? (
                <p className="px-4 py-6 text-[0.86rem] text-ink-3">Cargando el índice…</p>
              ) : norm(q).length < MINIMO ? (
                <p className="px-4 py-6 text-[0.86rem] text-ink-3">
                  Escribe el nombre de un colegio, un distrito o un código modular.
                </p>
              ) : hits.length === 0 ? (
                <div className="px-4 py-6">
                  <p className="text-[0.86rem] text-ink-2">
                    Ningún colegio coincide con «{q.trim()}».
                  </p>
                  <p className="mt-1.5 text-[0.8rem] text-ink-3">
                    Prueba con menos palabras. Si el colegio no aparece, puede que no tenga
                    reportes registrados en SíseVe.
                  </p>
                </div>
              ) : (
                hits.map((fila, i) => {
                  const distrito = datos?.dic.d[fila[2]] ?? "";
                  const region = datos?.dic.r[fila[4]] ?? "";
                  // Una institución ofrece varios niveles y se nombran todos:
                  // el buscador devuelve un colegio, no un colegio por nivel.
                  const nivel = (fila[6] ?? []).map((k) => datos?.dic.n[k]).filter(Boolean).join(" · ");
                  return (
                    <button
                      key={`${fila[1]}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === sel}
                      data-sel={i === sel}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => ir(fila)}
                      className={`block w-full border-b border-rule-2 px-4 py-2.5 text-left last:border-b-0 ${
                        i === sel ? "bg-accent-soft" : ""
                      }`}
                    >
                      <span className="block text-[0.92rem] font-medium leading-snug text-ink">
                        {fila[0]}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.76rem] text-ink-3">
                        <span>
                          {distrito}, {region}
                        </span>
                        {nivel ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{nivel}</span>
                          </>
                        ) : null}
                        <span aria-hidden>·</span>
                        <span className="tabular">
                          {nf(fila[7])} {fila[7] === 1 ? "reporte" : "reportes"}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

          </div>
        </div>
      ) : null}
    </>
  );
}
