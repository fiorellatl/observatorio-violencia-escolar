"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dec, nf } from "@/lib/format";
import { boton, campo, meta as clsMeta } from "@/lib/ui";
import { COLOR_VIOLENCIA, color } from "@/lib/viz/colors";
import type {
  SignalCambio,
  SignalComposicion,
  SignalPar,
  SignalPersistencia,
  SignalReaparicion,
  SignalSchool,
  Signals,
} from "@/lib/types";

/**
 * Explorador de señales — un radar de cambios, no una tabla.
 *
 * El problema de la versión anterior no eran los datos sino el reparto de
 * peso: cada tarjeta repetía en prosa lo que las cifras ya decían solas
 * —«los reportes registrados aumentaron de 10 a 37 entre 2024 y 2025»— y
 * enterraba el cambio bajo nombre, ubicación, nivel, gestión, fuente,
 * matrícula y enlace. Leer veinte tarjetas costaba veinte párrafos.
 *
 * Ahora manda el cambio: 10 → 37, la diferencia y la proporción, con dos
 * barras que se comparan de un vistazo. Lo demás baja de tamaño o se va al
 * pie de la página. La frase desaparece porque las cifras la dicen mejor.
 *
 * NO ES UN RANKING. Ninguna tarjeta lleva posición ni puntuación: el
 * estadístico que las ordena por dentro no se enseña como cifra del colegio,
 * porque un número junto a un nombre se lee como nota diga lo que diga la
 * etiqueta. Y la advertencia que las acompaña a todas no es letra pequeña
 * sino el contenido: un cambio en el registro puede ser un cambio en lo que
 * ocurre o un cambio en la disposición a reportarlo, y estos datos no los
 * separan.
 */

type TipoSenal = "aumento" | "disminucion" | "reaparicion" | "persistencia" | "composicion";

const TIPOS: { v: TipoSenal; label: string; corto: string; icono: string }[] = [
  { v: "aumento", label: "Aumento inusual", corto: "Aumentos", icono: "↑" },
  { v: "disminucion", label: "Disminución inusual", corto: "Disminuciones", icono: "↓" },
  { v: "reaparicion", label: "Vuelve a registrar", corto: "Reapariciones", icono: "↗" },
  { v: "persistencia", label: "Registro sostenido", corto: "Persistencia", icono: "→" },
  { v: "composicion", label: "Cambia el tipo", corto: "Composición", icono: "◇" },
];

const TOPE = 40;

/**
 * Dos barras comparadas. Es la pieza que sustituye a la frase: el ojo ve la
 * diferencia antes de leer la cifra, y la cifra confirma lo que ya vio.
 */
function Comparacion({
  antes,
  ahora,
  anioAntes,
  anioAhora,
}: {
  antes: number;
  ahora: number;
  anioAntes: string;
  anioAhora: string;
}) {
  const max = Math.max(antes, ahora, 1);
  const fila = (v: number, anio: string, fuerte: boolean) => (
    <div className="flex items-center gap-3">
      <span className="tabular w-[2.6rem] shrink-0 font-mono text-[0.68rem] text-ink-3">
        {anio}
      </span>
      <span className="h-2.5 min-w-[2px] flex-1 overflow-hidden rounded-sm bg-rule-2">
        <span
          className="block h-full rounded-sm transition-[width] duration-300 ease-suave"
          style={{
            width: `${Math.max((v / max) * 100, 1.5)}%`,
            background: fuerte ? "var(--accent)" : "var(--viz-mute)",
          }}
        />
      </span>
      <span
        className={`tabular w-[2.4rem] shrink-0 text-right text-[0.9rem] ${
          fuerte ? "font-semibold text-ink" : "text-ink-3"
        }`}
      >
        {nf(v)}
      </span>
    </div>
  );

  return (
    <div className="space-y-1.5" role="img" aria-label={`${anioAntes}: ${antes} reportes; ${anioAhora}: ${ahora} reportes`}>
      {fila(antes, anioAntes, false)}
      {fila(ahora, anioAhora, true)}
    </div>
  );
}

/** Cinta de composición: la proporción de cada tipo dentro de un año. */
function Cinta({ c }: { c: Record<string, number> }) {
  const total = (c.fisica ?? 0) + (c.psicologica ?? 0) + (c.sexual ?? 0);
  if (total === 0) return <span className="block h-2.5 rounded-sm bg-rule-2" />;
  return (
    <span className="flex h-2.5 overflow-hidden rounded-sm">
      {(["psicologica", "fisica", "sexual"] as const).map((k) =>
        (c[k] ?? 0) > 0 ? (
          <span key={k} style={{ flex: c[k], background: color(COLOR_VIOLENCIA[k]) }} />
        ) : null
      )}
    </span>
  );
}

/** Marco común. La tarjeta entera es el enlace: no hay que buscar el CTA. */
function Tarjeta({
  s,
  etiqueta,
  icono,
  children,
}: {
  s: SignalSchool;
  etiqueta: string;
  icono: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={`/colegio/${s.slug}`}
        className="group flex h-full flex-col gap-3.5 rounded-lg border border-rule bg-surface p-5 transition-colors duration-150 ease-suave hover:border-ink-3 hover:bg-accent-soft/40"
      >
        <p className="flex items-center gap-2">
          <span aria-hidden className="text-[0.95rem] text-accent">
            {icono}
          </span>
          <span className={clsMeta}>{etiqueta}</span>
        </p>

        <p className="text-[1.08rem] font-semibold leading-snug tracking-[-0.02em] text-ink group-hover:text-accent">
          {s.nombre}
        </p>

        {children}

        <p className="mt-auto flex items-center justify-between gap-3 pt-1 text-[0.76rem] text-ink-3">
          <span className="truncate">
            {s.distrito} · {s.gestion}
          </span>
          <span
            aria-hidden
            className="shrink-0 text-accent transition-transform duration-150 ease-suave group-hover:translate-x-1"
          >
            →
          </span>
        </p>
      </Link>
    </li>
  );
}

export function SignalsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [datos, setDatos] = useState<Signals | null>(null);
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/data/signals.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Signals>;
      })
      .then((d) => vivo && setDatos(d))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);

  const q = useCallback((k: string) => params.get(k) ?? "", [params]);

  const poner = useCallback(
    (cambios: Record<string, string>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(cambios)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      if ("region" in cambios) {
        p.delete("provincia");
        p.delete("distrito");
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const pares = datos?.pares ?? [];
  const par: SignalPar | undefined = useMemo(() => {
    if (pares.length === 0) return undefined;
    const pedido = q("anio");
    return pares.find((p) => p.anio === pedido) ?? pares[pares.length - 1];
  }, [pares, q]);

  const tipo = (TIPOS.find((t) => t.v === q("tipo"))?.v ?? "aumento") as TipoSenal;

  /** Filtro territorial común a todos los tipos. */
  const pasa = useCallback(
    (s: SignalSchool) => {
      const r = q("region");
      const p = q("provincia");
      const d = q("distrito");
      const g = q("gestion");
      const n = q("nivel");
      if (r && s.region !== r) return false;
      if (p && s.provincia !== p) return false;
      if (d && s.distrito !== d) return false;
      if (g && s.gestion !== g) return false;
      if (n && s.nivel !== n) return false;
      return true;
    },
    [q]
  );

  const deTipo = useCallback(
    (t: TipoSenal): SignalSchool[] => {
      if (!par) return [];
      const bruto =
        t === "aumento"
          ? par.aumento
          : t === "disminucion"
            ? par.disminucion
            : t === "reaparicion"
              ? par.reaparicion
              : t === "persistencia"
                ? par.persistencia
                : par.composicion;
      return bruto as SignalSchool[];
    },
    [par]
  );

  const lista = useMemo(() => deTipo(tipo).filter(pasa), [deTipo, tipo, pasa]);

  /** Opciones de los desplegables: lo que existe en el par seleccionado. */
  const opciones = useMemo(() => {
    if (!par) return { region: [], provincia: [], distrito: [], gestion: [], nivel: [] };
    const todos: SignalSchool[] = [
      ...par.aumento,
      ...par.disminucion,
      ...par.reaparicion,
      ...par.persistencia,
      ...par.composicion,
    ];
    const u = (f: (s: SignalSchool) => string) =>
      [...new Set(todos.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    return {
      region: u((s) => s.region),
      provincia: u((s) => s.provincia),
      distrito: u((s) => s.distrito),
      gestion: u((s) => s.gestion),
      nivel: u((s) => s.nivel),
    };
  }, [par]);

  const filtrosActivos = ["region", "provincia", "distrito", "gestion", "nivel"].filter((k) =>
    q(k)
  ).length;

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-6">
        <p className="text-[0.92rem] font-medium text-ink-2">No se pudieron cargar las señales</p>
        <p className="mt-1.5 text-[0.85rem] text-ink-3">Revisa tu conexión y recarga.</p>
      </div>
    );
  }

  if (!datos) return <div className="h-72 animate-pulse rounded-lg border border-rule bg-surface" />;

  if (!par) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-6">
        <p className="text-[0.92rem] font-medium text-ink-2">
          La detección todavía no se ha ejecutado
        </p>
        <p className="mt-1.5 max-w-prose text-[0.85rem] text-ink-3">
          Las señales se generan a partir de la capa pública. En cuanto el proceso corra,
          esta página se llena sola.
        </p>
      </div>
    );
  }

  const Sel = ({ k, label, opts }: { k: string; label: string; opts: string[] }) => (
    <div>
      <label htmlFor={`s-${k}`} className={`${clsMeta} block`}>
        {label}
      </label>
      <select
        id={`s-${k}`}
        value={q(k)}
        onChange={(e) => poner({ [k]: e.target.value })}
        className={`${campo} mt-1.5`}
      >
        <option value="">Todas</option>
        {opts.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );

  const conteo = (t: TipoSenal) => {
    const n = deTipo(t).filter(pasa).length;
    // Sin filtros territoriales, el total real puede superar la lista recortada.
    return filtrosActivos === 0 ? (par.totales?.[t] ?? n) : n;
  };

  const total = TIPOS.reduce((s, t) => s + conteo(t.v), 0);
  const maxConteo = Math.max(...TIPOS.map((t) => conteo(t.v)), 1);

  return (
    <div>
      {/* ── Resumen: qué se detectó y de qué tipo ───────────────
          Las barras no decoran: dicen de un vistazo que casi todo lo
          detectado son aumentos, que es la primera pregunta de la página. */}
      <div className="border-y border-rule py-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          {/* "Señales" y no "cambios": la persistencia y la reaparición no son
              cambios sino patrones definidos por una regla, y son la mayor
              parte del total. Llamarlo cambios inflaría lo que la página
              afirma haber detectado. */}
          <p className="flex items-baseline gap-3">
            <span className="cifra text-cifra-l text-ink">{nf(total)}</span>
            <span className="text-[0.95rem] text-ink-2">
              {total === 1 ? "señal" : "señales"} entre {par.anio_anterior} y {par.anio}
            </span>
          </p>
          <div>
            <label htmlFor="s-anio" className={`${clsMeta} block`}>
              Comparación
            </label>
            <select
              id="s-anio"
              value={par.anio}
              onChange={(e) => poner({ anio: e.target.value })}
              className={`${campo} mt-1.5`}
            >
              {pares.map((p) => (
                <option key={p.anio} value={p.anio}>
                  {p.anio_anterior} → {p.anio}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="sr-only">Tipo de señal</legend>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {TIPOS.map((t) => {
              const n = conteo(t.v);
              const sel = tipo === t.v;
              return (
                <button
                  key={t.v}
                  type="button"
                  aria-pressed={sel}
                  disabled={n === 0}
                  onClick={() => poner({ tipo: t.v === "aumento" ? "" : t.v })}
                  className={`rounded border px-3 py-2.5 text-left transition-colors duration-150 ease-suave disabled:opacity-40 ${
                    sel ? "border-ink bg-surface" : "border-rule hover:border-ink-3"
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span aria-hidden className={sel ? "text-accent" : "text-ink-3"}>
                      {t.icono}
                    </span>
                    <span
                      className={`cifra text-[1.35rem] ${sel ? "text-ink" : "text-ink-2"}`}
                    >
                      {nf(n)}
                    </span>
                  </span>
                  <span
                    className={`mt-1 block text-[0.8rem] ${sel ? "font-medium text-ink" : "text-ink-3"}`}
                  >
                    {t.corto}
                  </span>
                  <span
                    aria-hidden
                    className="mt-2 block h-1 overflow-hidden rounded-sm bg-rule-2"
                  >
                    <span
                      className="block h-full rounded-sm"
                      style={{
                        width: `${Math.max((n / maxConteo) * 100, n > 0 ? 3 : 0)}%`,
                        background: sel ? "var(--accent)" : "var(--viz-mute)",
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="mt-3 max-w-prose text-[0.78rem] leading-relaxed text-ink-3">
          Los aumentos y las disminuciones salen de un contraste estadístico. La
          reaparición y la persistencia no llevan prueba: son patrones con una regla
          escrita, y por eso se cuentan aparte.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPanel((x) => !x)}
            aria-expanded={panel}
            aria-controls="panel-senales"
            className={`${boton} ${filtrosActivos ? "border-ink-3 text-ink" : ""}`}
          >
            {panel ? "Ocultar filtros" : "Más filtros"}
            {filtrosActivos ? (
              <span className="tabular rounded-full bg-accent px-1.5 text-[0.72rem] font-medium text-paper">
                {filtrosActivos}
              </span>
            ) : null}
          </button>
          <p className="text-[0.82rem] text-ink-3" role="status" aria-live="polite">
            <span className="tabular text-ink-2">{nf(lista.length)}</span>{" "}
            {lista.length === 1 ? "en esta vista" : "en esta vista"}
          </p>
        </div>

        {panel ? (
          <div id="panel-senales" className="mt-4 border-t border-rule-2 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Sel k="region" label="Región" opts={opciones.region} />
              <Sel k="distrito" label="Distrito" opts={opciones.distrito} />
              <Sel k="gestion" label="Gestión" opts={opciones.gestion} />
              <Sel k="nivel" label="Nivel" opts={opciones.nivel} />
            </div>
            {params.toString() ? (
              <button
                type="button"
                onClick={() => router.replace(pathname, { scroll: false })}
                className={`${boton} mt-3`}
              >
                Quitar filtros
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Resultados ──────────────────────────────────────────── */}
      {lista.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-rule p-6">
          <p className="text-[0.92rem] font-medium text-ink-2">
            Ninguna señal de este tipo con estos filtros
          </p>
          <p className="mt-1.5 max-w-prose text-[0.85rem] leading-relaxed text-ink-3">
            {tipo === "composicion"
              ? `El contraste de composición exige al menos ${datos.meta?.min_composicion ?? 30} reportes en cada uno de los dos años, y muy pocos colegios llegan a ese volumen. Es un límite del dato, no un resultado.`
              : "Que no haya señales es un resultado, no un fallo: significa que ningún colegio de este filtro cambió más de lo esperable."}
          </p>
        </div>
      ) : (
        <ul className="mt-7 grid gap-4 sm:grid-cols-2">
          {lista.slice(0, TOPE).map((s, i) => {
            const t = TIPOS.find((x) => x.v === tipo)!;

            if (tipo === "aumento" || tipo === "disminucion") {
              const c = s as SignalCambio;
              const rel = c.anterior > 0 ? (c.cambio / c.anterior) * 100 : null;
              return (
                <Tarjeta key={`${c.cm}-${i}`} s={c} etiqueta={t.label} icono={t.icono}>
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="cifra text-[2.1rem] text-ink">
                      {nf(c.anterior)}
                      <span className="mx-2 font-normal text-ink-3">→</span>
                      {nf(c.actual)}
                    </span>
                  </p>
                  <p className="tabular -mt-1 flex flex-wrap items-baseline gap-x-3 text-[0.9rem]">
                    <span className="font-semibold text-accent">
                      {c.cambio > 0 ? "+" : ""}
                      {nf(c.cambio)} reportes
                    </span>
                    {rel != null ? (
                      <span className="text-ink-3">
                        {rel > 0 ? "+" : ""}
                        {dec(rel, 0)} %
                      </span>
                    ) : null}
                  </p>
                  <Comparacion
                    antes={c.anterior}
                    ahora={c.actual}
                    anioAntes={par.anio_anterior}
                    anioAhora={par.anio}
                  />
                </Tarjeta>
              );
            }

            if (tipo === "reaparicion") {
              const c = s as SignalReaparicion;
              return (
                <Tarjeta key={`${c.cm}-${i}`} s={c} etiqueta={t.label} icono={t.icono}>
                  <p className="cifra text-[2.1rem] text-ink">
                    0<span className="mx-2 font-normal text-ink-3">→</span>
                    {nf(c.actual)}
                  </p>
                  <p className="tabular -mt-1 text-[0.9rem] text-ink-2">
                    tras {c.anios_sin} {c.anios_sin === 1 ? "año" : "años"} sin registrar ·
                    el último fue {c.ultimo_con}
                  </p>
                </Tarjeta>
              );
            }

            if (tipo === "persistencia") {
              const c = s as SignalPersistencia;
              return (
                <Tarjeta key={`${c.cm}-${i}`} s={c} etiqueta={t.label} icono={t.icono}>
                  <p className="flex items-baseline gap-2">
                    <span className="cifra text-[2.1rem] text-ink">
                      {c.anios_con}
                      <span className="mx-1.5 font-normal text-ink-3">de</span>
                      {c.ventana}
                    </span>
                    <span className="text-[0.9rem] text-ink-2">años con registro</span>
                  </p>
                  <p className="tabular -mt-1 text-[0.9rem] text-ink-3">
                    {nf(c.total)} reportes en esa ventana
                  </p>
                </Tarjeta>
              );
            }

            const c = s as SignalComposicion;
            return (
              <Tarjeta key={`${c.cm}-${i}`} s={c} etiqueta={t.label} icono={t.icono}>
                <div className="space-y-2.5">
                  <div>
                    <p className="tabular mb-1 font-mono text-[0.68rem] text-ink-3">
                      {par.anio_anterior} · {nf(c.total_antes)}
                    </p>
                    <Cinta c={c.antes} />
                  </div>
                  <div>
                    <p className="tabular mb-1 font-mono text-[0.68rem] text-ink-3">
                      {par.anio} · {nf(c.total_ahora)}
                    </p>
                    <Cinta c={c.ahora} />
                  </div>
                </div>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.72rem] text-ink-3">
                  {(["psicologica", "fisica", "sexual"] as const).map((k) => (
                    <span key={k} className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-sm"
                        style={{ background: color(COLOR_VIOLENCIA[k]) }}
                      />
                      {k === "psicologica" ? "psicológica" : k}
                    </span>
                  ))}
                </p>
              </Tarjeta>
            );
          })}
        </ul>
      )}

      {lista.length > TOPE ? (
        <p className="mt-4 text-[0.82rem] text-ink-3">
          Se muestran {TOPE} de {nf(lista.length)}. Afina los filtros para ver el resto.
        </p>
      ) : null}

      {/* El contraste descuenta el movimiento del país: sin esto, un año en
          que todo sube marcaría a todo el mundo. */}
      <p className="mt-7 border-t border-rule pt-5 text-[0.8rem] leading-relaxed text-ink-3">
        En todo el país los reportes pasaron de {nf(par.nacional_anterior)} en{" "}
        {par.anio_anterior} a {nf(par.nacional)} en {par.anio}
        {par.ratio_nacional !== 1 ? <> ({dec((par.ratio_nacional - 1) * 100, 1)} %)</> : null}.
        Un colegio que se movió como el país no aparece aquí.
        {tipo === "aumento" || tipo === "disminucion" ? (
          <> Se contrastaron {nf(par.probados)} colegios con volumen suficiente.</>
        ) : null}
      </p>
    </div>
  );
}
