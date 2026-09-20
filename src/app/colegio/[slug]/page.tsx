import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { LevelBreakdown } from "@/components/LevelBreakdown";
import { MethodologyNote } from "@/components/MethodologyNote";
import { MetricBand } from "@/components/MetricBand";
import { SchoolNav } from "@/components/SchoolNav";
import { ShareButton } from "@/components/ShareButton";
import {
  getAnioPrincipal,
  getInstitution,
  getMeta,
  getPosicionRanking,
  getPrerenderSlugs,
  getSenalDeColegio,
  getServiceRedirect,
} from "@/lib/data/provider";
import { dec, nf, valorLegible } from "@/lib/format";
import { COLOR_SERIE, color } from "@/lib/viz/colors";

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

/** Rótulo de cada clase de señal. Nunca "riesgo" ni "peligro". */
const SENAL: Record<string, { titulo: string; flecha?: string }> = {
  aumento: { titulo: "Aumento inusual", flecha: "↑" },
  disminucion: { titulo: "Disminución inusual", flecha: "↓" },
  composicion: { titulo: "Cambio en el tipo de reportes" },
  reaparicion: { titulo: "Vuelve a registrar" },
  persistencia: { titulo: "Registro sostenido" },
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
  const senal = getSenalDeColegio(s.servicios.map((x) => x.cm));

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
    <article className="mx-auto max-w-shell px-5 pb-20 sm:px-7">
      <div className="pt-4">
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
      </div>

      {/* ── Navegación por el universo de origen ───────────────── */}
      <div className="mt-3">
        <Suspense fallback={<div className="h-[4.6rem] border-y border-rule" />}>
          <SchoolNav {...navProps} />
        </Suspense>
      </div>

      {/* ── Identidad + qué está pasando ───────────────────────── */}
      <header className="grid gap-x-12 gap-y-10 border-b border-rule py-10 sm:py-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="max-w-[18ch] font-display text-display-xl font-semibold text-balance">
            {s.nombre}
          </h1>
          <p className="mt-4 text-[1.05rem] text-ink-2">
            {s.distrito}
            <span aria-hidden className="mx-2 text-rule">
              ·
            </span>
            {s.provincia}
            <span aria-hidden className="mx-2 text-rule">
              ·
            </span>
            {s.departamento}
          </p>

          <dl className="mt-6 flex flex-wrap items-center gap-2 text-[0.82rem]">
            {[s.gestion, ...s.niveles].filter(Boolean).map((v, i) => (
              <div key={`${v}-${i}`} className="rounded-full border border-rule px-3 py-1">
                <dt className="sr-only">{i === 0 ? "Gestión" : "Nivel"}</dt>
                <dd className="text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Link
              href={`/comparar?colegio=${encodeURIComponent(s.slug)}`}
              className="inline-flex items-center gap-2 rounded border border-accent bg-accent px-3.5 py-2 text-[0.86rem] font-medium text-paper transition-colors duration-150 ease-suave hover:border-accent-2 hover:bg-accent-2"
            >
              Comparar este colegio
            </Link>
            <ShareButton titulo={`${s.nombre} — Observatorio Escolar`} />
          </div>
        </div>

        {/* La cifra del año principal es el elemento más grande de la página
            después del nombre. El filete va en el azul de la serie "reportes":
            el mismo con el que se dibuja la evolución. */}
        <div className="flex flex-col justify-between gap-9 lg:col-span-5">
          <div>
            <div aria-hidden className="h-[3px] w-14 rounded-sm" style={{ background: azul }} />
            <p className="meta mt-4">Reportes registrados</p>
            <p className="cifra mt-2.5 text-cifra-xl text-ink">{nf(delPrincipal?.total ?? 0)}</p>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.9rem] text-ink-2">
              <span className="tabular font-medium">
                {principal} <span className="font-normal text-ink-3">· último año completo</span>
              </span>
              {delta != null && previo ? (
                <span className="tabular text-ink-3">
                  <span aria-hidden>{delta > 0 ? "↑" : delta < 0 ? "↓" : "="}</span>{" "}
                  {delta === 0
                    ? `sin cambio respecto a ${previo}`
                    : `${delta > 0 ? "+" : ""}${nf(delta)} respecto a ${previo}`}
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-[0.8rem] text-ink-3">
              <span className="tabular">{nf(s.total)}</span> reportes en total desde {primero}
              {s.servicios.length > 1 ? `, sumando sus ${nf(s.servicios.length)} niveles` : ""} ·
              SíseVe
            </p>
          </div>

          {puesto ? (
            <div className="border-t border-rule pt-6">
              <p className="meta">Posición en el ranking</p>
              <p className="mt-2.5 flex items-baseline gap-2.5">
                <span className="cifra text-cifra-l text-ink">#{nf(puesto.pos)}</span>
                <span className="text-[0.92rem] text-ink-3">de {nf(puesto.universo)} colegios</span>
              </p>
              <p className="mt-2 text-[0.84rem] text-ink-2">
                Reportes registrados · {principal} · todo el país
              </p>
              <p className="mt-2 max-w-[42ch] text-[0.78rem] leading-relaxed text-ink-3">
                Es una posición dentro de este universo, no una calificación del colegio.
                Con otro año o territorio, cambia.
              </p>
              <Link
                href={`/rankings?anio=${principal}`}
                className="mt-3 inline-flex items-baseline gap-1.5 text-[0.86rem] font-medium text-accent hover:underline"
              >
                Ver el ranking
                <span aria-hidden>→</span>
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Contexto medible: todo secundario, todo con su año ─── */}
      <section id="resumen" className="scroll-mt-24 py-10 sm:py-12">
        <h2 className="sr-only">Otros datos del colegio</h2>
        <MetricBand
          metricas={[
            {
              label: `Reportes en ${meta.anio_parcial}`,
              valor: nf(enCurso?.total ?? 0),
              fuente: "SíseVe",
              anio: `${meta.anio_parcial} · en curso`,
              nota: `Hasta el ${meta.corte}. No comparable con un año completo.`,
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
                conPension && s.servicios.length > 1 ? `Declarada para ${conPension.nivel.toLowerCase()}.` : undefined,
              ausente: s.gestion?.startsWith("Públic")
                ? "No aplica: es un colegio público"
                : "Sin consultar todavía",
            },
            {
              label: "Reportes por 1.000 alumnos",
              valor: s.tasa_2024 != null ? dec(s.tasa_2024, 1) : null,
              fuente: "SíseVe / Censo Educativo",
              anio: s.tasa_2024 != null ? t : null,
              nota: `Métrica secundaria. Reportes de ${t} ÷ alumnos de ${s.anio_matricula}.`,
              ausente: !s.matricula_completa
                ? "Falta el número de alumnos de algún nivel: la tasa saldría inflada"
                : s.matricula == null
                  ? "Sin denominador del mismo año"
                  : `Menos de ${nf(meta.matricula_minima)} alumnos: no sería fiable`,
            },
          ]}
        />
      </section>

      {/* ── Señal reciente ─────────────────────────────────────── */}
      <section id="senal" className={seccion}>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-display text-display-m font-medium">Señales</h2>
            <p className="mt-2 max-w-prose text-[0.85rem] leading-relaxed text-ink-3">
              Cambios en el registro más grandes de lo esperable entre dos años, con
              corrección por las miles de comparaciones que se hacen a la vez.
            </p>
          </div>

          <div className="lg:col-span-8">
            {senal ? (
              <div
                className="rounded-lg border border-rule bg-surface p-5 sm:p-6"
                style={{ borderLeft: `3px solid ${azul}` }}
              >
                <p className="meta">Señal reciente</p>
                <p className="mt-2.5 flex items-baseline gap-2.5 font-display text-display-m font-medium">
                  {SENAL[senal.clase].flecha ? (
                    <span aria-hidden style={{ color: azul }}>
                      {SENAL[senal.clase].flecha}
                    </span>
                  ) : null}
                  {SENAL[senal.clase].titulo}
                </p>

                <p className="mt-3 text-[0.95rem] text-ink-2">
                  {senal.clase === "aumento" || senal.clase === "disminucion" ? (
                    <span className="tabular">
                      {nf(senal.anterior)} → {nf(senal.actual)} reportes ·{" "}
                      {senal.anio_anterior} → {senal.anio}
                    </span>
                  ) : senal.clase === "composicion" ? (
                    <span className="tabular">
                      El reparto por tipo de violencia cambió entre {senal.anio_anterior} y{" "}
                      {senal.anio}
                    </span>
                  ) : senal.clase === "reaparicion" ? (
                    <span className="tabular">
                      {nf(senal.actual)} reportes en {senal.anio} tras {nf(senal.anios_sin)}{" "}
                      años sin registrar; el último fue {senal.ultimo_con}
                    </span>
                  ) : senal.clase === "persistencia" ? (
                    <span className="tabular">
                      Registró reportes en {nf(senal.anios_con)} de los últimos{" "}
                      {nf(senal.ventana)} años
                    </span>
                  ) : null}
                </p>

                <Link
                  href="/senales"
                  className="mt-4 inline-flex items-baseline gap-1.5 text-[0.88rem] font-medium text-accent hover:underline"
                >
                  Ver por qué aparece
                  <span aria-hidden>→</span>
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-rule p-5 sm:p-6">
                <p className="text-[0.95rem] text-ink-2">
                  No hay señales recientes para este colegio.
                </p>
                <p className="mt-2 max-w-prose text-[0.82rem] leading-relaxed text-ink-3">
                  Significa que su registro no cambió más de lo esperable entre los dos
                  últimos años comparables. No significa que no ocurra violencia.
                </p>
              </div>
            )}
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

        <div className="mt-8">
          <MethodologyNote href="/metodologia">
            Los reportes de SíseVe son alertas registradas, no casos confirmados. Un número
            más alto puede reflejar que en ese colegio denunciar funciona mejor.
          </MethodologyNote>
        </div>
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
    </article>
  );
}
