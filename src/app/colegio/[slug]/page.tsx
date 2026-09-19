import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { MethodologyNote } from "@/components/MethodologyNote";
import { MetricCard } from "@/components/MetricCard";
import { ReportTrend } from "@/components/ReportTrend";
import { ViolenceBreakdown } from "@/components/ViolenceBreakdown";
import { getMeta, getPrerenderSlugs, getSchool } from "@/lib/data/provider";
import { dec, nf } from "@/lib/format";

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
    `Información pública sobre violencia escolar en ${s.nombre}, ${s.distrito}, ` +
    `${s.departamento}. ${nf(s.total)} reportes registrados en SíseVe. ` +
    `Código modular ${s.cm}.`;

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
    { label: "Psicológica", value: suma("psicologica"), color: "var(--data-1)" },
    { label: "Física", value: suma("fisica"), color: "var(--data-2)" },
    { label: "Sexual", value: suma("sexual"), color: "var(--data-3)" },
  ];
  const actores = [
    { label: "Entre estudiantes", value: suma("entre_escolares"), color: "var(--data-1)" },
    { label: "De un adulto del colegio", value: suma("personal_ie"), color: "var(--data-2)" },
  ];

  const contexto: { label: string; valor: string; fuente: string; anio?: string | null }[] = [
    { label: "Gestión", valor: s.gestion, fuente: "SíseVe", anio: ultimo },
    { label: "Nivel educativo", valor: s.nivel, fuente: "SíseVe", anio: ultimo },
    { label: "UGEL", valor: s.ugel, fuente: "SíseVe", anio: ultimo },
    { label: "DRE", valor: s.dre, fuente: "SíseVe", anio: ultimo },
  ];
  if (s.docentes != null)
    contexto.push({ label: "Docentes", valor: nf(s.docentes), fuente: "ESCALE", anio: s.anio_matricula });
  if (s.secciones != null)
    contexto.push({ label: "Secciones", valor: nf(s.secciones), fuente: "ESCALE", anio: s.anio_matricula });

  return (
    <article className="mx-auto max-w-shell px-5 py-10">
      <nav className="mb-6 text-[0.8rem] text-ink-3">
        <Link href="/colegios" className="hover:text-accent">
          Colegios
        </Link>
        <span aria-hidden> / </span>
        <span>{s.distrito}</span>
      </nav>

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
      </header>

      {/* ── Resumen ───────────────────────────────────────────── */}
      <section className="py-8">
        <h2 className="sr-only">Resumen de datos</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label={`Reportes registrados en ${t}`}
            value={delAnio ? nf(delAnio.total) : "0"}
            fuente="SíseVe"
            anio={t}
            nota={`${nf(s.total)} en total desde ${anios[0]}`}
          />
          <MetricCard
            label="Matrícula"
            value={s.matricula != null ? nf(s.matricula) : null}
            unit="estudiantes"
            fuente="ESCALE"
            anio={s.anio_matricula}
            ausente="Aún no integrada para esta zona"
          />
          <MetricCard
            label="Reportes por 1,000 estudiantes"
            value={s.tasa_2024 != null ? dec(s.tasa_2024, 1) : null}
            fuente="SíseVe / ESCALE"
            anio={t}
            ausente="Requiere matrícula"
            nota={s.tasa_2024 != null ? "Permite comparar colegios de distinto tamaño" : undefined}
          />
          <MetricCard
            label="Pensión mensual"
            value={null}
            fuente="Identicole"
            ausente="Pendiente de integrar"
          />
        </div>
      </section>

      {/* ── Evolución ─────────────────────────────────────────── */}
      <section className="border-t border-rule py-8">
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
      <section className="grid gap-8 border-t border-rule py-8 lg:grid-cols-2">
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
          <ViolenceBreakdown items={actores} total={s.total} />
          <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-3">
            El acoso escolar y el ciberacoso se registran solo entre estudiantes. Cuando
            el agresor es un adulto del colegio, el sistema lo clasifica bajo otras
            categorías, como castigo físico o trato humillante.
          </p>
        </div>
      </section>

      {/* ── Contexto ──────────────────────────────────────────── */}
      <section className="border-t border-rule py-8">
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
        <p className="mt-5 text-[0.8rem] leading-relaxed text-ink-3">
          Área urbano/rural, jornada escolar completa, infraestructura, conectividad y
          resultados educativos provienen de Identicole y aún no están integrados. No se
          muestran variables que todavía no tenemos.
        </p>
      </section>

      <div className="border-t border-rule pt-8">
        <MethodologyNote href="/metodologia">
          Los reportes de SíseVe son alertas registradas, no casos confirmados. Un número
          más alto puede reflejar que en ese colegio denunciar funciona mejor, no
          necesariamente que ocurra más violencia.
        </MethodologyNote>
      </div>
    </article>
  );
}
