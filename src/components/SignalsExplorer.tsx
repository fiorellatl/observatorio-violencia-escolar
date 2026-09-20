"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dec, nf } from "@/lib/format";
import { boton, campo, meta as clsMeta } from "@/lib/ui";
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
 * Explorador de señales.
 *
 * No es un ranking. Cada tarjeta dice qué cambió y entre qué años, sin nota,
 * sin posición y sin puntuación: el estadístico que las ordena por dentro no
 * se muestra como cifra del colegio, porque un número al lado de un nombre se
 * lee como calificación por mucho que la etiqueta diga otra cosa.
 *
 * Y todas comparten la misma advertencia, que no es letra pequeña sino el
 * contenido: un cambio en el registro puede ser un cambio en lo que ocurre o
 * un cambio en la disposición a reportarlo, y estos datos no los separan.
 */

type TipoSenal = "aumento" | "disminucion" | "reaparicion" | "persistencia" | "composicion";

const TIPOS: { v: TipoSenal; label: string; icono: string }[] = [
  { v: "aumento", label: "Aumento inusual", icono: "↑" },
  { v: "disminucion", label: "Disminución inusual", icono: "↓" },
  { v: "reaparicion", label: "Reaparición", icono: "↗" },
  { v: "persistencia", label: "Persistencia", icono: "→" },
  { v: "composicion", label: "Cambio de composición", icono: "◇" },
];

const TOPE = 40;

function Ubicacion({ s }: { s: SignalSchool }) {
  return (
    <p className="mt-1 text-[0.8rem] text-ink-3">
      {s.distrito}, {s.region}
      {s.nivel ? ` · ${s.nivel}` : ""} · {s.gestion}
    </p>
  );
}

function Pie({ s, extra }: { s: SignalSchool; extra?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-rule-3 pt-3">
      <span className={clsMeta}>SíseVe{extra ? ` · ${extra}` : ""}</span>
      {s.matricula ? (
        <span className="tabular text-[0.78rem] text-ink-3">
          {nf(s.matricula)} estudiantes · ESCALE {s.anio_matricula}
        </span>
      ) : (
        <span className="text-[0.78rem] text-ink-3">Sin matrícula conocida</span>
      )}
      <Link
        href={`/colegio/${s.slug}`}
        className="ml-auto text-[0.82rem] font-medium text-accent hover:underline"
      >
        Ver perfil →
      </Link>
    </div>
  );
}

function Tarjeta({
  icono,
  etiqueta,
  s,
  children,
  extra,
}: {
  icono: string;
  etiqueta: string;
  s: SignalSchool;
  children: React.ReactNode;
  extra?: string;
}) {
  return (
    <li className="rounded-lg border border-rule bg-surface p-5">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="text-ink-3">
          {icono}
        </span>
        <span className={clsMeta}>{etiqueta}</span>
      </div>
      <h3 className="mt-2.5 font-display text-[1.12rem] font-medium leading-snug">
        {s.nombre}
      </h3>
      <Ubicacion s={s} />
      <div className="mt-3.5 text-[0.92rem] leading-relaxed text-ink-2">{children}</div>
      <Pie s={s} extra={extra} />
    </li>
  );
}

export function SignalsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [datos, setDatos] = useState<Signals | null>(null);
  const [error, setError] = useState(false);

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

  const lista = useMemo(() => {
    if (!par) return [] as SignalSchool[];
    const bruto =
      tipo === "aumento"
        ? par.aumento
        : tipo === "disminucion"
          ? par.disminucion
          : tipo === "reaparicion"
            ? par.reaparicion
            : tipo === "persistencia"
              ? par.persistencia
              : par.composicion;
    return (bruto as SignalSchool[]).filter(pasa);
  }, [par, tipo, pasa]);

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
    const n = (bruto as SignalSchool[]).filter(pasa).length;
    // Sin filtros territoriales, el total real puede superar la lista recortada.
    const sinFiltro = !q("region") && !q("provincia") && !q("distrito") && !q("gestion") && !q("nivel");
    return sinFiltro ? (par.totales?.[t] ?? n) : n;
  };

  return (
    <div>
      <div className="rounded-lg border border-rule bg-surface p-4 sm:p-5">
        <fieldset>
          <legend className={`${clsMeta} mb-2`}>Tipo de señal</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => {
              const n = conteo(t.v);
              return (
                <button
                  key={t.v}
                  type="button"
                  aria-pressed={tipo === t.v}
                  onClick={() => poner({ tipo: t.v === "aumento" ? "" : t.v })}
                  className={`rounded border px-3 py-1.5 text-[0.85rem] transition-colors duration-150 ease-suave ${
                    tipo === t.v
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-rule bg-surface text-ink-2 hover:border-ink-3"
                  }`}
                >
                  <span aria-hidden className="mr-1.5 text-ink-3">
                    {t.icono}
                  </span>
                  {t.label}
                  <span className="tabular ml-1.5 text-ink-3">{nf(n)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          <Sel k="region" label="Región" opts={opciones.region} />
          <Sel k="distrito" label="Distrito" opts={opciones.distrito} />
          <Sel k="gestion" label="Gestión" opts={opciones.gestion} />
          <Sel k="nivel" label="Nivel" opts={opciones.nivel} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule-2 pt-3.5">
          <p className="text-[0.84rem] text-ink-2" role="status" aria-live="polite">
            <span className="tabular font-medium text-ink">{nf(lista.length)}</span>{" "}
            {lista.length === 1 ? "señal" : "señales"} · comparando {par.anio_anterior} con{" "}
            {par.anio}
          </p>
          {params.toString() ? (
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

      {/* Contexto del contraste: cuánto se movió el país ese año. */}
      <p className="mt-4 text-[0.82rem] leading-relaxed text-ink-3">
        En todo el país los reportes pasaron de {nf(par.nacional_anterior)} en{" "}
        {par.anio_anterior} a {nf(par.nacional)} en {par.anio}
        {par.ratio_nacional !== 1 ? (
          <>
            {" "}
            ({dec((par.ratio_nacional - 1) * 100, 1)} %)
          </>
        ) : null}
        . Un colegio que se movió como el país no aparece aquí: la comparación descuenta
        ese cambio general.
        {tipo === "aumento" || tipo === "disminucion" ? (
          <> Se contrastaron {nf(par.probados)} colegios con volumen suficiente.</>
        ) : null}
      </p>

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
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {lista.slice(0, TOPE).map((s, i) => {
            const meta = TIPOS.find((t) => t.v === tipo)!;

            if (tipo === "aumento" || tipo === "disminucion") {
              const c = s as SignalCambio;
              const rel = c.anterior > 0 ? (c.cambio / c.anterior) * 100 : null;
              return (
                <Tarjeta
                  key={`${c.cm}-${i}`}
                  icono={meta.icono}
                  etiqueta={meta.label}
                  s={c}
                  extra={`${par.anio_anterior}–${par.anio}`}
                >
                  Los reportes registrados{" "}
                  {c.cambio > 0 ? "aumentaron" : "disminuyeron"} de{" "}
                  <strong className="tabular font-semibold text-ink">{nf(c.anterior)}</strong> a{" "}
                  <strong className="tabular font-semibold text-ink">{nf(c.actual)}</strong>{" "}
                  entre {par.anio_anterior} y {par.anio}.
                  <span className="tabular mt-2 block text-[0.84rem] text-ink-3">
                    {c.cambio > 0 ? "+" : ""}
                    {nf(c.cambio)} reportes
                    {rel != null ? ` (${rel > 0 ? "+" : ""}${dec(rel, 0)} %)` : ""}
                  </span>
                </Tarjeta>
              );
            }

            if (tipo === "reaparicion") {
              const c = s as SignalReaparicion;
              return (
                <Tarjeta key={`${c.cm}-${i}`} icono={meta.icono} etiqueta={meta.label} s={c}>
                  Después de {c.anios_sin} {c.anios_sin === 1 ? "año" : "años"} sin reportes
                  registrados, en {par.anio} volvieron a registrarse{" "}
                  <strong className="tabular font-semibold text-ink">{nf(c.actual)}</strong>.
                  <span className="mt-2 block text-[0.84rem] text-ink-3">
                    El año anterior con registros fue {c.ultimo_con}.
                  </span>
                </Tarjeta>
              );
            }

            if (tipo === "persistencia") {
              const c = s as SignalPersistencia;
              return (
                <Tarjeta key={`${c.cm}-${i}`} icono={meta.icono} etiqueta={meta.label} s={c}>
                  Registró reportes en{" "}
                  <strong className="tabular font-semibold text-ink">{c.anios_con}</strong> de
                  los últimos {c.ventana} años con datos disponibles.
                  <span className="tabular mt-2 block text-[0.84rem] text-ink-3">
                    {nf(c.total)} reportes en esa ventana.
                  </span>
                </Tarjeta>
              );
            }

            const c = s as SignalComposicion;
            return (
              <Tarjeta key={`${c.cm}-${i}`} icono={meta.icono} etiqueta={meta.label} s={c}>
                La composición de los reportes cambió respecto al año anterior.
                <span className="mt-2 block text-[0.84rem] text-ink-3">
                  {par.anio_anterior}: {nf(c.antes.fisica)} física · {nf(c.antes.psicologica)}{" "}
                  psicológica · {nf(c.antes.sexual)} sexual
                  <br />
                  {par.anio}: {nf(c.ahora.fisica)} física · {nf(c.ahora.psicologica)}{" "}
                  psicológica · {nf(c.ahora.sexual)} sexual
                </span>
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
    </div>
  );
}
