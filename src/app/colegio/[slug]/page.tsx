import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { LevelBreakdown } from "@/components/LevelBreakdown";
import { MetricBand } from "@/components/MetricBand";
import { SchoolNav } from "@/components/SchoolNav";
import { ShareButton } from "@/components/ShareButton";
import {
  getAnioPrincipal,
  getInstitution,
  getMeta,
  getPosicionRanking,
  getPrerenderSlugs,
  getServiceRedirect,
} from "@/lib/data/provider";
import { getInsights } from "@/lib/insights";
import { dec, fechaLegible, nf, valorLegible } from "@/lib/format";
import { COLOR_SERIE, color } from "@/lib/viz/colors";
import { shell } from "@/lib/ui";

export const dynamicParams = true;

export function generateStaticParams() {
  const slugs = getPrerenderSlugs();
  // Permite acotar el prerender en desarrollo sin tocar código.
  const limite = Number(process.env.PRERENDER_LIMIT ?? 0);
  return (limite > 0 ? slugs.slice(0, limite) : slugs).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = getInstitution(slug);
  // Un slug de servicio absorbido redirige; no se indexa como página propia.
  if (!s) return { title: "Colegio", robots: { index: false } };

  const titulo = `${s.nombre} — ${s.distrito}`;
  const anios = Object.keys(s.anios).sort();
  const desc =
    `${s.nombre} (${s.distrito}, ${s.departamento}) registra ${nf(s.total)} reportes ` +
    `en SíseVe entre ${anios[0]} y ${anios[anios.length - 1]}. ` +
    `${s.niveles.join(", ")}. Datos públicos del número de alumnos y contexto, con el ` +
    `año de cada fuente.`;

  // No indexamos colegios sin datos útiles: un único reporte antiguo no sostiene
  // una página y sí ensucia el índice.
  const util = s.total >= 2;

  return {
    title: titulo,
    description: desc,
    alternates: { canonical: `/colegio/${s.slug}` },
    robots: util ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: titulo, description: desc, type: "article" },
  };
}

/** Flechas de las señales. Acompañan al texto; nunca lo sustituyen, y no
    codifican bueno ni malo: una subida de reportes puede ser un colegio donde
    por fin se denuncia. */
const FLECHA: Record<string, string> = {
  subida: "↑",
  bajada: "↓",
  vuelve: "↗",
  sostiene: "→",
};

export default async function ColegioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = getInstitution(slug);

  if (!s) {
    // Las URLs de nivel ya estaban indexadas y compartidas: no se rompen.
    // Llevan a la ficha institucional con su nivel ya seleccionado. 308 y no
    // 307: la mudanza es definitiva y los buscadores tienen que trasladar el
    // enlace, no seguirlo cada vez.
    const r = getServiceRedirect(slug);
    if (r) permanentRedirect(`/colegio/${r.slug}?ver=${encodeURIComponent(r.nivel)}`);
    notFound();
  }

  const meta = getMeta();
  const conDatos = Object.keys(s.anios).sort();
  const primero = conDatos[0] ?? meta.anio_max;

  const anios: string[] = [];
  for (let a = Number(primero); a <= Number(meta.anio_max); a++) anios.push(String(a));

  // Año principal = último año COMPLETO. `anio_transversal` sigue existiendo,
  // pero solo manda sobre la tasa, que es una métrica secundaria.
  const principal = getAnioPrincipal();
  const t = meta.anio_transversal;
  const delPrincipal = s.anios[principal];
  const enCurso = s.anios[meta.anio_parcial];
  const puesto = getPosicionRanking(s.cm, principal);
  const insights = getInsights(s);

  // Comparación con el año anterior comparable: el de pandemia no sirve de
  // referencia y se salta.
  const previo = (() => {
    let a = Number(principal) - 1;
    while (a >= Number(primero) && meta.anios_pandemia.includes(String(a))) a--;
    return a >= Number(primero) ? String(a) : null;
  })();
  const delta =
    previo != null ? (delPrincipal?.total ?? 0) - (s.anios[previo]?.total ?? 0) : null;

  // La pensión no se agrega: la declara cada servicio. En la franja se muestra
  // la del nivel más alto que la tenga, y el desglose completo va en la tabla.
  const conPension = [...s.servicios].reverse().find((x) => x.pension != null);
  const cabecera = s.servicios.find((x) => x.slug === s.slug) ?? s.servicios[0];

  const contexto: { label: string; valor: string; fuente: string; anio?: string | null }[] = [
    // Sin año: no son medidas anuales sino cómo identifica SíseVe al colegio.
    { label: "UGEL", valor: s.ugel, fuente: "SíseVe", anio: null },
    { label: "DRE", valor: s.dre, fuente: "SíseVe", anio: null },
  ];
  if (s.codinst)
    contexto.push({ label: "Código de institución", valor: s.codinst, fuente: "ESCALE", anio: null });
  if (cabecera?.docentes != null)
    contexto.push({ label: "Docentes", valor: nf(cabecera.docentes), fuente: "ESCALE", anio: cabecera.anio_matricula });
  if (cabecera?.secciones != null)
    contexto.push({ label: "Secciones", valor: nf(cabecera.secciones), fuente: "ESCALE", anio: cabecera.anio_matricula });

  // Contexto de Identicole: cada campo trae su propia fuente y año, que pueden
  // diferir dentro de la misma ficha.
  const ETIQUETAS: Record<string, string> = {
    area: "Área",
    turno: "Turno",
    jornada: "Jornada escolar",
    alumnado: "Alumnado",
    internet: "Acceso a internet",
    accesibilidad: "Accesibilidad",
    espacios_educativos: "Espacios educativos",
    equipamiento: "Tipos de equipamiento",
  };
  for (const [clave, etiqueta] of Object.entries(ETIQUETAS)) {
    const c = s.contexto?.[clave];
    if (c) contexto.push({ label: etiqueta, valor: valorLegible(c.v), fuente: c.f, anio: c.a });
  }

  const azul = color(COLOR_SERIE.reportes);
  const navProps = { cm: s.cm, distrito: s.distrito, departamento: s.departamento };
  const seccion = "scroll-mt-24 border-t border-rule py-10 sm:py-14";

  return (
    <article className="pb-20">
      {/* ══ PORTADA, SOBRE LA NOCHE ═══════════════════════
          Identidad, cifra del año y contexto medible van juntos sobre el
          material oscuro; el análisis —evolución, tipos, agresor— baja al
          papel, que es donde se lee un gráfico denso sin fatiga. */}
      <section className="border-b border-rule">
        <div className={`${shell} pb-2 pt-6`}>
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              { label: "Colegios", href: "/colegios" },
              {
                label: s.departamento,
                href: `/colegios?region=${encodeURIComponent(s.departamento)}&de=colegios`,
              },
              { label: s.nombre },
            ]}
          />

          <div className="mt-3">
            <Suspense fallback={<div className="h-[4.6rem] border-y border-rule" />}>
              <SchoolNav {...navProps} />
            </Suspense>
          </div>
        </div>

        <div className={`${shell} grid gap-x-12 gap-y-10 pb-12 pt-10 sm:pt-12 lg:grid-cols-12`}>
          <div className="lg:col-span-7">
            <h1 className="titular max-w-[16ch] text-display-xl text-ink">{s.nombre}</h1>

            <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink-2">
              {[`${s.distrito} · ${s.departamento}`, s.gestion, ...s.niveles, `CM ${s.cm}`]
                .filter(Boolean)
                .map((v, k, arr) => (
                  <span key={`${v}-${k}`} className="flex items-center gap-3">
                    {v}
                    {k < arr.length - 1 ? (
                      <span aria-hidden className="text-rule">
                        /
                      </span>
                    ) : null}
                  </span>
                ))}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Link
                href={`/comparar?colegio=${encodeURIComponent(s.slug)}`}
                className="inline-flex items-center gap-2 rounded-full border border-accent px-4 py-2 text-[0.85rem] font-medium text-accent transition-colors duration-150 ease-suave hover:bg-accent hover:text-paper"
              >
                Comparar este colegio
              </Link>
              <Link
                href={`/colegios?region=${encodeURIComponent(s.departamento)}&distrito=${encodeURIComponent(s.distrito)}&de=colegios`}
                className="inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2 text-[0.85rem] text-ink-2 transition-colors duration-150 ease-suave hover:border-accent hover:text-accent"
              >
                Otros colegios de {s.distrito}
              </Link>
            </div>
          </div>

          {/* La cifra del año principal: el elemento más grande después del
              nombre. Es el dato que la página afirma. */}
          <div className="lg:col-span-5">
            <p className="meta">Reportes registrados en {principal}</p>
            <p className="cifra mt-4 text-[clamp(4rem,11vw,7rem)] text-ink">
              {nf(delPrincipal?.total ?? 0)}
            </p>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.9rem] text-ink-2">
              <span className="tabular">último año completo</span>
              {delta != null && previo ? (
                <span className="tabular text-accent">
                  <span aria-hidden>{delta > 0 ? "↑" : delta < 0 ? "↓" : "="}</span>{" "}
                  {delta === 0
                    ? `sin cambio vs. ${previo}`
                    : `${delta > 0 ? "+" : ""}${nf(delta)} vs. ${previo}`}
                </span>
              ) : null}
            </p>
            {/* En versalita monoespaciada esta línea no se leía: es una cifra
                con significado, no un metadato de procedencia. */}
            <p className="mt-2.5 text-[0.88rem] text-ink-3">
              <span className="tabular">{nf(s.total)}</span> reportes en total desde{" "}
              {primero}
              {s.servicios.length > 1 ? `, sumando sus ${nf(s.servicios.length)} niveles` : ""}
            </p>

            {puesto ? (
              <div className="mt-8 border-t border-rule pt-6">
                <p className="flex items-baseline gap-3">
                  <span className="cifra text-cifra-l text-accent">#{nf(puesto.pos)}</span>
                  <span className="text-[0.9rem] text-ink-2">
                    de {nf(puesto.universo)} colegios
                  </span>
                </p>
                <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-3">
                  Reportes registrados · {principal} · todo el país
                </p>
                <Link
                  href={`/rankings?anio=${principal}`}
                  className="mt-3 inline-flex items-baseline gap-1.5 text-[0.85rem] font-medium text-accent hover:underline"
                >
                  Ver el ranking
                  <span aria-hidden>→</span>
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {/* Contexto medible: todo secundario, todo con su año. */}
        <div className={shell}>
          <h2 className="sr-only">Otros datos del colegio</h2>
          <MetricBand
            metricas={[
              {
                label: `Reportes en ${meta.anio_parcial}`,
                valor: nf(enCurso?.total ?? 0),
                fuente: "SíseVe",
                anio: `${meta.anio_parcial} · en curso`,
                nota: `Hasta el ${fechaLegible(meta.corte)}.`,
              },
              {
                label: "# Alumnos",
                valor: s.matricula != null ? nf(s.matricula) : null,
                unidad: "alumnos",
                fuente: "Censo Educativo",
                anio: s.anio_matricula,
                nota:
                  s.matricula != null && s.servicios.length > 1
                    ? `Suma de sus ${nf(s.servicios.length)} niveles.`
                    : undefined,
                ausente: s.servicios.some((x) => x.matricula)
                  ? "Algún nivel no está en el censo: no se puede sumar"
                  : "El censo educativo no trae este colegio",
              },
              {
                label: "Pensión mensual",
                valor: conPension?.pension != null ? `S/ ${nf(conPension.pension)}` : null,
                fuente: "Identicole",
                anio: conPension?.anio_pension,
                nota:
                  conPension && s.servicios.length > 1
                    ? `Declarada para ${conPension.nivel.toLowerCase()}.`
                    : undefined,
                ausente: s.gestion?.startsWith("Públic")
                  ? "No aplica: es un colegio público"
                  : "Sin consultar todavía",
              },
              {
                label: "Reportes por 1.000 alumnos",
                valor: s.tasa_2024 != null ? dec(s.tasa_2024, 1) : null,
                fuente: "SíseVe / Censo",
                anio: s.tasa_2024 != null ? t : null,

                ausente: !s.matricula_completa
                  ? "Falta el número de alumnos de algún nivel: la tasa saldría inflada"
                  : s.matricula == null
                    ? "Sin denominador del mismo año"
                    : `Menos de ${nf(meta.matricula_minima)} alumnos: no sería fiable`,
              },
            ]}
          />
        </div>
      </section>

      <div className={shell}>
      {/* ── Señales ─────────────────────────────── */}
      <section id="senales" className={seccion}>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-display text-display-m font-medium">Señales</h2>
            <p className="mt-3 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Lo que destaca al mirar su historia y compararlo con otros colegios.
            </p>
            <p className="mt-4 max-w-prose text-[0.78rem] leading-relaxed text-ink-3">
              Describen registros, no evalúan al colegio. Un número alto de reportes
              puede reflejar que allí denunciar funciona mejor.
            </p>
          </div>

          <div className="lg:col-span-8">
            {insights.length > 0 ? (
              <ul className="grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2">
                {insights.map((x) => (
                  <li key={x.titular} className="flex flex-col gap-2.5 bg-surface p-5 sm:p-6">
                    <p className="flex items-center gap-2.5">
                      {x.flecha ? (
                        <span aria-hidden className="text-[1.05rem] leading-none" style={{ color: azul }}>
                          {FLECHA[x.flecha]}
                        </span>
                      ) : null}
                      <span className="meta">{x.etiqueta}</span>
                    </p>
                    <p className="text-[1.15rem] font-bold leading-tight tracking-[-0.03em] text-ink">
                      {x.titular}
                    </p>
                    <p className="text-[0.86rem] leading-relaxed text-ink-2">{x.detalle}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-rule p-5 sm:p-6">
                <p className="text-[0.95rem] text-ink-2">
                  No hay señales destacables para este colegio.
                </p>
                <p className="mt-2 max-w-prose text-[0.82rem] leading-relaxed text-ink-3">
                  Sus cifras no superan ninguno de los umbrales con los que se detectan
                  patrones. No significa que no ocurra violencia: significa que su
                  registro no se aparta de lo corriente.
                </p>
              </div>
            )}

            <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-3">
              Se calculan sobre {principal}, el último año completo, y sobre la serie de
              años comparables. {meta.anios_pandemia.join(" y ")} quedan fuera de rachas y
              récords porque los colegios estuvieron cerrados.{" "}
              <Link href="/senales" className="text-accent hover:underline">
                Cómo se detectan los cambios
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ── Evolución, niveles, tipos y presunto agresor ────────── */}
      <Suspense
        fallback={<div className="h-80 animate-pulse border-t border-rule bg-surface" />}
      >
        <LevelBreakdown
          servicios={s.servicios.map((x) => ({
            nivel: x.nivel,
            anios: x.anios,
            matricula: x.matricula ?? null,
            pension: x.pension ?? null,
            anio_pension: x.anio_pension ?? null,
          }))}
          institucion={s.anios}
          anios={anios}
          pandemia={meta.anios_pandemia}
          parcial={meta.anio_parcial}
          principal={principal}
          anioMatricula={s.anio_matricula}
        />
      </Suspense>

      {/* ── Contexto ───────────────────────────────────────────── */}
      <section id="contexto" className={seccion}>
        <h2 className="mb-6 font-display text-display-m font-medium">Contexto del colegio</h2>
        <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {contexto.map((c) => (
            <div
              key={c.label}
              className="flex items-baseline justify-between gap-4 border-b border-rule-2 py-3"
            >
              <dt className="text-[0.88rem] text-ink-2">{c.label}</dt>
              <dd className="flex items-center gap-2.5 text-right">
                <span className="text-[0.88rem] font-medium text-ink">{c.valor}</span>
                <DataSourceBadge fuente={c.fuente} anio={c.anio} />
              </dd>
            </div>
          ))}
        </dl>
        {Object.keys(s.contexto ?? {}).length === 0 ? (
          <p className="mt-5 max-w-prose text-[0.8rem] leading-relaxed text-ink-3">
            El contexto de Identicole —área, jornada, conectividad, infraestructura— aún no
            se ha consultado para este colegio.
          </p>
        ) : null}

      </section>

      {/* ── Seguir explorando ──────────────────────────────────── */}
      <Suspense fallback={null}>
        <SchoolNav {...navProps} compacto />
      </Suspense>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.88rem]">
        <Link
          href={`/colegios?region=${encodeURIComponent(s.departamento)}&distrito=${encodeURIComponent(s.distrito)}&de=colegios`}
          className="font-medium text-accent hover:underline"
        >
          Otros colegios de {s.distrito} →
        </Link>
        <Link
          href={`/colegios?region=${encodeURIComponent(s.departamento)}&gestion=${encodeURIComponent(s.gestion)}&de=colegios`}
          className="font-medium text-accent hover:underline"
        >
          Colegios {s.gestion.toLowerCase()}s en {s.departamento} →
        </Link>
      </div>
      </div>
    </article>
  );
}
