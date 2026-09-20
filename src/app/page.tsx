import type { Metadata } from "next";
import Link from "next/link";
import { ReportTrend } from "@/components/ReportTrend";
import { SearchBox } from "@/components/SearchBox";
import { MethodologyNote } from "@/components/MethodologyNote";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { getMeta, getNational } from "@/lib/data/provider";
import { nf } from "@/lib/format";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  const meta = getMeta();
  const nacional = getNational();

  const destacados = [
    { valor: nf(meta.reportes), label: "Reportes registrados" },
    { valor: nf(meta.colegios), label: "Colegios con al menos un reporte" },
    { valor: `${meta.anio_min}–${meta.anio_max}`, label: "Período analizado" },
  ];

  const serie = nacional.map((n) => ({
    anio: n.anio,
    total: n.total,
    pandemia: n.pandemia,
    parcial: n.anio === meta.anio_parcial,
  }));

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-shell px-5 pb-12 pt-14 sm:pt-20">
        <h1 className="max-w-[17ch] font-display text-display-xl font-medium text-balance">
          ¿Qué sabemos sobre la violencia escolar en los colegios del Perú?
        </h1>
        <p className="mt-6 max-w-prose text-[1.05rem] leading-relaxed text-ink-2">
          Explora los reportes registrados en SíseVe y relaciónalos con información
          pública de matrícula, características del colegio y contexto educativo.
        </p>

        <div className="mt-8 max-w-2xl">
          <SearchBox />
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/colegios"
              className="rounded-lg bg-accent px-5 py-2.5 text-[0.9rem] font-medium text-white transition-opacity hover:opacity-90"
            >
              Explorar colegios
            </Link>
            <Link
              href="/datos"
              className="rounded-lg border border-rule bg-surface px-5 py-2.5 text-[0.9rem] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Explorar los datos
            </Link>
          </div>
        </div>
      </section>

      {/* ── Datos destacados ───────────────────────────────────── */}
      <section className="border-y border-rule bg-surface">
        <div className="mx-auto grid max-w-shell grid-cols-1 divide-y divide-rule px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {destacados.map((d) => (
            <div key={d.label} className="py-7 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <p className="tabular font-mono text-stat font-semibold tracking-tight">
                {d.valor}
              </p>
              <p className="mt-2 text-[0.82rem] leading-snug text-ink-2">{d.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Qué es y qué no es ─────────────────────────────────── */}
      <section className="mx-auto max-w-shell px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-accent">
              Antes de mirar cualquier cifra
            </p>
            <h2 className="mt-3 font-display text-display-l font-medium text-balance">
              Un reporte no es un caso probado
            </h2>
            <div className="mt-5 space-y-4 text-[0.95rem] leading-relaxed text-ink-2">
              <p>
                SíseVe es el portal del Ministerio de Educación donde cualquier
                persona —un estudiante, su familia, un docente— puede registrar un
                hecho de violencia escolar. Funciona desde 2013.
              </p>
              <p>
                Lo que se registra son <strong className="font-semibold text-ink">alertas</strong>.
                El propio Ministerio advierte que puede existir más de un reporte
                sobre un mismo hecho, y que un reporte no equivale a un caso
                confirmado ni a una víctima única.
              </p>
              <p>
                Un colegio con muchos reportes puede ser, simplemente, un colegio
                donde denunciar funciona. Por eso aquí no hay rankings de colegios
                «peligrosos» ni «seguros».
              </p>
            </div>
            <Link
              href="/metodologia"
              className="mt-6 inline-block text-[0.88rem] font-medium text-accent underline-offset-4 hover:underline"
            >
              Cómo leer estos datos →
            </Link>
          </div>

          <figure className="rounded-xl border border-rule bg-surface p-5">
            <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[0.92rem] font-semibold text-ink">
                Reportes registrados por año
              </span>
              <DataSourceBadge fuente="SíseVe" anio={`${meta.anio_min}–${meta.anio_max}`} />
            </figcaption>
            <p className="mb-4 text-[0.8rem] leading-snug text-ink-3">
              Todo el país. {meta.anio_parcial} cubre enero a agosto.
            </p>

            <ReportTrend data={serie} alto={250} />

            <div className="mt-4">
              <MethodologyNote tono="aviso" href="/metodologia">
                La franja sombreada marca {meta.anios_pandemia.join(" y ")}: los
                colegios estuvieron cerrados por la pandemia y casi no hubo canal de
                reporte. Esos dos años no se usan como período normal de comparación.
              </MethodologyNote>
            </div>
          </figure>
        </div>
      </section>

      {/* ── Dos entradas ───────────────────────────────────────── */}
      <section className="mx-auto max-w-shell px-5 pb-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/colegios"
            className="group rounded-xl border border-rule bg-surface p-6 transition-colors hover:border-accent"
          >
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-3">
              Si buscas un colegio
            </p>
            <h3 className="mt-2 font-display text-display-m font-medium text-ink">
              Explora un colegio
            </h3>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-2">
              Busca una institución y mira qué información pública existe sobre ella:
              reportes por año, tipo de violencia y el contexto del colegio, cada dato
              con el año al que corresponde.
            </p>
            <span className="mt-4 inline-block text-[0.86rem] font-medium text-accent">
              Buscar colegios →
            </span>
          </Link>

          <Link
            href="/datos"
            className="group rounded-xl border border-rule bg-surface p-6 transition-colors hover:border-accent"
          >
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-3">
              Si buscas patrones
            </p>
            <h3 className="mt-2 font-display text-display-m font-medium text-ink">
              Explora los datos
            </h3>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-2">
              Mira patrones en el conjunto del sistema educativo: cómo evolucionan los
              reportes, cómo se relacionan con el tamaño del colegio y qué
              asociaciones permiten —y no permiten— afirmar estos datos.
            </p>
            <span className="mt-4 inline-block text-[0.86rem] font-medium text-accent">
              Ver los datos →
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
