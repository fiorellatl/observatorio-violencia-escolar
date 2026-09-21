import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { og } from "@/lib/og";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CompararPicker } from "@/components/CompararPicker";
import { getAnioPrincipal, getInstitution, getMeta } from "@/lib/data/provider";
import { categoriasDelAnio } from "@/lib/ficha";
import { MAXIMO, compararColegios, contrastes } from "@/lib/comparar";
import { dec, nf } from "@/lib/format";
import {
  COLOR_ACTOR,
  COLOR_VIOLENCIA,
  ETIQUETA_ACTOR,
  ETIQUETA_VIOLENCIA,
  colorPorTramo,
  color,
} from "@/lib/viz/colors";
import { enlace, shell } from "@/lib/ui";

const DESC =
  "Pon dos o tres colegios uno al lado del otro: reportes registrados, número de alumnos, tasa por 1.000 y dónde cae cada uno en la distribución.";

export const metadata: Metadata = {
  title: "Comparar colegios",
  description: DESC,
  alternates: { canonical: "/comparar" },
  ...og({ title: "Comparar colegios", description: DESC, url: "/comparar" }),
};

/** Los slugs llegan repetidos en la URL: `?colegio=a&colegio=b`. */
function leerSlugs(v: string | string[] | undefined): string[] {
  const xs = Array.isArray(v) ? v : v ? [v] : [];
  return [...new Set(xs)].slice(0, MAXIMO);
}

export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const meta = getMeta();
  const principal = getAnioPrincipal();

  // Un slug que no resuelve se descarta en silencio: puede venir de un enlace
  // viejo, y media comparación es mejor que un error.
  const instituciones = leerSlugs(sp.colegio)
    .map((s) => getInstitution(s))
    .filter((x) => x != null);

  const cs = compararColegios(instituciones, principal);
  const notas = contrastes(cs, principal);

  const elegidos = cs.map((c) => ({
    slug: c.inst.slug,
    nombre: c.inst.nombre,
    lugar: `${c.inst.distrito} · ${c.inst.departamento}`,
  }));

  const tiposColor = Object.fromEntries(
    Object.entries(COLOR_VIOLENCIA).map(([k, v]) => [k, color(v)])
  );
  const actoresColor = Object.fromEntries(
    Object.entries(COLOR_ACTOR).map(([k, v]) => [k, color(v)])
  );

  /** Una fila de la tabla: el mismo dato en cada colegio. */
  const Fila = ({
    label,
    nota,
    valores,
  }: {
    label: string;
    nota?: string;
    valores: React.ReactNode[];
  }) => (
    <div
      className="grid gap-x-6 border-b border-rule-2 py-4"
      style={{ gridTemplateColumns: `minmax(9rem,1fr) repeat(${cs.length}, minmax(0,1fr))` }}
    >
      <div>
        <p className="text-[0.88rem] text-ink-2">{label}</p>
        {nota ? <p className="mt-0.5 text-[0.74rem] text-ink-3">{nota}</p> : null}
      </div>
      {valores.map((v, i) => (
        <div key={i} className="text-right">
          {v}
        </div>
      ))}
    </div>
  );

  return (
    <article className="pb-16">
      {/* ── Portada ──────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className={`${shell} pb-10 pt-6 sm:pb-12`}>
          <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Comparar" }]} />

          <h1 className="titular mt-8 max-w-[15ch] text-display-xl text-ink">
            Comparar <span className="text-accent">colegios</span>
          </h1>
          <p className="mt-6 max-w-[56ch] text-[1.05rem] leading-relaxed text-ink-2">
            Hasta {MAXIMO} colegios, uno al lado del otro. Más reportes no significa peor
            colegio: significa más registro.{" "}
            <Link href="/metodologia" className={enlace}>
              Por qué
            </Link>
            .
          </p>

          <div className="mt-8">
            <Suspense fallback={<div className="h-[3rem] max-w-xl rounded border border-rule" />}>
              <CompararPicker elegidos={elegidos} maximo={MAXIMO} />
            </Suspense>
          </div>
        </div>
      </section>

      <div className={shell}>
        {cs.length < 2 ? (
          /* ── Sin nada que comparar todavía ─────────────────── */
          <section className="py-14 sm:py-20">
            <p className="titular max-w-[18ch] text-display-m text-ink-3">
              {cs.length === 0
                ? "Busca el primer colegio para empezar."
                : "Añade uno más para poder comparar."}
            </p>
            <p className="mt-5 max-w-prose text-[0.95rem] leading-relaxed text-ink-2">
              También puedes llegar aquí desde cualquier ficha, con el colegio ya puesto.{" "}
              <Link href="/colegios" className={enlace}>
                Explora los colegios
              </Link>
              .
            </p>
          </section>
        ) : (
          <>
            {/* ── El contraste ──────────────────────────────────
                Va primero, antes que la tabla: una tabla de cifras sola
                invita a leer «el que tiene más es peor», y esta página
                existe justamente para no hacer eso. */}
            {notas.length > 0 ? (
              <section className="py-10 sm:py-12">
                <h2 className="meta">Qué dice la comparación</h2>
                <ul className="mt-5 space-y-5">
                  {notas.map((n) => (
                    <li key={n.texto} className="flex gap-4">
                      <span
                        aria-hidden
                        className="mt-2 h-2.5 w-2.5 shrink-0 rounded-sm bg-menta"
                      />
                      <p className="max-w-[62ch] text-[1.05rem] leading-snug text-ink">
                        {n.texto}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* ── Las cifras ────────────────────────────────────── */}
            <section className="border-t border-rule py-10 sm:py-12">
              <h2 className="titular text-display-s text-ink">Las cifras</h2>

              <div className="mt-6 overflow-x-auto">
                <div className="min-w-[36rem]">
                  {/* Cabecera: cada colegio con su sitio y su enlace. */}
                  <div
                    className="grid gap-x-6 border-b-2 border-ink pb-4"
                    style={{
                      gridTemplateColumns: `minmax(9rem,1fr) repeat(${cs.length}, minmax(0,1fr))`,
                    }}
                  >
                    <div />
                    {cs.map((c) => (
                      <div key={c.inst.slug} className="text-right">
                        <Link
                          href={`/colegio/${c.inst.slug}`}
                          className="block text-[1.02rem] font-semibold leading-tight text-ink hover:text-accent"
                        >
                          {c.inst.nombre}
                        </Link>
                        <p className="mt-1 text-[0.76rem] leading-snug text-ink-3">
                          {c.inst.distrito} · {c.inst.departamento}
                        </p>
                        <p className="mt-0.5 text-[0.76rem] text-ink-3">{c.inst.gestion}</p>
                      </div>
                    ))}
                  </div>

                  <Fila
                    label="Reportes registrados"
                    nota={`${principal} · último año completo`}
                    valores={cs.map((c) => (
                      <span key={c.inst.slug} className="cifra text-cifra-l text-ink">
                        {nf(c.conteo)}
                      </span>
                    ))}
                  />
                  <Fila
                    label="Total acumulado"
                    nota={`desde ${meta.anio_min}`}
                    valores={cs.map((c) => (
                      <span key={c.inst.slug} className="tabular text-[0.95rem] text-ink-2">
                        {nf(c.inst.total)}
                      </span>
                    ))}
                  />
                  <Fila
                    label="Número de alumnos"
                    nota={`Censo Educativo ${meta.fuentes.matricula?.anio ?? ""}`}
                    valores={cs.map((c) => (
                      <span key={c.inst.slug} className="tabular text-[0.95rem] text-ink-2">
                        {c.inst.matricula != null ? nf(c.inst.matricula) : "—"}
                      </span>
                    ))}
                  />
                  <Fila
                    label="Reportes por 1.000 alumnos"
                    nota={`${meta.anio_transversal} · el único año con reportes y alumnos`}
                    valores={cs.map((c) => (
                      <span key={c.inst.slug} className="tabular text-[0.95rem] text-ink">
                        {c.inst.tasa_2024 != null ? dec(c.inst.tasa_2024, 1) : "—"}
                      </span>
                    ))}
                  />
                  <Fila
                    label="Niveles"
                    valores={cs.map((c) => (
                      <span key={c.inst.slug} className="text-[0.84rem] text-ink-2">
                        {c.inst.niveles.join(" · ")}
                      </span>
                    ))}
                  />
                </div>
              </div>
            </section>

            {/* ── Posición en la distribución ───────────────────── */}
            {cs.some((c) => c.ctx) ? (
              <section className="border-t border-rule py-10 sm:py-12">
                <h2 className="titular text-display-s text-ink">Dónde cae cada uno</h2>
                <p className="mt-3 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
                  Dentro del reparto de reportes registrados de {principal}. La mediana
                  parte el eje por la mitad.
                </p>

                <ul className="mt-7 space-y-7">
                  {cs.map((c) =>
                    c.ctx ? (
                      <li key={c.inst.slug}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <p className="text-[0.98rem] font-medium text-ink">
                            {c.inst.nombre}
                          </p>
                          <p className="text-[0.85rem] text-ink-2">{c.ctx.frase}</p>
                        </div>
                        <div
                          className="relative mt-2.5 h-2.5 w-full rounded-sm bg-rule-2"
                          role="img"
                          aria-label={`${c.inst.nombre}: ${c.ctx.frase}`}
                        >
                          <span
                            aria-hidden
                            className="absolute top-[-5px] h-[20px] w-px bg-ink-3"
                            style={{ left: "50%" }}
                          />
                          <span
                            aria-hidden
                            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper"
                            style={{
                              left: `${Math.min(99, Math.max(1, c.ctx.percentil))}%`,
                              background: colorPorTramo(c.ctx.tramo),
                            }}
                          />
                        </div>
                      </li>
                    ) : null
                  )}
                </ul>

                <p className="mt-6 text-[0.78rem] leading-relaxed text-ink-3">
                  Entre {cs.find((c) => c.ctx)!.ctx!.universo}.
                </p>
              </section>
            ) : null}

            {/* ── Composición ───────────────────────────────────── */}
            {(
              [
                {
                  titulo: `Qué se registra en ${principal}`,
                  claves: ["fisica", "psicologica", "sexual"],
                  etiquetas: ETIQUETA_VIOLENCIA,
                  colores: tiposColor,
                },
                {
                  titulo: `Presunto agresor en ${principal}`,
                  claves: ["entre_escolares", "personal_ie"],
                  etiquetas: ETIQUETA_ACTOR,
                  colores: actoresColor,
                },
              ] as const
            ).map((bloque) => {
              const porColegio = cs.map((c) => ({
                c,
                items: categoriasDelAnio(
                  c.inst.anios[principal],
                  [...bloque.claves],
                  bloque.etiquetas,
                  bloque.colores
                ),
              }));
              if (porColegio.every((x) => x.items.length === 0)) return null;

              return (
                <section key={bloque.titulo} className="border-t border-rule py-10 sm:py-12">
                  <h2 className="titular text-display-s text-ink">{bloque.titulo}</h2>
                  <div
                    className="mt-6 grid gap-x-8 gap-y-8"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(cs.length, 3)}, minmax(0,1fr))`,
                    }}
                  >
                    {porColegio.map(({ c, items }) => (
                      <div key={c.inst.slug}>
                        <p className="truncate text-[0.92rem] font-medium text-ink">
                          {c.inst.nombre}
                        </p>
                        {items.length === 0 ? (
                          <p className="mt-3 text-[0.82rem] text-ink-3">
                            Sin reportes en {principal}.
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-3">
                            {items.map((i) => (
                              <li key={i.clave}>
                                <div className="flex items-baseline justify-between gap-3">
                                  <span className="text-[0.86rem] text-ink-2">{i.label}</span>
                                  <span className="tabular text-[0.86rem] font-medium text-ink">
                                    {nf(i.valor)}
                                    <span className="ml-2 font-normal text-ink-3">
                                      {Math.round(i.pct)} %
                                    </span>
                                  </span>
                                </div>
                                <div className="mt-1.5 h-[3px] w-full rounded-sm bg-rule-2">
                                  <div
                                    className="h-full rounded-sm"
                                    style={{ width: `${i.pct}%`, background: i.color }}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            <p className="border-t border-rule py-8 text-[0.8rem] leading-relaxed text-ink-3">
              Cada cifra procede de la ficha de su colegio y lleva el año de su fuente. La
              comparación no ordena ni puntúa: describe.
            </p>
          </>
        )}
      </div>
    </article>
  );
}
