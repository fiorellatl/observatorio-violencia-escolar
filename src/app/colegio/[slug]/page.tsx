import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { MethodologyNote } from "@/components/MethodologyNote";
import { MetricBand } from "@/components/MetricBand";
import { ReportTrend } from "@/components/ReportTrend";
import { ShareButton } from "@/components/ShareButton";
import { ViolenceBreakdown } from "@/components/ViolenceBreakdown";
import { getMeta, getPrerenderSlugs, getSchool } from "@/lib/data/provider";
import { dec, nf, valorLegible } from "@/lib/format";
import { COLOR_ACTOR, COLOR_VIOLENCIA, color } from "@/lib/viz/colors";
import { entradilla, panelEnlace } from "@/lib/ui";

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
  const s = getSchool(slug);
  if (!s) return { title: "Colegio no encontrado", robots: { index: false } };

  const titulo = `${s.nombre} — ${s.distrito}`;
  const desc =
    `${s.nombre} (${s.distrito}, ${s.departamento}) registra ${nf(s.total)} reportes ` +
    `en SíseVe entre ${Object.keys(s.anios).sort()[0]} y ` +
    `${Object.keys(s.anios).sort().slice(-1)[0]}. Datos públicos de matrícula, nivel y ` +
    `contexto, con el año de cada fuente.`;

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

export default async function ColegioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = getSchool(slug);
  if (!s) notFound();

  const meta = getMeta();
  const anios = Object.keys(s.anios).sort();
  const ultimo = anios[anios.length - 1];
  const serie = anios.map((a) => ({
    anio: a,
    total: s.anios[a].total,
    pandemia: meta.anios_pandemia.includes(a),
    parcial: a === meta.anio_parcial,
  }));

  const t = meta.anio_transversal;
  const delAnio = s.anios[t];
  const suma = (k: keyof (typeof s.anios)[string]) =>
    anios.reduce((acc, a) => acc + (Number(s.anios[a][k]) || 0), 0);

  const tipos = [
    { label: "Psicológica", value: suma("psicologica"), color: color(COLOR_VIOLENCIA.psicologica) },
    { label: "Física", value: suma("fisica"), color: color(COLOR_VIOLENCIA.fisica) },
    { label: "Sexual", value: suma("sexual"), color: color(COLOR_VIOLENCIA.sexual) },
  ];
  const actores = [
    { label: "Entre estudiantes", value: suma("entre_escolares"), color: color(COLOR_ACTOR.entre_escolares) },
    { label: "De un adulto del colegio", value: suma("personal_ie"), color: color(COLOR_ACTOR.personal_ie) },
  ];

  const contexto: { label: string; valor: string; fuente: string; anio?: string | null }[] = [
    // Sin año: no son medidas anuales sino cómo identifica SíseVe al colegio en
    // sus registros. Ponerles "2026" sugeriría una observación que no existe.
    { label: "Gestión", valor: s.gestion, fuente: "SíseVe", anio: null },
    { label: "Nivel educativo", valor: s.nivel, fuente: "SíseVe", anio: null },
    { label: "UGEL", valor: s.ugel, fuente: "SíseVe", anio: null },
    { label: "DRE", valor: s.dre, fuente: "SíseVe", anio: null },
  ];
  if (s.docentes != null)
    contexto.push({ label: "Docentes", valor: nf(s.docentes), fuente: "ESCALE", anio: s.anio_matricula });
  if (s.secciones != null)
    contexto.push({ label: "Secciones", valor: nf(s.secciones), fuente: "ESCALE", anio: s.anio_matricula });

  // Contexto de Identicole: cada campo trae su propia fuente y año, que pueden
  // diferir dentro de la misma ficha (Padrón 2026 junto a Censo Escolar 2021).
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
  for (const [clave, meta] of Object.entries(ETIQUETAS)) {
    const c = s.contexto?.[clave];
    if (c) contexto.push({ label: meta, valor: valorLegible(c.v), fuente: c.f, anio: c.a });
  }

  return (
    <article className="mx-auto max-w-shell px-5 py-10">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Colegios", href: "/colegios" },
          {
            label: s.departamento,
            href: `/colegios?region=${encodeURIComponent(s.departamento)}`,
          },
          {
            label: s.distrito,
            href: `/colegios?region=${encodeURIComponent(s.departamento)}&distrito=${encodeURIComponent(s.distrito)}`,
          },
          { label: s.nombre },
        ]}
      />

      {/* ── Cabecera ──────────────────────────────────────────── */}
      <header className="border-b border-rule pb-7">
        <h1 className="max-w-[24ch] font-display text-display-l font-medium text-balance">
          {s.nombre}
        </h1>
        <p className="mt-3 text-[0.95rem] text-ink-2">
          {s.distrito}, {s.provincia}, {s.departamento}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[0.84rem]">
          {[
            ["Gestión", s.gestion],
            ["Nivel", s.nivel],
            ["Código modular", s.cm],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className={k === "Código modular" ? "tabular font-mono text-ink" : "text-ink"}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/comparar?colegio=${encodeURIComponent(s.slug)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3.5 py-2 text-[0.86rem] font-medium text-accent transition-colors hover:bg-accent hover:text-surface"
          >
            Comparar este colegio
          </Link>
          <ShareButton />
        </div>
      </header>

      {/* ── Resumen ───────────────────────────────────────────── */}
      <section id="resumen" className="scroll-mt-28 border-b border-rule py-10 sm:py-12">
        <h2 className="sr-only">Resumen de datos</h2>
        <MetricBand
          metricas={[
            {
              label: `Reportes registrados en ${t}`,
              valor: delAnio ? nf(delAnio.total) : "0",
              fuente: "SíseVe",
              anio: t,
              nota: delAnio
                ? `${nf(s.total)} en total desde ${anios[0]}`
                : `Ninguno ese año. ${nf(s.total)} en total desde ${anios[0]}`,
            },
            {
              label: "# Alumnos",
              valor: s.matricula != null ? nf(s.matricula) : null,
              unidad: "estudiantes",
              fuente: "ESCALE",
              anio: s.anio_matricula,
              ausente: "El padrón de esta zona aún no está integrado",
            },
            {
              label: "Reportes por 1.000 alumnos",
              valor: s.tasa_2024 != null ? dec(s.tasa_2024, 1) : null,
              fuente: "SíseVe / ESCALE",
              // Los dos años van juntos porque NO coinciden: los reportes son
              // del año transversal y el padrón es el único que existe. Poner
              // solo uno de los dos escondería de qué está hecho el número.
              anio: `rep. ${t} · alum. ${s.anio_matricula ?? "—"}`,
              nota:
                s.tasa_2024 != null
                  ? `Reportes de ${t} divididos entre los alumnos de ${s.anio_matricula}. Permite comparar colegios de distinto tamaño.`
                  : undefined,
              ausente:
                s.matricula == null
                  ? "Sin el número de alumnos no hay denominador, y sin denominador no hay tasa"
                  : `Menos de ${nf(meta.matricula_minima)} alumnos: la tasa no sería fiable`,
            },
            {
              label: "Pensión mensual",
              valor: s.pension != null ? `S/ ${nf(s.pension)}` : null,
              fuente: "Identicole",
              anio: s.anio_pension,
              nota: s.pension != null ? "Declarada por el colegio al Ministerio" : undefined,
              ausente: s.gestion?.startsWith("Públic")
                ? "No aplica: es un colegio público"
                : "Identicole aún no se ha consultado para este colegio",
            },
          ]}
        />
      </section>

      {/* ── Evolución ─────────────────────────────────────────── */}
      <section id="trayectoria" className="scroll-mt-28 border-t border-rule py-8">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-display-m font-medium">Evolución</h2>
          <DataSourceBadge fuente="SíseVe" anio={`${anios[0]}–${ultimo}`} />
        </div>
        <p className="mb-5 max-w-prose text-[0.88rem] text-ink-2">
          Reportes registrados por año en esta institución.
        </p>

        <ReportTrend data={serie} alto={250} />

        {serie.some((p) => p.pandemia) ? (
          <div className="mt-4">
            <MethodologyNote tono="aviso" href="/metodologia">
              Los años {meta.anios_pandemia.join(" y ")} presentan una fuerte alteración
              en los registros asociada al cierre de colegios durante la pandemia y no
              se utilizan como período normal de comparación.
            </MethodologyNote>
          </div>
        ) : null}
      </section>

      {/* ── Tipos ─────────────────────────────────────────────── */}
      <section id="tipos" className="scroll-mt-28 grid gap-8 border-t border-rule py-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-display-m font-medium">Tipo de violencia</h2>
            <DataSourceBadge fuente="SíseVe" anio={`${anios[0]}–${ultimo}`} />
          </div>
          <ViolenceBreakdown items={tipos} total={s.total} />
        </div>
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-display-m font-medium">Quién ejerce</h2>
            <DataSourceBadge fuente="SíseVe" anio={`${anios[0]}–${ultimo}`} />
          </div>
          <ViolenceBreakdown items={actores} total={s.total} variante="duo" />
          <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-3">
            El acoso escolar y el ciberacoso se registran solo entre estudiantes. Cuando
            el agresor es un adulto del colegio, el sistema lo clasifica bajo otras
            categorías, como castigo físico o trato humillante.
          </p>
        </div>
      </section>

      {/* ── Contexto ──────────────────────────────────────────── */}
      <section id="contexto" className="scroll-mt-28 border-t border-rule py-8">
        <h2 className="mb-5 font-display text-display-m font-medium">Contexto del colegio</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
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
        <p className="mt-5 max-w-prose text-[0.8rem] leading-relaxed text-ink-3">
          {Object.keys(s.contexto ?? {}).length === 0
            ? "El contexto de Identicole —área, jornada escolar, conectividad, infraestructura— aún no se ha consultado para este colegio. No mostramos variables que todavía no tenemos."
            : "Los años difieren entre fuentes a propósito: el padrón se actualiza cada año y el Censo Escolar no. Cada dato lleva el suyo."}
        </p>
      </section>

      <div className="border-t border-rule pt-8">
        <MethodologyNote href="/metodologia">
          Los reportes de SíseVe son alertas registradas, no casos confirmados. Un número
          más alto puede reflejar que en ese colegio denunciar funciona mejor, no
          necesariamente que ocurra más violencia.
        </MethodologyNote>
      </div>

      {/* ── Salidas ───────────────────────────────────────────── */}
      <section className="mt-10 border-t border-rule pt-9">
        <h2 className="font-display text-display-m font-medium">Explora más</h2>
        <p className={entradilla}>
          Este colegio en su contexto, y el contexto sin este colegio.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href={`/colegios?region=${encodeURIComponent(s.departamento)}&distrito=${encodeURIComponent(s.distrito)}`}
            className={panelEnlace}
          >
            <p className="font-display text-[1.05rem] font-medium">
              Otros colegios de {s.distrito}
            </p>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
              Los servicios educativos del distrito con reportes registrados.
            </p>
          </Link>
          <Link
            href={`/colegios?region=${encodeURIComponent(s.departamento)}&nivel=${encodeURIComponent(s.nivel)}&gestion=${encodeURIComponent(s.gestion)}`}
            className={panelEnlace}
          >
            <p className="font-display text-[1.05rem] font-medium">Colegios parecidos</p>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
              Mismo nivel y misma gestión en {s.departamento}.
            </p>
          </Link>
          <Link href="/datos" className={panelEnlace}>
            <p className="font-display text-[1.05rem] font-medium">Los datos del país</p>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
              Qué se registra, cómo ha cambiado y qué no se puede concluir.
            </p>
          </Link>
          <Link href="/metodologia" className={panelEnlace}>
            <p className="font-display text-[1.05rem] font-medium">Cómo leer esta ficha</p>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
              Qué es un reporte, qué es una tasa y qué significa un cero.
            </p>
          </Link>
        </div>
      </section>
    </article>
  );
}
