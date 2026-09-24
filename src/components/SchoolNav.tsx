"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { nf, norm, slugify } from "@/lib/format";
import { cumpleGeo, resolverGeo } from "@/lib/rankingGeo";
import type { BrowseIndex, BrowseRow, RankingIndex, RankingRow } from "@/lib/types";

/**
 * Navegación entre colegios.
 *
 * El problema que resuelve: una ficha era un callejón sin salida. Se entraba
 * desde una lista filtrada y la única salida era el botón de atrás, así que
 * "mirar diez colegios de Cajamarca" costaba veinte navegaciones.
 *
 * LA REGLA: el anterior y el siguiente pertenecen al MISMO universo desde el
 * que se llegó. Si el usuario venía del ranking de privados de Cajamarca en
 * 2025, el siguiente es el puesto 22 de esa tabla, no el colegio que sigue
 * por orden alfabético en todo el país. El contexto viaja en la URL —los
 * mismos parámetros que usan los exploradores, más `de`—, así que es
 * compartible y sobrevive a una recarga.
 *
 * Sin contexto no se inventa uno: se cae a un universo que la interfaz puede
 * nombrar con honestidad —los colegios del mismo distrito, por orden
 * alfabético— y se dice cuál es.
 *
 * El índice llega por `fetch` desde una ruta estática que el CDN ya cachea:
 * la ficha se prerrenderiza en miles de páginas y no puede llevar dentro la
 * lista de sus vecinos.
 */

type Origen = "rankings" | "colegios" | "distrito";

type Vecino = { slug: string; nombre: string } | null;

type Universo = {
  etiqueta: string;
  /** Enlace de vuelta a la lista de origen, con sus filtros intactos. */
  volver: string;
  volverLabel: string;
  indice: number;
  total: number;
  anterior: Vecino;
  siguiente: Vecino;
};

function cargar<T>(url: string): Promise<T> {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  });
}

export function SchoolNav({
  cm,
  distrito,
  departamento,
  compacto = false,
  tono = "papel",
}: {
  cm: string;
  distrito: string;
  departamento: string;
  /** Variante de pie: sin la línea de contexto, solo las dos salidas. */
  compacto?: boolean;
  tono?: "papel" | "noche";
}) {
  const noche = tono === "noche";
  const params = useSearchParams();
  const router = useRouter();
  const de = params.get("de");
  const origen: Origen = de === "rankings" ? "rankings" : de === "colegios" ? "colegios" : "distrito";

  const [browse, setBrowse] = useState<BrowseIndex | null>(null);
  const [rank, setRank] = useState<RankingIndex | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    const url = origen === "rankings" ? "/data/ranking-index.json" : "/data/browse-index.json";
    cargar<BrowseIndex | RankingIndex>(url)
      .then((d) => {
        if (!vivo) return;
        if (origen === "rankings") setRank(d as RankingIndex);
        else setBrowse(d as BrowseIndex);
      })
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [origen]);

  const universo = useMemo<Universo | null>(() => {
    const qs = new URLSearchParams(params.toString());
    qs.delete("de");
    const cola = qs.toString();

    // Etiqueta del universo: se nombra con los filtros que lo definen, de lo
    // general a lo particular.
    const trozos = (anio: string | null) => {
      const t: string[] = [];
      if (anio) t.push(anio);
      for (const k of ["region", "ugel", "provincia", "distrito", "gestion", "nivel"]) {
        const v = params.get(k);
        if (v) t.push(v);
      }
      return t;
    };

    if (origen === "rankings" && rank) {
      const anio = params.get("anio") || rank.anio_principal;
      const metrica = params.get("metrica") === "tasa" ? "tasa" : "reportes";
      const tipos = ["todos", "fisica", "psicologica", "sexual"];
      const tipo = params.get("tipo") ?? "todos";
      const pos = Math.max(0, tipos.indexOf(tipo));
      const verCeros = params.get("ceros") === "1";
      const hayTasa = anio === rank.anio_tasa;

      const id = (dic: string[], v: string | null) => (v ? dic.indexOf(v) : -1);
      const geo = resolverGeo(rank, (k) => params.get(k) ?? "").filtros;
      const g = id(rank.dic.g, params.get("gestion"));
      const n = id(rank.dic.n, params.get("nivel"));

      // Mismo filtrado, mismo orden y mismo desempate que el explorador: si
      // dieran listas distintas, el "21 de 184" de la ficha no coincidiría
      // con la fila 21 de la tabla.
      const out: { f: RankingRow; v: number }[] = [];
      for (const f of rank.filas) {
        if (!cumpleGeo(f, geo)) continue;
        if (g >= 0 && f[5] !== g) continue;
        if (n >= 0 && !f[6].includes(n)) continue;
        const c = f[8][anio];
        const conteo = c ? c[pos] : 0;
        if (metrica === "tasa") {
          const mat = f[7];
          if (!hayTasa || mat < rank.matricula_minima) continue;
          if (conteo === 0 && !verCeros) continue;
          out.push({ f, v: (conteo / mat) * 1000 });
        } else {
          if (conteo === 0) continue;
          out.push({ f, v: conteo });
        }
      }
      out.sort((a, b) => b.v - a.v || a.f[0].localeCompare(b.f[0], "es"));

      const i = out.findIndex((x) => x.f[1] === cm);
      if (i < 0) return null;
      const vecino = (j: number): Vecino => {
        const x = out[j];
        if (!x) return null;
        return { slug: slugify(x.f[0], rank.dic.d[x.f[2]], x.f[1]), nombre: x.f[0] };
      };

      return {
        etiqueta: [
          metrica === "tasa" ? "Tasa de reportes" : "Reportes registrados",
          ...trozos(anio),
        ].join(" · "),
        volver: cola ? `/rankings?${cola}` : "/rankings",
        volverLabel: "Ver el ranking",
        indice: i,
        total: out.length,
        anterior: vecino(i - 1),
        siguiente: vecino(i + 1),
      };
    }

    if (browse) {
      const id = (dic: string[], v: string | null) => (v ? dic.indexOf(v) : -1);
      // Sin contexto, el universo es el distrito del propio colegio: es real,
      // se nombra en una línea y casi siempre es el que interesa.
      const conFiltros = origen === "colegios";
      const r = conFiltros ? id(browse.dic.r, params.get("region")) : id(browse.dic.r, departamento);
      const pr = conFiltros ? id(browse.dic.p, params.get("provincia")) : -1;
      const d = conFiltros ? id(browse.dic.d, params.get("distrito")) : id(browse.dic.d, distrito);
      const g = conFiltros ? id(browse.dic.g, params.get("gestion")) : -1;
      const n = conFiltros ? id(browse.dic.n, params.get("nivel")) : -1;
      const texto = conFiltros ? norm(params.get("q") ?? "") : "";

      const out = browse.filas.filter((f: BrowseRow) => {
        if (r >= 0 && f[4] !== r) return false;
        if (pr >= 0 && f[3] !== pr) return false;
        if (d >= 0 && f[2] !== d) return false;
        if (g >= 0 && f[5] !== g) return false;
        if (n >= 0 && !f[6].includes(n)) return false;
        if (texto && !norm(f[0]).includes(texto)) return false;
        return true;
      });

      // El explorador no ordena por reportes —sirve para encontrar, no para
      // clasificar—, así que la navegación respeta su mismo orden.
      out.sort((a, b) => a[0].localeCompare(b[0], "es"));

      const i = out.findIndex((f) => f[1] === cm);
      if (i < 0) return null;
      const vecino = (j: number): Vecino => {
        const f = out[j];
        if (!f) return null;
        return { slug: slugify(f[0], browse.dic.d[f[2]], f[1]), nombre: f[0] };
      };

      return {
        etiqueta: conFiltros
          ? ["Colegios", ...trozos(null), "orden alfabético"].join(" · ")
          : `Colegios de ${distrito} · orden alfabético`,
        volver: conFiltros
          ? cola
            ? `/colegios?${cola}`
            : "/colegios"
          : `/colegios?region=${encodeURIComponent(departamento)}&distrito=${encodeURIComponent(distrito)}`,
        volverLabel: conFiltros ? "Ver la lista" : `Ver ${distrito}`,
        indice: i,
        total: out.length,
        anterior: vecino(i - 1),
        siguiente: vecino(i + 1),
      };
    }

    return null;
  }, [params, origen, rank, browse, cm, distrito, departamento]);

  /** El contexto viaja con el salto: si no, el siguiente sería un callejón. */
  const conContexto = (slug: string) => {
    const qs = params.toString();
    return qs ? `/colegio/${slug}?${qs}` : `/colegio/${slug}`;
  };

  // ← y → saltan de colegio. Se ignoran dentro de un campo de texto o con un
  // modificador pulsado, donde ya significan otra cosa.
  useEffect(() => {
    if (!universo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const destino =
        e.key === "ArrowLeft" ? universo.anterior : e.key === "ArrowRight" ? universo.siguiente : null;
      if (!destino) return;
      e.preventDefault();
      const qs = params.toString();
      router.push(qs ? `/colegio/${destino.slug}?${qs}` : `/colegio/${destino.slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [universo, router, params]);

  if (fallo || !universo) {
    // Nunca se afirma un universo que no se pudo comprobar.
    return compacto ? null : (
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-y py-3 text-[0.84rem] ${noche ? "border-noche-rule" : "border-rule"}`}>
        <span className={noche ? "text-noche-ink-3" : "text-ink-3"}>Explorar colegios</span>
        <Link href="/colegios" className={`font-medium hover:underline ${noche ? "text-menta" : "text-accent"}`}>
          Ver el explorador →
        </Link>
      </div>
    );
  }

  const flecha = `group flex min-w-0 flex-1 items-center gap-2.5 rounded px-2 py-2.5 transition-colors duration-150 ease-suave ${
    noche ? "hover:bg-noche-2" : "hover:bg-accent-soft/60"
  }`;

  return (
    <nav
      aria-label="Navegación entre colegios"
      className={
        compacto
          ? `border-t pt-3 ${noche ? "border-noche-rule" : "border-rule"}`
          : `border-y py-1.5 ${noche ? "border-noche-rule" : "border-rule"}`
      }
    >
      {!compacto ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 px-2 py-1.5">
          <p className={`min-w-0 truncate font-mono text-[0.68rem] uppercase tracking-[0.1em] ${noche ? "text-noche-ink-4" : "text-ink-3"}`}>
            <span className={`tabular ${noche ? "text-menta" : "text-ink-2"}`}>
              {nf(universo.indice + 1)} de {nf(universo.total)}
            </span>
            <span aria-hidden className={`mx-2 ${noche ? "text-noche-rule-2" : "text-rule"}`}>
              ·
            </span>
            {universo.etiqueta}
          </p>
          <Link
            href={universo.volver}
            className={`shrink-0 font-mono text-[0.68rem] uppercase tracking-[0.1em] hover:underline ${noche ? "text-menta" : "text-accent"}`}
          >
            {universo.volverLabel} →
          </Link>
        </div>
      ) : null}

      <div className="flex items-stretch gap-2">
        {universo.anterior ? (
          <Link
            href={conContexto(universo.anterior.slug)}
            className={flecha}
            aria-label={`Colegio anterior: ${universo.anterior.nombre}`}
            rel="prev"
          >
            <span
              aria-hidden
              className={`shrink-0 text-[1.05rem] transition-transform duration-150 ease-suave group-hover:-translate-x-0.5 ${
                noche ? "text-noche-ink-4 group-hover:text-menta" : "text-ink-3 group-hover:text-accent"
              }`}
            >
              ‹
            </span>
            <span className="min-w-0">
              <span className={`${noche ? "meta-noche" : "meta"} block`}>Anterior</span>
              <span className={`mt-0.5 block truncate text-[0.9rem] font-medium leading-snug ${noche ? "text-noche-ink group-hover:text-menta" : "text-ink-2 group-hover:text-accent"}`}>
                {universo.anterior.nombre}
              </span>
            </span>
          </Link>
        ) : (
          <span className={`flex-1 px-2 py-2.5 text-[0.82rem] ${noche ? "text-noche-ink-4" : "text-ink-4"}`}>Primero de la lista</span>
        )}

        {universo.siguiente ? (
          <Link
            href={conContexto(universo.siguiente.slug)}
            className={`${flecha} justify-end text-right`}
            aria-label={`Colegio siguiente: ${universo.siguiente.nombre}`}
            rel="next"
          >
            <span className="min-w-0">
              <span className={`${noche ? "meta-noche" : "meta"} block`}>Siguiente</span>
              <span className={`mt-0.5 block truncate text-[0.9rem] font-medium leading-snug ${noche ? "text-noche-ink group-hover:text-menta" : "text-ink-2 group-hover:text-accent"}`}>
                {universo.siguiente.nombre}
              </span>
            </span>
            <span
              aria-hidden
              className={`shrink-0 text-[1.05rem] transition-transform duration-150 ease-suave group-hover:translate-x-0.5 ${
                noche ? "text-noche-ink-4 group-hover:text-menta" : "text-ink-3 group-hover:text-accent"
              }`}
            >
              ›
            </span>
          </Link>
        ) : (
          <span className={`flex-1 px-2 py-2.5 text-right text-[0.82rem] ${noche ? "text-noche-ink-4" : "text-ink-4"}`}>
            Último de la lista
          </span>
        )}
      </div>
    </nav>
  );
}
