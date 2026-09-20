"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { nf, norm, slugify } from "@/lib/format";
import { useBrowseIndex } from "@/lib/useBrowseIndex";
import { boton, campo, meta } from "@/lib/ui";
import type { BrowseIndex, BrowseRow } from "@/lib/types";

/**
 * Explorador de colegios.
 *
 * Los filtros viven en la URL para que un resultado se pueda compartir y para
 * que el botón de atrás del navegador haga lo que se espera.
 *
 * El índice llega por `fetch`, no como props: pasarlo por props obligaba a
 * serializar las 22.569 filas dentro del HTML y /colegios pesaba 1,85 MB.
 *
 * No hay orden por número de reportes ni posiciones: esta página sirve para
 * encontrar un colegio, no para ordenarlos entre sí.
 */
const TOPE = 150;

const CLAVES = ["region", "provincia", "distrito", "gestion", "nivel", "q"] as const;
type Clave = (typeof CLAVES)[number];
type Filtros = Record<Clave, string>;

const VACIO: Filtros = { region: "", provincia: "", distrito: "", gestion: "", nivel: "", q: "" };

/** Devuelve los valores presentes en las filas que ya pasaron el resto de filtros. */
function opciones(filas: BrowseRow[], dic: string[], pos: number): string[] {
  const vistos = new Set<number>();
  for (const f of filas) vistos.add(f[pos] as number);
  return [...vistos]
    .map((i) => dic[i])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

function aplica(filas: BrowseRow[], idx: BrowseIndex, f: Filtros, salvo?: Clave): BrowseRow[] {
  const id = (dic: string[], v: string) => (v ? dic.indexOf(v) : -1);
  const r = salvo === "region" ? -1 : id(idx.dic.r, f.region);
  const p = salvo === "provincia" ? -1 : id(idx.dic.p, f.provincia);
  const d = salvo === "distrito" ? -1 : id(idx.dic.d, f.distrito);
  const g = salvo === "gestion" ? -1 : id(idx.dic.g, f.gestion);
  const n = salvo === "nivel" ? -1 : id(idx.dic.n, f.nivel);
  const q = salvo === "q" ? "" : norm(f.q);

  return filas.filter((x) => {
    if (r >= 0 && x[4] !== r) return false;
    if (p >= 0 && x[3] !== p) return false;
    if (d >= 0 && x[2] !== d) return false;
    if (g >= 0 && x[5] !== g) return false;
    if (n >= 0 && x[6] !== n) return false;
    if (q && !norm(x[0]).includes(q)) return false;
    return true;
  });
}

export function SchoolExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { datos, cargando, error, pedir } = useBrowseIndex(true);

  const filtros = useMemo<Filtros>(() => {
    const f = { ...VACIO };
    for (const k of CLAVES) f[k] = params.get(k) ?? "";
    return f;
  }, [params]);

  // El texto se escribe en local y se vuelca a la URL con retardo: escribir no
  // debe generar una entrada de historial por letra.
  const [texto, setTexto] = useState(filtros.q);
  useEffect(() => setTexto(filtros.q), [filtros.q]);

  const poner = useCallback(
    (cambios: Partial<Filtros>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(cambios)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      // Cambiar de región invalida lo que colgaba de ella.
      if ("region" in cambios) {
        p.delete("provincia");
        p.delete("distrito");
      }
      if ("provincia" in cambios) p.delete("distrito");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (texto !== filtros.q) poner({ q: texto });
    }, 250);
    return () => clearTimeout(t);
  }, [texto, filtros.q, poner]);

  const activos = CLAVES.filter((k) => filtros[k]).length;

  const resultados = useMemo(
    () => (datos ? aplica(datos.filas, datos, filtros) : []),
    [datos, filtros]
  );

  // Cada desplegable ofrece lo que existe bajo el resto de filtros, para que
  // no se pueda llegar a una combinación de cero resultados eligiendo a ciegas.
  const listas = useMemo(() => {
    if (!datos) return null;
    return {
      region: opciones(aplica(datos.filas, datos, filtros, "region"), datos.dic.r, 4),
      provincia: opciones(aplica(datos.filas, datos, filtros, "provincia"), datos.dic.p, 3),
      distrito: opciones(aplica(datos.filas, datos, filtros, "distrito"), datos.dic.d, 2),
      gestion: opciones(aplica(datos.filas, datos, filtros, "gestion"), datos.dic.g, 5),
      nivel: opciones(aplica(datos.filas, datos, filtros, "nivel"), datos.dic.n, 6),
    };
  }, [datos, filtros]);

  const Select = ({ k, label }: { k: Exclude<Clave, "q">; label: string }) => (
    <div>
      <label htmlFor={`f-${k}`} className={`${meta} block`}>
        {label}
      </label>
      <select
        id={`f-${k}`}
        value={filtros[k]}
        disabled={!listas}
        onChange={(e) => poner({ [k]: e.target.value } as Partial<Filtros>)}
        className={`${campo} mt-1.5 disabled:opacity-50`}
      >
        <option value="">Todas</option>
        {(listas?.[k] ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-rule bg-surface p-6">
        <p className="text-[0.92rem] font-medium text-ink-2">No se pudo cargar el índice</p>
        <p className="mt-1.5 text-[0.85rem] text-ink-3">
          Revisa tu conexión. El listado necesita descargar el índice de colegios una vez.
        </p>
        <button type="button" onClick={pedir} className={`${boton} mt-4`}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl border border-rule bg-surface p-4 sm:p-5">
        <div>
          <label htmlFor="f-q" className={`${meta} block`}>
            Nombre del colegio
          </label>
          <input
            id="f-q"
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Filtra por nombre"
            autoComplete="off"
            spellCheck={false}
            className={`${campo} mt-1.5`}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select k="region" label="Región" />
          <Select k="provincia" label="Provincia" />
          <Select k="distrito" label="Distrito" />
          <Select k="gestion" label="Gestión" />
          <Select k="nivel" label="Nivel" />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule-2 pt-3.5">
          <p className="text-[0.84rem] text-ink-2" role="status" aria-live="polite">
            {cargando && !datos ? (
              "Cargando el índice de colegios…"
            ) : (
              <>
                <span className="tabular font-medium text-ink">{nf(resultados.length)}</span>{" "}
                {resultados.length === 1 ? "servicio educativo" : "servicios educativos"}
                {activos > 0 ? (
                  <span className="text-ink-3">
                    {" "}
                    · {activos} {activos === 1 ? "filtro activo" : "filtros activos"}
                  </span>
                ) : null}
              </>
            )}
          </p>
          {activos > 0 ? (
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className={boton}
            >
              Quitar filtros
            </button>
          ) : null}
        </div>
      </div>

      {datos && resultados.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-rule bg-surface p-6">
          <p className="text-[0.92rem] font-medium text-ink-2">Ningún colegio coincide</p>
          <p className="mt-1.5 max-w-prose text-[0.85rem] leading-relaxed text-ink-3">
            Prueba quitando algún filtro. Ten en cuenta que aquí solo aparecen colegios con
            al menos un reporte registrado en SíseVe: que un colegio no esté no significa
            que no ocurra violencia, significa que nadie la reportó.
          </p>
        </div>
      ) : null}

      {resultados.length > 0 ? (
        <>
          <ul className="mt-6 divide-y divide-rule-2 overflow-hidden rounded-xl border border-rule bg-surface">
            {resultados.slice(0, TOPE).map((f, i) => {
              const distrito = datos!.dic.d[f[2]];
              const provincia = datos!.dic.p[f[3]];
              const region = datos!.dic.r[f[4]];
              const gestion = datos!.dic.g[f[5]];
              const nivel = datos!.dic.n[f[6]];
              return (
                <li key={`${f[1]}-${i}`}>
                  <Link
                    href={`/colegio/${slugify(f[0], distrito, f[1])}`}
                    className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-accent-soft"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.94rem] font-medium leading-snug text-ink group-hover:text-accent">
                        {f[0]}
                      </span>
                      <span className="mt-0.5 block text-[0.78rem] text-ink-3">
                        {distrito}
                        {provincia !== distrito ? `, ${provincia}` : ""}, {region}
                        {nivel ? ` · ${nivel}` : ""} · {gestion}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-right text-[0.78rem] text-ink-3">
                      {f[8] ? (
                        <>
                          último reporte <span className="text-ink-2">{f[8]}</span>
                        </>
                      ) : (
                        "sin año registrado"
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {resultados.length > TOPE ? (
            <p className="mt-3 text-[0.82rem] text-ink-3">
              Se muestran los primeros {nf(TOPE)} de {nf(resultados.length)}. Afina los
              filtros o busca por nombre para encontrar uno concreto.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
