"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { norm } from "@/lib/format";
import { campo, meta as clsMeta } from "@/lib/ui";

/**
 * Un selector con buscador, para listas largas.
 *
 * Un <select> nativo con 1.600 distritos obligaba a hacer scroll hasta
 * encontrar el tuyo, y en un teléfono eso es casi imposible. Aquí se escribe:
 * «mira» deja Miraflores, sin importar tildes ni mayúsculas.
 *
 * En pantalla ancha se abre debajo del botón; en un teléfono ocupa la parte
 * baja de la pantalla, con el teclado ya abierto y filas grandes para el
 * dedo. Flechas, Enter y Escape funcionan como en un selector normal.
 */
export interface OpcionSelector {
  valor: string;
  etiqueta: string;
  /** Texto chico a la derecha: la provincia de un distrito repetido, etc. */
  detalle?: string;
}

export function SelectorBuscable({
  etiqueta,
  todos,
  valor,
  opciones,
  onCambio,
}: {
  etiqueta: string;
  todos: string;
  valor: string;
  opciones: OpcionSelector[];
  onCambio: (valor: string) => void;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const elegida = opciones.find((o) => o.valor === valor);
  const filtradas = useMemo(() => {
    const t = norm(busca.trim());
    const base = [{ valor: "", etiqueta: todos } as OpcionSelector, ...opciones];
    if (!t) return base;
    // Primero lo que empieza como lo escrito; después lo que lo contiene.
    const empieza = opciones.filter((o) => norm(o.etiqueta).startsWith(t));
    const contiene = opciones.filter((o) => !norm(o.etiqueta).startsWith(t) && norm(`${o.etiqueta} ${o.detalle ?? ""}`).includes(t));
    return [...empieza, ...contiene];
  }, [busca, opciones, todos]);

  useEffect(() => {
    if (!abierto) return;
    setActivo(0);
    const t = setTimeout(() => entrada.current?.focus(), 10);
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", fuera);
    };
  }, [abierto]);

  useEffect(() => setActivo(0), [busca]);

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-i="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo]);

  const elegir = (v: string) => {
    onCambio(v);
    setAbierto(false);
    setBusca("");
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => Math.min(filtradas.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtradas[activo]) elegir(filtradas[activo].valor);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  return (
    <div ref={caja} className="relative min-w-0">
      <p id={`${id}-l`} className={`${clsMeta} block`}>
        {etiqueta}
      </p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-labelledby={`${id}-l ${id}-v`}
        onClick={() => setAbierto((x) => !x)}
        className={`${campo} mt-1.5 flex items-center justify-between gap-2 text-left ${valor ? "border-ink-3" : ""}`}
      >
        <span id={`${id}-v`} className={`truncate ${valor ? "font-medium text-ink" : "text-ink-2"}`}>
          {elegida ? elegida.etiqueta : todos}
        </span>
        <span aria-hidden className="shrink-0 text-ink-3">
          ▾
        </span>
      </button>

      {abierto ? (
        <>
          {/* En teléfono: velo y hoja inferior. En pantalla ancha: menú. */}
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" aria-hidden onClick={() => setAbierto(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border border-rule bg-surface-2 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-1.5 sm:max-h-[22rem] sm:w-[min(24rem,90vw)] sm:rounded-lg"
            role="dialog"
            aria-label={etiqueta}
          >
            <div className="flex items-center gap-2 border-b border-rule-2 p-3">
              <input
                ref={entrada}
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={teclas}
                placeholder={`Escribe para buscar ${etiqueta.toLowerCase()}`}
                role="combobox"
                aria-expanded
                aria-controls={`${id}-lista`}
                aria-activedescendant={filtradas[activo] ? `${id}-o${activo}` : undefined}
                autoComplete="off"
                className="min-h-11 w-full rounded border border-rule bg-surface px-3 text-[1rem] text-ink outline-none focus:border-accent sm:min-h-0 sm:py-2 sm:text-[0.9rem]"
              />
              <button type="button" onClick={() => setAbierto(false)} className="min-h-11 px-2 text-[0.85rem] text-ink-2 sm:hidden">
                Cerrar
              </button>
            </div>
            <ul ref={lista} id={`${id}-lista`} role="listbox" className="overflow-y-auto overscroll-contain py-1">
              {filtradas.length === 0 ? (
                <li className="px-4 py-6 text-center text-[0.9rem] text-ink-3">Nada con «{busca}»</li>
              ) : (
                filtradas.map((o, i) => (
                  <li
                    key={o.valor || "__todos"}
                    id={`${id}-o${i}`}
                    data-i={i}
                    role="option"
                    aria-selected={o.valor === valor}
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => elegir(o.valor)}
                    className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-[0.95rem] sm:min-h-0 sm:py-2 sm:text-[0.88rem] ${
                      i === activo ? "bg-accent-soft" : ""
                    } ${o.valor === valor ? "font-medium text-accent" : o.valor ? "text-ink" : "text-ink-2"}`}
                  >
                    <span className="truncate">{o.etiqueta}</span>
                    {o.detalle ? <span className="shrink-0 text-[0.78rem] text-ink-3">{o.detalle}</span> : null}
                  </li>
                ))
              )}
            </ul>
            {busca ? null : (
              <p className="border-t border-rule-2 px-4 py-2 font-mono text-[0.66rem] text-ink-3">
                {opciones.length.toLocaleString("es-PE")} opciones · escribe para filtrar
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
